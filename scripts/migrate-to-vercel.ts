/**
 * Jednorazowa migracja lokalnych danych (pliki JSON + uploads/) do
 * Neon Postgres i Vercel Blob.
 *
 * Źródło: PANO_DATA_DIR lub bieżący katalog (data/ + uploads/projects/).
 * Uruchomienie: npm run db:migrate-data
 * (wymaga DATABASE_URL i BLOB_READ_WRITE_TOKEN w .env.local)
 *
 * Skrypt jest idempotentny – istniejące rekordy są pomijane.
 */
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import { getDb } from '../src/lib/db/client';
import {
  users,
  groups,
  userGroups,
  projects,
  groupProjects,
  shareLinks,
  accessRules,
  accessPending,
  statsEvents,
} from '../src/lib/db/schema';
import { putBlob, contentTypeForFile, listBlobs } from '../src/lib/storage/blob';
import type { ProjectConfig } from '../src/types';

const ROOT = process.env.PANO_DATA_DIR?.trim() || process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const UPLOADS_DIR = path.join(ROOT, 'uploads', 'projects');

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const content = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function defaultConfig(name: string, description: string, now: string): ProjectConfig {
  return {
    version: '1.0',
    projectName: name,
    description,
    createdAt: now,
    updatedAt: now,
    settings: {
      autoRotate: true,
      autoRotateSpeed: 0.5,
      autoRotateDelay: 30000,
      cameraFov: 55,
      optimizePanoramaForScreen: true,
      controlBar: false,
      splashDuration: 3000,
      fadeDuration: 2000,
    },
    panoramas: [],
    metadata: { author: 'CONCEPTFAB', client: '', tags: [] },
  };
}

async function main() {
  const db = getDb();
  console.log(`Źródło danych: ${ROOT}`);

  // --- users ---
  const usersData = await readJson<{ users: Array<Record<string, unknown>> }>(
    'users.json'
  );
  const userGroupPairs: { userId: string; groupId: string }[] = [];
  if (usersData?.users?.length) {
    for (const u of usersData.users) {
      await db
        .insert(users)
        .values({
          id: String(u.id),
          email: String(u.email).toLowerCase(),
          role: (u.role as 'admin' | 'user' | 'editor') ?? 'user',
          isActive: u.isActive !== false,
          createdAt: String(u.createdAt ?? new Date().toISOString()),
          lastLoginAt: (u.lastLoginAt as string | null) ?? null,
        })
        .onConflictDoNothing();
      for (const gid of (u.groupIds as string[]) ?? []) {
        userGroupPairs.push({ userId: String(u.id), groupId: gid });
      }
    }
    console.log(`Users: ${usersData.users.length}`);
  }

  // --- groups ---
  const groupsData = await readJson<{ groups: Array<Record<string, unknown>> }>(
    'groups.json'
  );
  if (groupsData?.groups?.length) {
    for (const g of groupsData.groups) {
      await db
        .insert(groups)
        .values({
          id: String(g.id),
          name: String(g.name),
          description: String(g.description ?? ''),
          color: String(g.color ?? '#6b7280'),
          createdAt: String(g.createdAt ?? new Date().toISOString()),
        })
        .onConflictDoNothing();
    }
    console.log(`Groups: ${groupsData.groups.length}`);
  }

  if (userGroupPairs.length) {
    await db.insert(userGroups).values(userGroupPairs).onConflictDoNothing();
  }

  // --- projects (+ config z uploads/projects/{id}/config.json) ---
  const projectsData = await readJson<{
    projects: Array<Record<string, unknown>>;
  }>('projects.json');
  const groupProjectPairs: { groupId: string; projectId: string }[] = [];
  if (projectsData?.projects?.length) {
    for (const p of projectsData.projects) {
      const id = String(p.id);
      const now = new Date().toISOString();
      let config: ProjectConfig | null = null;
      const configFile = path.join(UPLOADS_DIR, id, 'config.json');
      if (existsSync(configFile)) {
        try {
          config = JSON.parse(await fs.readFile(configFile, 'utf-8'));
        } catch {
          console.warn(`  ! Nieczytelny config.json projektu ${id}`);
        }
      }
      if (!config) {
        config = defaultConfig(
          String(p.name ?? id),
          String(p.description ?? ''),
          String(p.createdAt ?? now)
        );
      }

      await db
        .insert(projects)
        .values({
          id,
          name: String(p.name ?? id),
          description: String(p.description ?? ''),
          thumbnailUrl: String(p.thumbnailUrl ?? ''),
          createdAt: String(p.createdAt ?? now),
          updatedAt: String(p.updatedAt ?? now),
          createdBy: String(p.createdBy ?? 'system'),
          isPublished: p.isPublished === true,
          panoramaCount: Number(p.panoramaCount ?? config.panoramas.length),
          config,
        })
        .onConflictDoNothing();

      for (const gid of (p.groupIds as string[]) ?? []) {
        groupProjectPairs.push({ groupId: gid, projectId: id });
      }
    }
    console.log(`Projects: ${projectsData.projects.length}`);
  }

  if (groupProjectPairs.length) {
    await db
      .insert(groupProjects)
      .values(groupProjectPairs)
      .onConflictDoNothing();
  }

  // --- share-links ---
  const shareData = await readJson<{ links: Array<Record<string, unknown>> }>(
    'share-links.json'
  );
  if (shareData?.links?.length) {
    for (const l of shareData.links) {
      await db
        .insert(shareLinks)
        .values({
          projectId: String(l.projectId),
          token: String(l.token),
          isActive: l.isActive === true,
          pinHash: (l.pinHash as string | null) ?? null,
          createdAt: String(l.createdAt ?? new Date().toISOString()),
          updatedAt: String(l.updatedAt ?? new Date().toISOString()),
        })
        .onConflictDoNothing();
    }
    console.log(`Share links: ${shareData.links.length}`);
  }

  // --- access-control ---
  const acData = await readJson<{
    whitelist?: Array<Record<string, unknown>>;
    blacklist?: Array<Record<string, unknown>>;
    pending?: Array<Record<string, unknown>>;
  }>('access-control.json');
  if (acData) {
    for (const listType of ['whitelist', 'blacklist'] as const) {
      for (const r of acData[listType] ?? []) {
        await db
          .insert(accessRules)
          .values({
            id: String(r.id),
            listType,
            pattern: String(r.pattern),
            isActive: r.isActive !== false,
            createdAt: String(r.createdAt ?? new Date().toISOString()),
            notes: String(r.notes ?? ''),
          })
          .onConflictDoNothing();
      }
    }
    for (const p of acData.pending ?? []) {
      await db
        .insert(accessPending)
        .values({
          email: String(p.email).toLowerCase(),
          requestedAt: String(p.requestedAt ?? new Date().toISOString()),
        })
        .onConflictDoNothing();
    }
    console.log(
      `Access control: wl=${acData.whitelist?.length ?? 0} bl=${acData.blacklist?.length ?? 0} pending=${acData.pending?.length ?? 0}`
    );
  }

  // --- stats (data/stats/{userId}/{YYYY-MM-DD}.json) ---
  const statsDir = path.join(DATA_DIR, 'stats');
  if (existsSync(statsDir)) {
    // Idempotencja: jeśli są już zdarzenia w bazie, pomijamy import statystyk,
    // bo tabela nie ma naturalnego klucza unikalności.
    const existing = await db.select().from(statsEvents).limit(1);
    if (existing.length > 0) {
      console.log('Stats: tabela niepusta – pomijam import statystyk.');
    } else {
      let eventCount = 0;
      const userDirs = await fs.readdir(statsDir, { withFileTypes: true });
      for (const dir of userDirs) {
        if (!dir.isDirectory()) continue;
        const userId = dir.name;
        const files = await fs.readdir(path.join(statsDir, userId));
        for (const f of files) {
          if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) continue;
          const date = f.replace('.json', '');
          try {
            const day = JSON.parse(
              await fs.readFile(path.join(statsDir, userId, f), 'utf-8')
            );
            const events = Array.isArray(day.events) ? day.events : [];
            if (events.length > 0) {
              await db.insert(statsEvents).values(
                events.map((event: unknown) => ({
                  userId,
                  date,
                  event: event as never,
                }))
              );
              eventCount += events.length;
            }
          } catch {
            console.warn(`  ! Pominięto nieczytelny plik stats: ${userId}/${f}`);
          }
        }
      }
      console.log(`Stats: ${eventCount} zdarzeń`);
    }
  }

  // --- pliki uploads/projects/** -> Vercel Blob ---
  if (existsSync(UPLOADS_DIR)) {
    const existingBlobs = new Set(
      (await listBlobs('projects/')).map((b) => b.pathname)
    );
    let uploaded = 0;
    let skipped = 0;

    const walk = async (dir: string, baseKey: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full, `${baseKey}/${entry.name}`);
        } else if (entry.isFile()) {
          if (entry.name === 'config.json' && baseKey.split('/').length === 2) {
            continue; // config projektu jest w bazie
          }
          const key = `${baseKey}/${entry.name}`;
          if (existingBlobs.has(key)) {
            skipped++;
            continue;
          }
          const content = await fs.readFile(full);
          await putBlob(key, content, {
            contentType: contentTypeForFile(entry.name),
          });
          uploaded++;
          if (uploaded % 10 === 0) {
            console.log(`  ...wgrano ${uploaded} plików`);
          }
        }
      }
    };

    const projectDirs = await fs.readdir(UPLOADS_DIR, { withFileTypes: true });
    for (const dir of projectDirs) {
      if (!dir.isDirectory()) continue;
      await walk(path.join(UPLOADS_DIR, dir.name), `projects/${dir.name}`);
    }
    console.log(`Blob: wgrano ${uploaded}, pominięto ${skipped} istniejących`);
  } else {
    console.log('Brak katalogu uploads/projects – pomijam pliki.');
  }

  console.log('Migracja zakończona.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
