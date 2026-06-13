import { describe, expect, it } from 'vitest';
import type { Project, ShareLink } from '@/types';
import { buildCommandCenterModel } from '@/lib/command-center';

const baseProject = {
  configPath: '',
  createdAt: '2026-06-01T10:00:00.000Z',
  createdBy: 'admin',
  groupIds: [],
  thumbnailUrl: '',
} satisfies Partial<Project>;

function project(overrides: Partial<Project> & Pick<Project, 'id' | 'name'>): Project {
  return {
    ...baseProject,
    id: overrides.id,
    name: overrides.name,
    description: overrides.description ?? '',
    updatedAt: overrides.updatedAt ?? '2026-06-12T12:00:00.000Z',
    isPublished: overrides.isPublished ?? false,
    panoramaCount: overrides.panoramaCount ?? 0,
    thumbnailUrl: overrides.thumbnailUrl ?? '',
    configPath: overrides.configPath ?? '',
    createdAt: overrides.createdAt ?? baseProject.createdAt!,
    createdBy: overrides.createdBy ?? baseProject.createdBy!,
    groupIds: overrides.groupIds ?? [],
  };
}

function share(overrides: Partial<ShareLink> & Pick<ShareLink, 'projectId'>): ShareLink {
  return {
    projectId: overrides.projectId,
    token: overrides.token ?? `token-${overrides.projectId}`,
    isActive: overrides.isActive ?? false,
    pinHash: overrides.pinHash ?? null,
    createdAt: overrides.createdAt ?? '2026-06-01T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-12T12:00:00.000Z',
  };
}

describe('buildCommandCenterModel', () => {
  it('builds totals and orders recent projects by updated date descending', () => {
    const model = buildCommandCenterModel({
      projects: [
        project({
          id: 'older',
          name: 'Older',
          isPublished: true,
          panoramaCount: 2,
          updatedAt: '2026-06-10T12:00:00.000Z',
        }),
        project({
          id: 'newer',
          name: 'Newer',
          isPublished: false,
          panoramaCount: 5,
          updatedAt: '2026-06-12T12:00:00.000Z',
        }),
      ],
      shareLinks: [share({ projectId: 'older', isActive: true, pinHash: 'hash' })],
    });

    expect(model.summary).toEqual({
      totalProjects: 2,
      publishedProjects: 1,
      draftProjects: 1,
      totalPanoramas: 7,
      activeShareLinks: 1,
      pinProtectedShareLinks: 1,
    });
    expect(model.projects.map((p) => p.id)).toEqual(['newer', 'older']);
  });

  it('marks project share state and next action', () => {
    const model = buildCommandCenterModel({
      projects: [
        project({
          id: 'published-with-share',
          name: 'Published',
          isPublished: true,
          panoramaCount: 3,
        }),
        project({
          id: 'draft-ready',
          name: 'Draft Ready',
          isPublished: false,
          panoramaCount: 4,
        }),
        project({
          id: 'empty-draft',
          name: 'Empty Draft',
          isPublished: false,
          panoramaCount: 0,
        }),
      ],
      shareLinks: [
        share({ projectId: 'published-with-share', isActive: true }),
        share({ projectId: 'draft-ready', isActive: false }),
      ],
    });

    expect(model.projects.map((p) => [p.id, p.shareState, p.nextAction])).toEqual([
      ['published-with-share', 'active', 'Otwórz Studio'],
      ['draft-ready', 'inactive', 'Opublikuj'],
      ['empty-draft', 'none', 'Dodaj panoramy'],
    ]);
  });

  it('surfaces attention items for draft-ready projects, missing thumbnails, and PIN links', () => {
    const model = buildCommandCenterModel({
      projects: [
        project({
          id: 'draft-ready',
          name: 'Draft Ready',
          isPublished: false,
          panoramaCount: 4,
          thumbnailUrl: '',
        }),
        project({
          id: 'published-pin',
          name: 'Published PIN',
          isPublished: true,
          panoramaCount: 2,
          thumbnailUrl: '/thumb.webp',
        }),
      ],
      shareLinks: [share({ projectId: 'published-pin', isActive: true, pinHash: 'hash' })],
    });

    expect(model.attentionItems.map((item) => item.title)).toEqual([
      'Draft Ready jest gotowy do publikacji',
      'Draft Ready nie ma miniatury',
      'Published PIN ma aktywny link z PIN',
    ]);
  });

  it('exposes the fixed quick actions used by the console', () => {
    const model = buildCommandCenterModel({ projects: [], shareLinks: [] });

    expect(model.quickActions.map((action) => action.label)).toEqual([
      'Importuj projekt ZIP',
      'Nowy projekt',
      'Otwórz Studio',
      'Pobierz backup',
      'Przebuduj metadane',
    ]);
  });

  it('caps attention items and exposes activity for the latest five projects', () => {
    const projects = Array.from({ length: 6 }, (_, index) =>
      project({
        id: `draft-${index}`,
        name: `Draft ${index}`,
        isPublished: false,
        panoramaCount: 1,
        thumbnailUrl: '',
        updatedAt: `2026-06-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
      })
    );

    const model = buildCommandCenterModel({ projects, shareLinks: [] });

    expect(model.attentionItems).toHaveLength(5);
    expect(model.activityItems.map((item) => item.id)).toEqual([
      'draft-5-updated',
      'draft-4-updated',
      'draft-3-updated',
      'draft-2-updated',
      'draft-1-updated',
    ]);
  });
});
