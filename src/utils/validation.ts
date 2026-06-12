import { z } from 'zod';

// User validation
export const userRoleSchema = z.enum(['admin', 'user', 'editor']);

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: userRoleSchema,
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable(),
  groupIds: z.array(z.string()),
});

export const usersDataSchema = z.object({
  users: z.array(userSchema),
});

// Group validation
export const groupSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  createdAt: z.string().datetime(),
  projectIds: z.array(z.string()),
});

export const groupsDataSchema = z.object({
  groups: z.array(groupSchema),
});

// Access control validation
export const accessRuleSchema = z.object({
  id: z.string(),
  pattern: z.string().min(1),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  notes: z.string(),
});

const pendingRequestSchema = z.object({
  email: z.string().email(),
  requestedAt: z.string(),
});

export const accessControlSchema = z.object({
  whitelist: z.array(accessRuleSchema),
  blacklist: z.array(accessRuleSchema),
  pending: z.array(pendingRequestSchema).optional(),
});

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

// Project validation
export const projectSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  thumbnailUrl: z.string(),
  configPath: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string(),
  groupIds: z.array(z.string()),
  isPublished: z.boolean(),
  panoramaCount: z.number().int().min(0),
});

export const projectsDataSchema = z.object({
  projects: z.array(projectSchema),
});

// Position 3D validation
export const position3DSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

// Hotspot validation
export const hotspotTypeSchema = z.enum(['link', 'info']);

export const baseHotspotSchema = z.object({
  id: z.string(),
  type: hotspotTypeSchema,
  position: position3DSchema,
  title: z.string().max(200),
  icon: z.string(),
  scale: z.number().min(0.1).max(10),
  color: z.string().optional(),
});

export const linkHotspotSchema = baseHotspotSchema.extend({
  type: z.literal('link'),
  target: z.string(),
});

export const infoHotspotSchema = baseHotspotSchema.extend({
  type: z.literal('info'),
  description: z.string().max(1000),
});

export const hotspotSchema = z.discriminatedUnion('type', [
  linkHotspotSchema,
  infoHotspotSchema,
]);

// Panorama validation
export const panoramaSchema = z.object({
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
export const projectSettingsSchema = z.object({
  autoRotate: z.boolean(),
  autoRotateSpeed: z.number().min(0).max(10),
  autoRotateDelay: z.number().min(0),
  cameraFov: z.number().min(10).max(120),
  optimizePanoramaForScreen: z.boolean().default(true),
  controlBar: z.boolean(),
  splashDuration: z.number().min(0),
  fadeDuration: z.number().min(0),
});

export const projectMetadataSchema = z.object({
  author: z.string(),
  client: z.string(),
  tags: z.array(z.string()),
});

export const projectConfigSchema = z.object({
  version: z.string(),
  projectName: z.string(),
  description: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  settings: projectSettingsSchema,
  panoramas: z.array(panoramaSchema),
  metadata: projectMetadataSchema,
});

// Login validation
export const loginSchema = z.object({
  email: z.string().email('Nieprawidłowy adres email'),
});

// Type exports
export type UserInput = z.infer<typeof userSchema>;
export type GroupInput = z.infer<typeof groupSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type ProjectConfigInput = z.infer<typeof projectConfigSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
