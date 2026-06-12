# Link do prezentacji — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać publiczny, dezaktywowalny link, którym anonimowy posiadacz otwiera prezentację panoramy (opcjonalnie chronioną PIN-em), z liczeniem wejść anonimowych w statystykach.

**Architecture:** Token przechowywany w pliku JSON (`data/share-links.json`) → natychmiastowa dezaktywacja flagą `isActive`. Publiczna trasa `/p/[token]` waliduje token + publikację projektu i renderuje istniejący `PanoViewer` w trybie publicznym. PIN hashowany `scrypt`, po weryfikacji ustawiane podpisane (jose) ciasteczko. Statystyki anonimowe trafiają do kubełka `share` przez istniejący mechanizm `appendEvent`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, zod, jose, Node `crypto`, async-mutex (JSON store), Vitest (nowość, do testów czystej logiki).

**Spec:** [docs/superpowers/specs/2026-05-21-presentation-share-link-design.md](../specs/2026-05-21-presentation-share-link-design.md)

---

## Struktura plików

**Nowe:**
- `vitest.config.mts` — konfiguracja testów (alias `@`, include `tests/`).
- `tests/setup.ts` — ustawia `PANO_DATA_DIR` (temp) i `JWT_SECRET` przed importem modułów.
- `tests/share-pin.test.ts`, `tests/share-token.test.ts`, `tests/share-links.test.ts`, `tests/share-unlock.test.ts` — testy logiki.
- `src/types/share.ts` — typy `ShareLink`, `ShareLinksData`.
- `src/lib/auth/share-pin.ts` — `hashPin`/`verifyPin` (scrypt).
- `src/lib/auth/share-unlock.ts` — podpisane ciasteczko unlock (jose).
- `src/lib/db/share-links.ts` — warstwa danych + `generateShareToken`.
- `src/app/api/projects/[id]/share/route.ts` — GET/PUT (zarządzanie).
- `src/app/api/p/[token]/unlock/route.ts` — POST (weryfikacja PIN).
- `src/app/api/p/[token]/stats/route.ts` — POST (statystyki anonimowe).
- `src/app/p/[token]/page.tsx` — publiczna strona prezentacji.
- `src/components/viewer/SharePinGate.tsx` — ekran PIN.
- `src/components/admin/ProjectShareLinkCard.tsx` — sekcja zarządzania w UI.

**Zmieniane:**
- `package.json` — devDep `vitest` + skrypty `test`.
- `tsconfig.json` — `exclude` o `tests`.
- `eslint.config.mjs` — `globalIgnores` o `tests/**`.
- `src/types/index.ts` — `export * from './share'`.
- `src/utils/validation.ts` — `shareLinkSchema`, `shareLinksDataSchema`.
- `src/components/viewer/PanoViewer.tsx` — propsy `publicMode`, `shareToken`.
- `src/components/admin/ProjectEditForm.tsx` — render `ProjectShareLinkCard`.
- `src/lib/db/projects.ts` — `deleteProject` usuwa wpis linku.
- `src/app/api/admin/stats/route.ts` — syntetyczny wiersz `share`.

---

## Task 0: Konfiguracja Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.mts`
- Create: `tests/setup.ts`
- Modify: `tsconfig.json`
- Modify: `eslint.config.mjs`
- Test: `tests/smoke.test.ts` (tymczasowy)

- [ ] **Step 1: Zainstaluj Vitest**

Run: `npm install -D vitest`
Expected: `vitest` pojawia się w `devDependencies`.

- [ ] **Step 2: Dodaj skrypty testowe do `package.json`**

W sekcji `"scripts"` dodaj (po linii `"lint": "eslint",`):

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 3: Utwórz `vitest.config.mts`**

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const resolvePath = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolvePath('./src'),
    },
  },
});
```

- [ ] **Step 4: Utwórz `tests/setup.ts`**

Ustawia katalog danych na temp i sekret JWT ZANIM moduły aplikacji policzą `getDataRoot()` / sprawdzą `JWT_SECRET` przy imporcie.

```ts
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = mkdtempSync(path.join(tmpdir(), 'pano-test-'));
mkdirSync(path.join(root, 'data'), { recursive: true });

process.env.PANO_DATA_DIR = root;
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456';
```

- [ ] **Step 5: Wyklucz `tests` z `tsconfig.json`**

Zmień linię `"exclude": ["node_modules"]` na:

```json
  "exclude": ["node_modules", "tests"]
```

- [ ] **Step 6: Dodaj `tests/**` do ignorowanych w `eslint.config.mjs`**

W tablicy `globalIgnores([...])` dodaj po linii `"scripts/**",`:

```js
    // Testy (Vitest)
    "tests/**",
```

- [ ] **Step 7: Napisz tymczasowy smoke test**

`tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Uruchom testy — mają przejść**

Run: `npm test`
Expected: PASS, 1 passed (smoke).

- [ ] **Step 9: Usuń smoke test**

Run: `rm tests/smoke.test.ts`

- [ ] **Step 10: Lint + commit**

Run: `npm run lint`
Expected: brak błędów.

```bash
git add package.json package-lock.json vitest.config.mts tests/setup.ts tsconfig.json eslint.config.mjs
git commit -m "chore: dodaj Vitest dla testów logiki"
```

---

## Task 1: Hashowanie PIN (`share-pin.ts`)

**Files:**
- Create: `src/lib/auth/share-pin.ts`
- Test: `tests/share-pin.test.ts`

- [ ] **Step 1: Napisz failing test**

`tests/share-pin.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin } from '@/lib/auth/share-pin';

describe('share-pin', () => {
  it('verifies a correct PIN', () => {
    const h = hashPin('1234');
    expect(verifyPin('1234', h)).toBe(true);
  });

  it('rejects a wrong PIN', () => {
    const h = hashPin('1234');
    expect(verifyPin('0000', h)).toBe(false);
  });

  it('produces different hashes for the same PIN (random salt)', () => {
    expect(hashPin('1234')).not.toBe(hashPin('1234'));
  });

  it('rejects a malformed stored value', () => {
    expect(verifyPin('1234', 'garbage')).toBe(false);
  });
});
```

- [ ] **Step 2: Uruchom — ma się wywalić**

Run: `npx vitest run tests/share-pin.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/auth/share-pin"`.

- [ ] **Step 3: Zaimplementuj `share-pin.ts`**

```ts
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEYLEN = 32;

/** Hash PIN-u w formacie "scrypt$<saltHex>$<hashHex>". */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** Weryfikacja PIN-u w czasie stałym. */
export function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    const actual = scryptSync(pin, salt, expected.length);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Uruchom — ma przejść**

Run: `npx vitest run tests/share-pin.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/share-pin.ts tests/share-pin.test.ts
git commit -m "feat: hashowanie i weryfikacja PIN linku (scrypt)"
```

---

## Task 2: Typy i walidacja ShareLink

**Files:**
- Create: `src/types/share.ts`
- Modify: `src/types/index.ts`
- Modify: `src/utils/validation.ts:52` (po `accessControlSchema`)

- [ ] **Step 1: Utwórz `src/types/share.ts`**

```ts
export interface ShareLink {
  projectId: string;
  token: string;
  isActive: boolean;
  pinHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShareLinksData {
  links: ShareLink[];
}
```

- [ ] **Step 2: Eksportuj z barrela `src/types/index.ts`**

Dodaj na końcu pliku:

```ts
export * from './share';
```

- [ ] **Step 3: Dodaj schematy zod do `src/utils/validation.ts`**

Wstaw po bloku `accessControlSchema` (po linii `});` kończącej `accessControlSchema`):

```ts
// Share link validation
export const shareLinkSchema = z.object({
  projectId: z.string(),
  token: z.string(),
  isActive: z.boolean(),
  pinHash: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const shareLinksDataSchema = z.object({
  links: z.array(shareLinkSchema),
});
```

- [ ] **Step 4: Sprawdź typy (build type-check tych plików)**

Run: `npx tsc --noEmit`
Expected: brak błędów dotyczących `src/types/share.ts` / `validation.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/types/share.ts src/types/index.ts src/utils/validation.ts
git commit -m "feat: typy i walidacja ShareLink"
```

---

## Task 3: Warstwa danych (`share-links.ts`)

**Files:**
- Create: `src/lib/db/share-links.ts`
- Test: `tests/share-token.test.ts`, `tests/share-links.test.ts`

- [ ] **Step 1: Napisz failing test tokenu**

`tests/share-token.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateShareToken } from '@/lib/db/share-links';

describe('generateShareToken', () => {
  it('produces a URL-safe token of expected length', () => {
    const t = generateShareToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(32);
  });

  it('produces unique tokens', () => {
    expect(generateShareToken()).not.toBe(generateShareToken());
  });
});
```

- [ ] **Step 2: Napisz failing test warstwy danych**

`tests/share-links.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { rmSync } from 'node:fs';
import path from 'node:path';
import {
  setShareActive,
  setSharePin,
  getShareLinkByProject,
  getShareLinkByToken,
  deleteShareLink,
} from '@/lib/db/share-links';
import { verifyPin } from '@/lib/auth/share-pin';

beforeEach(() => {
  rmSync(path.join(process.env.PANO_DATA_DIR!, 'data', 'share-links.json'), {
    force: true,
  });
});

describe('share-links db', () => {
  it('creates a link with a token on first enable', async () => {
    const link = await setShareActive('proj-1', true);
    expect(link.token).toBeTruthy();
    expect(link.isActive).toBe(true);
    expect(link.pinHash).toBeNull();
  });

  it('keeps the same token across toggles', async () => {
    const a = await setShareActive('proj-1', true);
    const b = await setShareActive('proj-1', false);
    expect(b.token).toBe(a.token);
    expect(b.isActive).toBe(false);
  });

  it('looks up by token and by project', async () => {
    const a = await setShareActive('proj-1', true);
    expect((await getShareLinkByToken(a.token))?.projectId).toBe('proj-1');
    expect((await getShareLinkByProject('proj-1'))?.token).toBe(a.token);
  });

  it('sets and clears a PIN', async () => {
    await setShareActive('proj-1', true);
    const withPin = await setSharePin('proj-1', '1234');
    expect(withPin.pinHash).not.toBeNull();
    expect(verifyPin('1234', withPin.pinHash!)).toBe(true);
    const cleared = await setSharePin('proj-1', null);
    expect(cleared.pinHash).toBeNull();
  });

  it('deletes a link', async () => {
    await setShareActive('proj-1', true);
    expect(await deleteShareLink('proj-1')).toBe(true);
    expect(await getShareLinkByProject('proj-1')).toBeNull();
  });

  it('returns null for an unknown token', async () => {
    expect(await getShareLinkByToken('nope')).toBeNull();
  });
});
```

- [ ] **Step 3: Uruchom — mają się wywalić**

Run: `npx vitest run tests/share-token.test.ts tests/share-links.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/db/share-links"`.

- [ ] **Step 4: Zaimplementuj `src/lib/db/share-links.ts`**

```ts
import { randomBytes } from 'crypto';
import { readJsonFileWithDefault, writeJsonFile } from './json-store';
import { ShareLink, ShareLinksData } from '@/types';
import { formatDate } from '@/utils/helpers';
import { shareLinksDataSchema } from '@/utils/validation';
import { hashPin } from '@/lib/auth/share-pin';

const SHARE_LINKS_FILE = 'share-links.json';
const DEFAULT_DATA: ShareLinksData = { links: [] };

/** Losowy token linku (base64url, 192 bity entropii). */
export function generateShareToken(): string {
  return randomBytes(24).toString('base64url');
}

async function readAll(): Promise<ShareLinksData> {
  const data = await readJsonFileWithDefault<ShareLinksData>(
    SHARE_LINKS_FILE,
    DEFAULT_DATA
  );
  return shareLinksDataSchema.parse(data) as ShareLinksData;
}

export async function getShareLinks(): Promise<ShareLink[]> {
  return (await readAll()).links;
}

export async function getShareLinkByToken(
  token: string
): Promise<ShareLink | null> {
  if (!token) return null;
  const { links } = await readAll();
  return links.find((l) => l.token === token) ?? null;
}

export async function getShareLinkByProject(
  projectId: string
): Promise<ShareLink | null> {
  const { links } = await readAll();
  return links.find((l) => l.projectId === projectId) ?? null;
}

/** Włącza/wyłącza link. Pierwsze włączenie tworzy wpis i generuje token. */
export async function setShareActive(
  projectId: string,
  isActive: boolean
): Promise<ShareLink> {
  const data = await readAll();
  const now = formatDate(new Date());
  let link = data.links.find((l) => l.projectId === projectId);
  if (!link) {
    link = {
      projectId,
      token: generateShareToken(),
      isActive,
      pinHash: null,
      createdAt: now,
      updatedAt: now,
    };
    data.links.push(link);
  } else {
    link.isActive = isActive;
    link.updatedAt = now;
  }
  await writeJsonFile<ShareLinksData>(SHARE_LINKS_FILE, data);
  return link;
}

/** Ustawia PIN (string) lub czyści go (null/''). Tworzy wpis, jeśli nie istnieje. */
export async function setSharePin(
  projectId: string,
  pin: string | null
): Promise<ShareLink> {
  const data = await readAll();
  const now = formatDate(new Date());
  const nextHash = pin ? hashPin(pin) : null;
  let link = data.links.find((l) => l.projectId === projectId);
  if (!link) {
    link = {
      projectId,
      token: generateShareToken(),
      isActive: false,
      pinHash: nextHash,
      createdAt: now,
      updatedAt: now,
    };
    data.links.push(link);
  } else {
    link.pinHash = nextHash;
    link.updatedAt = now;
  }
  await writeJsonFile<ShareLinksData>(SHARE_LINKS_FILE, data);
  return link;
}

export async function deleteShareLink(projectId: string): Promise<boolean> {
  const data = await readAll();
  const before = data.links.length;
  data.links = data.links.filter((l) => l.projectId !== projectId);
  if (data.links.length === before) return false;
  await writeJsonFile<ShareLinksData>(SHARE_LINKS_FILE, data);
  return true;
}
```

- [ ] **Step 5: Uruchom — mają przejść**

Run: `npx vitest run tests/share-token.test.ts tests/share-links.test.ts`
Expected: PASS (2 + 6 passed).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/share-links.ts tests/share-token.test.ts tests/share-links.test.ts
git commit -m "feat: warstwa danych linków współdzielenia"
```

---

## Task 4: Ciasteczko unlock (`share-unlock.ts`)

**Files:**
- Create: `src/lib/auth/share-unlock.ts`
- Test: `tests/share-unlock.test.ts`

- [ ] **Step 1: Napisz failing test**

`tests/share-unlock.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  createShareUnlockToken,
  verifyShareUnlockToken,
} from '@/lib/auth/share-unlock';

describe('share-unlock token', () => {
  it('round-trips for the same share token', async () => {
    const v = await createShareUnlockToken('abc');
    expect(await verifyShareUnlockToken(v, 'abc')).toBe(true);
  });

  it('fails for a different share token', async () => {
    const v = await createShareUnlockToken('abc');
    expect(await verifyShareUnlockToken(v, 'xyz')).toBe(false);
  });

  it('fails for garbage input', async () => {
    expect(await verifyShareUnlockToken('garbage', 'abc')).toBe(false);
  });
});
```

- [ ] **Step 2: Uruchom — ma się wywalić**

Run: `npx vitest run tests/share-unlock.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/auth/share-unlock"`.

- [ ] **Step 3: Zaimplementuj `src/lib/auth/share-unlock.ts`**

```ts
import { SignJWT, jwtVerify } from 'jose';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET environment variable must be set (min 32 chars)');
}
const KEY = new TextEncoder().encode(jwtSecret);
const TTL = '12h';

/** Podpisany token odblokowania konkretnego linku (claim `share`). */
export async function createShareUnlockToken(shareToken: string): Promise<string> {
  return new SignJWT({ share: shareToken })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(KEY);
}

/** True, gdy ciasteczko jest ważne i dotyczy właśnie tego linku. */
export async function verifyShareUnlockToken(
  value: string,
  shareToken: string
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(value, KEY);
    return payload.share === shareToken;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Uruchom — ma przejść**

Run: `npx vitest run tests/share-unlock.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Pełny przebieg testów**

Run: `npm test`
Expected: PASS — wszystkie pliki testowe zielone.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/share-unlock.ts tests/share-unlock.test.ts
git commit -m "feat: podpisane ciasteczko odblokowania linku (jose)"
```

---

## Task 5: API zarządzania linkiem (GET/PUT)

**Files:**
- Create: `src/app/api/projects/[id]/share/route.ts`

Weryfikacja: ręczna (route handler wymaga sesji) + `npm run lint` + `npm run build`.

- [ ] **Step 1: Zaimplementuj route handler**

```ts
import { NextRequest, NextResponse } from 'next/server';
import {
  requireAdminOrEditor,
  editorCanEditProject,
} from '@/lib/auth/session';
import { getProjectById } from '@/lib/db/projects';
import { getUserById } from '@/lib/db/users';
import {
  getShareLinkByProject,
  setShareActive,
  setSharePin,
} from '@/lib/db/share-links';
import { Project, ShareLink } from '@/types';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type AuthResult =
  | { ok: false; response: NextResponse }
  | { ok: true; project: Project };

async function authorize(id: string): Promise<AuthResult> {
  const session = await requireAdminOrEditor();
  const project = await getProjectById(id);
  if (!project) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      ),
    };
  }
  if (session.role === 'editor') {
    const user = await getUserById(session.userId);
    if (!user || !editorCanEditProject(project.groupIds, user.groupIds)) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Access denied' }, { status: 403 }),
      };
    }
  }
  return { ok: true, project };
}

function buildResponse(request: NextRequest, link: ShareLink | null) {
  if (!link) return { isActive: false, hasPin: false, url: null };
  return {
    isActive: link.isActive,
    hasPin: link.pinHash !== null,
    url: `${request.nextUrl.origin}/p/${link.token}`,
  };
}

function handleErr(error: unknown) {
  if (error instanceof Error && error.message.includes('Forbidden')) {
    return NextResponse.json(
      { error: 'Wymagane uprawnienia admin lub edytor' },
      { status: 403 }
    );
  }
  if (error instanceof Error && error.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  console.error('Share API error:', error);
  return NextResponse.json({ error: 'Failed' }, { status: 500 });
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await authorize(id);
    if (!auth.ok) return auth.response;
    const link = await getShareLinkByProject(id);
    return NextResponse.json(buildResponse(request, link));
  } catch (error) {
    return handleErr(error);
  }
}

const putSchema = z.object({
  isActive: z.boolean().optional(),
  pin: z.string().min(1).max(64).nullable().optional(),
});

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await authorize(id);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const updates = putSchema.parse(body);

    if (updates.pin !== undefined) {
      await setSharePin(id, updates.pin);
    }
    if (updates.isActive !== undefined) {
      await setShareActive(id, updates.isActive);
    }

    const link = await getShareLinkByProject(id);
    return NextResponse.json(buildResponse(request, link));
  } catch (error) {
    return handleErr(error);
  }
}
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: brak błędów; trasy `/api/projects/[id]/share` w outputcie build.

- [ ] **Step 3: Weryfikacja ręczna**

1. `npm run dev`, zaloguj się jako admin.
2. Znajdź `id` projektu (np. `Jutrzenki`).
3. W konsoli przeglądarki (zalogowany):
   ```js
   await fetch('/api/projects/Jutrzenki/share').then(r => r.json())
   // → { isActive:false, hasPin:false, url:null }
   await fetch('/api/projects/Jutrzenki/share', {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({isActive:true})}).then(r=>r.json())
   // → { isActive:true, hasPin:false, url:"http://localhost:3000/p/<token>" }
   ```
4. Sprawdź, że plik `data/share-links.json` powstał z wpisem.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/projects/[id]/share/route.ts
git commit -m "feat: API zarządzania linkiem prezentacji (GET/PUT)"
```

---

## Task 6: API odblokowania PIN

**Files:**
- Create: `src/app/api/p/[token]/unlock/route.ts`

- [ ] **Step 1: Zaimplementuj route handler**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getShareLinkByToken } from '@/lib/db/share-links';
import { getProjectById } from '@/lib/db/projects';
import { verifyPin } from '@/lib/auth/share-pin';
import { createShareUnlockToken } from '@/lib/auth/share-unlock';

interface RouteParams {
  params: Promise<{ token: string }>;
}

const bodySchema = z.object({ pin: z.string().min(1).max(64) });

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    const link = await getShareLinkByToken(token);
    if (!link || !link.isActive) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const project = await getProjectById(link.projectId);
    if (!project || !project.isPublished) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (link.pinHash === null) {
      return NextResponse.json({ ok: true });
    }

    const { pin } = bodySchema.parse(await request.json());
    if (!verifyPin(pin, link.pinHash)) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    const cookieValue = await createShareUnlockToken(token);
    const cookieStore = await cookies();
    cookieStore.set(`pano-share-${token}`, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 12,
      path: '/',
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unlock error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: brak błędów; trasa `/api/p/[token]/unlock`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/p/[token]/unlock/route.ts
git commit -m "feat: API odblokowania linku PIN-em"
```

---

## Task 7: API statystyk anonimowych

**Files:**
- Create: `src/app/api/p/[token]/stats/route.ts`

- [ ] **Step 1: Zaimplementuj route handler**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getShareLinkByToken } from '@/lib/db/share-links';
import { getProjectById } from '@/lib/db/projects';
import { verifyShareUnlockToken } from '@/lib/auth/share-unlock';
import { appendEvent, getDateString } from '@/lib/db/stats';
import type { StatsEvent } from '@/types/stats';

interface RouteParams {
  params: Promise<{ token: string }>;
}

const payloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('view_start'),
    projectId: z.string(),
    projectName: z.string().optional(),
  }),
  z.object({
    type: z.literal('view_end'),
    projectId: z.string(),
    durationSeconds: z.number(),
  }),
  z.object({
    type: z.literal('screenshot'),
    projectId: z.string(),
    projectName: z.string().optional(),
  }),
]);

const bodySchema = z.object({
  type: z.enum(['view_start', 'view_end', 'screenshot']),
  payload: payloadSchema,
});

function toEvent(payload: z.infer<typeof payloadSchema>): StatsEvent {
  const at = new Date().toISOString();
  switch (payload.type) {
    case 'view_start':
      return {
        type: 'view_start',
        at,
        projectId: payload.projectId,
        projectName: payload.projectName,
      };
    case 'view_end':
      return {
        type: 'view_end',
        at,
        projectId: payload.projectId,
        durationSeconds: payload.durationSeconds,
      };
    case 'screenshot':
      return {
        type: 'screenshot',
        at,
        projectId: payload.projectId,
        projectName: payload.projectName,
      };
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    const link = await getShareLinkByToken(token);
    if (!link || !link.isActive) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const project = await getProjectById(link.projectId);
    if (!project || !project.isPublished) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (link.pinHash !== null) {
      const cookieStore = await cookies();
      const c = cookieStore.get(`pano-share-${token}`);
      if (!c || !(await verifyShareUnlockToken(c.value, token))) {
        return NextResponse.json({ error: 'Locked' }, { status: 401 });
      }
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (parsed.data.payload.projectId !== link.projectId) {
      return NextResponse.json({ error: 'Project mismatch' }, { status: 400 });
    }

    await appendEvent('share', getDateString(), toEvent(parsed.data.payload));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Share stats error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: brak błędów; trasa `/api/p/[token]/stats`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/p/[token]/stats/route.ts
git commit -m "feat: API statystyk anonimowych z linku (kubełek share)"
```

---

## Task 8: Tryb publiczny w `PanoViewer`

**Files:**
- Modify: `src/components/viewer/PanoViewer.tsx`

Trzy zmiany: (a) propsy, (b) wybór endpointu statystyk, (c) ukrycie linku do galerii.

- [ ] **Step 1: Dodaj propsy do interfejsu**

W `interface PanoViewerProps` (linia ~25) dodaj po `projectId?: string;` (linia ~29):

```ts
  /** Tryb publiczny (link współdzielenia): ukrywa powrót do galerii. */
  publicMode?: boolean;
  /** Gdy ustawiony, statystyki idą na /api/p/<token>/stats zamiast /api/stats. */
  shareToken?: string;
```

- [ ] **Step 2: Odbierz nowe propsy w destrukturyzacji**

W `export function PanoViewer({ ... })` (linia ~32) dodaj `publicMode` i `shareToken`:

```ts
export function PanoViewer({
  config,
  basePath,
  isAdmin,
  projectId,
  publicMode,
  shareToken,
}: PanoViewerProps) {
```

- [ ] **Step 3: Dodaj wyliczenie endpointu statystyk**

Tuż po destrukturyzacji propsów, przed `const containerRef = ...`, dodaj:

```ts
  const statsEndpoint = shareToken ? `/api/p/${shareToken}/stats` : '/api/stats';
```

- [ ] **Step 4: Użyj `statsEndpoint` w efekcie view_start/view_end**

W `useEffect` statystyk (linia ~321) zamień oba `fetch('/api/stats', ...)` na `fetch(statsEndpoint, ...)` i dodaj `statsEndpoint` do tablicy zależności (obecnie `[projectId, config.projectName]`). Efekt końcowy:

```ts
  // Statystyki: view_start przy wejściu, view_end przy wyjściu (z czasem)
  useEffect(() => {
    if (!projectId) return;
    viewStartTimeRef.current = Date.now();
    fetch(statsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'view_start',
        payload: {
          type: 'view_start',
          projectId,
          projectName: config.projectName,
        },
      }),
    }).catch(() => {});

    return () => {
      const start = viewStartTimeRef.current;
      if (start != null) {
        const durationSeconds = Math.round((Date.now() - start) / 1000);
        fetch(statsEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'view_end',
            payload: { type: 'view_end', projectId, durationSeconds },
          }),
        }).catch(() => {});
      }
    };
  }, [projectId, config.projectName, statsEndpoint]);
```

- [ ] **Step 5: Użyj `statsEndpoint` w screenshotcie**

W `handleScreenshot` (linia ~408) zamień `fetch('/api/stats', ...)` (wewnątrz `if (projectId) { ... }`, linia ~507) na `fetch(statsEndpoint, ...)` i dodaj `statsEndpoint` do zależności `useCallback` (tablica zależności po linii ~525): `}, [config.projectName, projectId, statsEndpoint]);`.

- [ ] **Step 6: Ukryj link „powrót do galerii" w trybie publicznym**

Zamień blok `<Link href="/gallery" ...> ... </Link>` (linia ~664) na warunkowy:

```tsx
        {!publicMode && (
          <Link
            href="/gallery"
            className="absolute top-6 left-6 z-40"
            title="Powrót do galerii"
          >
            <Button
              variant="secondary"
              size="icon"
              className="bg-black/50 hover:bg-black/70 text-white border-0 h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        )}
```

- [ ] **Step 7: Lint + build**

Run: `npm run lint && npm run build`
Expected: brak błędów ani ostrzeżeń o brakujących zależnościach hooków.

- [ ] **Step 8: Commit**

```bash
git add src/components/viewer/PanoViewer.tsx
git commit -m "feat: tryb publiczny PanoViewer (publicMode, shareToken)"
```

---

## Task 9: Ekran PIN + publiczna strona prezentacji

**Files:**
- Create: `src/components/viewer/SharePinGate.tsx`
- Create: `src/app/p/[token]/page.tsx`

- [ ] **Step 1: Utwórz `SharePinGate.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface SharePinGateProps {
  token: string;
  projectName: string;
}

export function SharePinGate({ token, projectName }: SharePinGateProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/p/${token}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      window.location.reload();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-black px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-white/15 bg-white/5 p-6 backdrop-blur"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-light text-white">{projectName}</h1>
          <p className="text-sm text-white/60">
            Ta prezentacja jest chroniona kodem PIN.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pin" className="text-white/80">
            PIN
          </Label>
          <Input
            id="pin"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoFocus
            required
          />
        </div>
        {error && <p className="text-sm text-red-400">Nieprawidłowy PIN.</p>}
        <Button type="submit" className="w-full" disabled={loading || !pin}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Otwórz prezentację'
          )}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Utwórz `src/app/p/[token]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getShareLinkByToken } from '@/lib/db/share-links';
import { getProjectById, getProjectConfig } from '@/lib/db/projects';
import { verifyShareUnlockToken } from '@/lib/auth/share-unlock';
import { PanoViewer } from '@/components/viewer/PanoViewer';
import { SharePinGate } from '@/components/viewer/SharePinGate';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PresentationPage({ params }: PageProps) {
  const { token } = await params;

  const link = await getShareLinkByToken(token);
  if (!link || !link.isActive) notFound();

  const project = await getProjectById(link.projectId);
  if (!project || !project.isPublished) notFound();

  if (link.pinHash !== null) {
    const cookieStore = await cookies();
    const c = cookieStore.get(`pano-share-${token}`);
    const unlocked = c ? await verifyShareUnlockToken(c.value, token) : false;
    if (!unlocked) {
      return <SharePinGate token={token} projectName={project.name} />;
    }
  }

  const config = await getProjectConfig(link.projectId);
  if (!config || config.panoramas.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <p className="text-white/60">Ten projekt nie ma jeszcze panoram</p>
      </div>
    );
  }

  const basePath = `/uploads/projects/${link.projectId}`;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <PanoViewer
        config={config}
        basePath={basePath}
        isAdmin={false}
        projectId={link.projectId}
        publicMode
        shareToken={token}
      />
    </div>
  );
}
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: brak błędów; trasa `/p/[token]` w outputcie.

- [ ] **Step 4: Weryfikacja ręczna (pełny przepływ bez PIN)**

1. `npm run dev`, zaloguj się jako admin, upewnij się że projekt `Jutrzenki` jest **opublikowany**.
2. Włącz link: `await fetch('/api/projects/Jutrzenki/share',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({isActive:true})}).then(r=>r.json())` — skopiuj `url`.
3. Otwórz `url` w **oknie incognito** (bez logowania) → prezentacja się uruchamia, brak przycisku „powrót do galerii".
4. Wyłącz link (`{isActive:false}`), odśwież incognito → **404**.
5. Włącz ponownie; ukryj publikację projektu (`PUT /api/projects/Jutrzenki {isPublished:false}`), odśwież incognito → **404**.

- [ ] **Step 5: Weryfikacja ręczna (PIN)**

1. Przywróć publikację i aktywny link. Ustaw PIN: `PUT /api/projects/Jutrzenki/share {pin:"1234"}`.
2. Otwórz `url` w incognito → ekran PIN. Błędny PIN → komunikat. PIN `1234` → prezentacja.
3. Odśwież → nie pyta ponownie (ciasteczko `pano-share-<token>`).

- [ ] **Step 6: Commit**

```bash
git add src/components/viewer/SharePinGate.tsx src/app/p/[token]/page.tsx
git commit -m "feat: publiczna strona prezentacji + ekran PIN"
```

---

## Task 10: Sprzątanie linku przy usuwaniu projektu

**Files:**
- Modify: `src/lib/db/projects.ts` (import + `deleteProject`)

- [ ] **Step 1: Dodaj import**

Po linii `import { ensurePanoramaVariantsForProject } from '@/lib/panorama-variants-server';` dodaj:

```ts
import { deleteShareLink } from './share-links';
```

- [ ] **Step 2: Usuń wpis linku w `deleteProject`**

W funkcji `deleteProject`, przed `return true;` (po `await syncGroupsProjectIdsFromProjects();`) dodaj:

```ts
  await deleteShareLink(id);
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: brak błędów.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/projects.ts
git commit -m "feat: usuwanie linku współdzielenia wraz z projektem"
```

---

## Task 11: Wiersz statystyk anonimowych w panelu admina

**Files:**
- Modify: `src/app/api/admin/stats/route.ts` (gałąź listy w GET)

- [ ] **Step 1: Dodaj syntetyczny wiersz `share`**

W `GET`, w gałęzi listy wszystkich użytkowników, **po** pętli `for (const user of users) { ... }` a **przed** `return NextResponse.json({ users: result });` dodaj:

```ts
    // Kubełek anonimowych wejść z linków współdzielenia
    const shareDates = await getStatsDaysForUser('share');
    if (shareDates.length > 0) {
      let shareTotal = 0;
      for (const d of shareDates) {
        const day = await getStatsDay('share', d);
        if (day) shareTotal += day.events.length;
      }
      result.push({
        userId: 'share',
        email: 'Linki publiczne (anonimowo)',
        days: shareDates,
        totalEvents: shareTotal,
      });
    }
```

(`getStatsDaysForUser` i `getStatsDay` są już importowane w tym pliku.)

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: brak błędów.

- [ ] **Step 3: Weryfikacja ręczna**

1. Wygeneruj wejście anonimowe: otwórz aktywny link `/p/<token>` w incognito i zamknij kartę (powstanie `view_start`/`view_end`).
2. Sprawdź `data/stats/share/<dzisiaj>.json` — zawiera zdarzenia.
3. Jako admin wejdź w panel Statystyki → wiersz „Linki publiczne (anonimowo)" jest widoczny; rozwinięcie pokazuje dni i zdarzenia.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/stats/route.ts
git commit -m "feat: wiersz statystyk anonimowych (share) w panelu admina"
```

---

## Task 12: Sekcja „Link do prezentacji" w UI

**Files:**
- Create: `src/components/admin/ProjectShareLinkCard.tsx`
- Modify: `src/components/admin/ProjectEditForm.tsx`

- [ ] **Step 1: Utwórz `ProjectShareLinkCard.tsx`**

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ShareState {
  isActive: boolean;
  hasPin: boolean;
  url: string | null;
}

export function ProjectShareLinkCard({ projectId }: { projectId: string }) {
  const [state, setState] = useState<ShareState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/share`);
      if (!res.ok) throw new Error();
      setState(await res.json());
    } catch {
      toast.error('Nie udało się pobrać linku');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (body: { isActive?: boolean; pin?: string | null }) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setState(await res.json());
      return true;
    } catch {
      toast.error('Nie udało się zapisać');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (next: boolean) => {
    const ok = await save({ isActive: next });
    if (ok) toast.success(next ? 'Link włączony' : 'Link wyłączony');
  };

  const onSetPin = async () => {
    if (!pin) return;
    const ok = await save({ pin });
    if (ok) {
      setPin('');
      toast.success('PIN ustawiony');
    }
  };

  const onClearPin = async () => {
    const ok = await save({ pin: null });
    if (ok) toast.success('PIN usunięty');
  };

  const copy = async () => {
    if (!state?.url) return;
    await navigator.clipboard.writeText(state.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Link do prezentacji</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || !state ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-md border p-4">
              <div className="space-y-1">
                <Label>Link aktywny</Label>
                <p className="text-sm text-muted-foreground">
                  Działa tylko dla opublikowanego projektu. Wyłączenie blokuje
                  link natychmiast.
                </p>
              </div>
              <Switch
                checked={state.isActive}
                disabled={saving}
                onCheckedChange={onToggle}
              />
            </div>

            {state.url && (
              <div className="space-y-2">
                <Label>Adres linku</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={state.url}
                    className={state.isActive ? '' : 'opacity-60'}
                  />
                  <Button type="button" variant="outline" onClick={copy}>
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {!state.isActive && (
                  <p className="text-xs text-muted-foreground">
                    Link jest obecnie nieaktywny.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="share-pin">PIN (opcjonalny)</Label>
              <div className="flex gap-2">
                <Input
                  id="share-pin"
                  type="password"
                  placeholder={state.hasPin ? '•••• (ustawiony)' : 'Bez PIN'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || !pin}
                  onClick={onSetPin}
                >
                  Ustaw
                </Button>
                {state.hasPin && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={saving}
                    onClick={onClearPin}
                  >
                    Usuń
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Wyrenderuj kartę w `ProjectEditForm.tsx`**

Dodaj import po linii `import { ProjectEditForm }`-owych importów (np. po `import { cn } from '@/lib/utils';`):

```ts
import { ProjectShareLinkCard } from './ProjectShareLinkCard';
```

Następnie w JSX, **przed** zamykającym `</div>` najbardziej zewnętrznego kontenera (czyli **po** zamykającym `</Card>` ostatniej karty „Wymiana panoram", ~linia z `</Card>` przed końcowym `</div>`), dodaj:

> Uwaga: `ProjectEditForm` ma obecnie DWIE karty — „Edycja projektu" (~linia 225) i „Wymiana panoram" (~linia 349). Kartę linku wstaw **po obu**, przed finalnym `</div>`.

```tsx
      <ProjectShareLinkCard projectId={project.id} />
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: brak błędów.

- [ ] **Step 4: Weryfikacja ręczna (pełny UI)**

1. `npm run dev`, zaloguj jako admin, wejdź w edycję projektu (`/admin/projects/Jutrzenki`).
2. Sekcja „Link do prezentacji" widoczna; przełącz „Link aktywny" → pojawia się URL; **Kopiuj** działa.
3. Otwórz URL w incognito → prezentacja.
4. Ustaw PIN „1234" → otwarcie URL w nowym incognito wymaga PIN.
5. Usuń PIN, wyłącz link → URL zwraca 404.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ProjectShareLinkCard.tsx src/components/admin/ProjectEditForm.tsx
git commit -m "feat: sekcja zarządzania linkiem prezentacji w edycji projektu"
```

---

## Task 13: Pełna weryfikacja końcowa

- [ ] **Step 1: Testy logiki**

Run: `npm test`
Expected: PASS — wszystkie pliki (`share-pin`, `share-token`, `share-links`, `share-unlock`).

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: brak błędów, build kończy się sukcesem.

- [ ] **Step 3: Przejdź kryteria akceptacji ze specu**

Zweryfikuj ręcznie pkt 1–7 z sekcji 13 specu:
1. Admin/edytor włącza link i kopiuje URL.
2. URL w incognito uruchamia prezentację.
3. Wyłączenie linku → 404.
4. Projekt nieopublikowany → 404 mimo aktywnego linku.
5. PIN wymagany po ustawieniu; błędny PIN → odmowa.
6. Wejścia anonimowe w panelu „Linki publiczne (anonimowo)".
7. Edytor widzi sekcję tylko dla projektów w swoich grupach (zaloguj jako editor, sprawdź projekt spoza jego grup → `GET .../share` zwraca 403).

---

## Self-review (autor planu)

**Pokrycie specu:**
- §4 model danych → Task 2, 3 ✅
- §5 publiczna trasa + bramki → Task 9 ✅
- §5 ekran PIN → Task 9 ✅
- §6 PanoViewer publicMode/shareToken → Task 8 ✅
- §7 statystyki anonimowe (endpoint + kubełek + panel) → Task 7, 11 ✅
- §8 API zarządzania + unlock + jose cookie → Task 4, 5, 6 ✅
- §9 UI sekcja → Task 12 ✅
- §10 bezpieczeństwo (404, scrypt, walidacja projectId, cookie per token) → Task 1, 6, 7, 9 ✅
- §4 sprzątanie przy usuwaniu projektu → Task 10 ✅

**Spójność typów:** `ShareLink`/`ShareLinksData` (Task 2) używane jednolicie w Task 3/5; `generateShareToken`, `getShareLinkByToken`, `getShareLinkByProject`, `setShareActive`, `setSharePin`, `deleteShareLink` — te same nazwy w testach (Task 3) i konsumentach (Task 5,6,7,9,10); `createShareUnlockToken`/`verifyShareUnlockToken` (Task 4) zgodne w Task 6/7/9; kształt odpowiedzi `{isActive,hasPin,url}` zgodny między API (Task 5) a UI (Task 12).

**Placeholdery:** brak — każdy krok zawiera pełny kod lub konkretną komendę.
