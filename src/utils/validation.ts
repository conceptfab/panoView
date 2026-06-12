import { z } from 'zod';

// User validation
const userRoleSchema = z.enum(['admin', 'user', 'editor']);

const userSchema = z.object({
  id: z.string(),
  email: z.email(),
  role: userRoleSchema,
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  lastLoginAt: z.iso.datetime().nullable(),
  groupIds: z.array(z.string()),
});

const usersDataSchema = z.object({
  users: z.array(userSchema),
});

// Group validation
const groupSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  createdAt: z.iso.datetime(),
  projectIds: z.array(z.string()),
});

const groupsDataSchema = z.object({
  groups: z.array(groupSchema),
});

// Access control validation
const accessRuleSchema = z.object({
  id: z.string(),
  pattern: z.string().min(1),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  notes: z.string(),
});

const pendingRequestSchema = z.object({
  email: z.email(),
  requestedAt: z.string(),
});

const accessControlSchema = z.object({
  whitelist: z.array(accessRuleSchema),
  blacklist: z.array(accessRuleSchema),
  pending: z.array(pendingRequestSchema).optional(),
});

// Share link validation
const shareLinkSchema = z.object({
  projectId: z.string(),
  token: z.string(),
  isActive: z.boolean(),
  pinHash: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const shareLinksDataSchema = z.object({
  links: z.array(shareLinkSchema),
});

// Project validation
const projectSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  thumbnailUrl: z.string(),
  configPath: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  createdBy: z.string(),
  groupIds: z.array(z.string()),
  isPublished: z.boolean(),
  panoramaCount: z.number().int().min(0),
});

const projectsDataSchema = z.object({
  projects: z.array(projectSchema),
});

// Position 3D validation
const position3DSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

// Hotspot validation
const hotspotTypeSchema = z.enum(['link', 'info']);

const baseHotspotSchema = z.object({
  id: z.string(),
  type: hotspotTypeSchema,
  position: position3DSchema,
  title: z.string().max(200),
  icon: z.string(),
  scale: z.number().min(0.1).max(10),
  color: z.string().optional(),
});

const linkHotspotSchema = baseHotspotSchema.extend({
  type: z.literal('link'),
  target: z.string(),
});

const infoHotspotSchema = baseHotspotSchema.extend({
  type: z.literal('info'),
  description: z.string().max(1000),
});

const hotspotSchema = z.discriminatedUnion('type', [
  linkHotspotSchema,
  infoHotspotSchema,
]);

// Panorama validation
const panoramaSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  file: z.string(),
  variants: z
    .array(
      z.object({
        file: z.string(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
    )
    .optional(),
  thumbnail: z.string(),
  initialPosition: position3DSchema,
  hotspots: z.array(hotspotSchema),
});

// Project config validation
const projectSettingsSchema = z.object({
  autoRotate: z.boolean(),
  autoRotateSpeed: z.number().min(0).max(10),
  autoRotateDelay: z.number().min(0),
  cameraFov: z.number().min(10).max(120),
  optimizePanoramaForScreen: z.boolean().default(true),
  controlBar: z.boolean(),
  splashDuration: z.number().min(0),
  fadeDuration: z.number().min(0),
});

const projectMetadataSchema = z.object({
  author: z.string(),
  client: z.string(),
  tags: z.array(z.string()),
});

export const projectConfigSchema = z.object({
  version: z.string(),
  projectName: z.string(),
  description: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  settings: projectSettingsSchema,
  panoramas: z.array(panoramaSchema),
  metadata: projectMetadataSchema,
});

// Login validation
export const loginSchema = z.object({
  email: z.email({ message: 'Nieprawidłowy adres email' }),
});
