import {
  pgTable,
  text,
  boolean,
  integer,
  bigint,
  jsonb,
  primaryKey,
  serial,
  index,
} from 'drizzle-orm/pg-core';
import type { ProjectConfig } from '@/types';
import type { StatsEvent } from '@/types/stats';

// Daty przechowujemy jako stringi ISO (text), zgodnie z istniejącymi typami aplikacji.

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  role: text('role', { enum: ['admin', 'user', 'editor'] })
    .notNull()
    .default('user'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: text('created_at').notNull(),
  lastLoginAt: text('last_login_at'),
});

export const groups = pgTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  color: text('color').notNull().default('#6b7280'),
  createdAt: text('created_at').notNull(),
});

export const userGroups = pgTable(
  'user_groups',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.groupId] })]
);

export const projects = pgTable('projects', {
  id: text('id').primaryKey(), // slug
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  thumbnailUrl: text('thumbnail_url').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  createdBy: text('created_by').notNull(),
  isPublished: boolean('is_published').notNull().default(false),
  panoramaCount: integer('panorama_count').notNull().default(0),
  // Pełny config projektu (dawniej uploads/projects/{id}/config.json)
  config: jsonb('config').$type<ProjectConfig>().notNull(),
});

export const groupProjects = pgTable(
  'group_projects',
  {
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.projectId] })]
);

export const shareLinks = pgTable('share_links', {
  projectId: text('project_id')
    .primaryKey()
    .references(() => projects.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  isActive: boolean('is_active').notNull().default(false),
  pinHash: text('pin_hash'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const accessRules = pgTable('access_rules', {
  id: text('id').primaryKey(),
  listType: text('list_type', { enum: ['whitelist', 'blacklist'] }).notNull(),
  pattern: text('pattern').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: text('created_at').notNull(),
  notes: text('notes').notNull().default(''),
});

export const accessPending = pgTable('access_pending', {
  email: text('email').primaryKey(),
  requestedAt: text('requested_at').notNull(),
});

export const otpCodes = pgTable('otp_codes', {
  email: text('email').primaryKey(),
  code: text('code').notNull(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  attempts: integer('attempts').notNull().default(0),
});

export const statsEvents = pgTable(
  'stats_events',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(), // w tym specjalny bucket 'share'
    date: text('date').notNull(), // YYYY-MM-DD
    event: jsonb('event').$type<StatsEvent>().notNull(),
  },
  (t) => [index('stats_events_user_date_idx').on(t.userId, t.date)]
);
