import { Panorama } from './hotspot';

export interface Project {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  configPath: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  groupIds: string[];
  isPublished: boolean;
  panoramaCount: number;
}

export interface ProjectsData {
  projects: Project[];
}

export interface ProjectSettings {
  autoRotate: boolean;
  autoRotateSpeed: number;
  autoRotateDelay: number;
  cameraFov: number;
  optimizePanoramaForScreen: boolean;
  controlBar: boolean;
  splashDuration: number;
  fadeDuration: number;
}

export interface ProjectMetadata {
  author: string;
  client: string;
  tags: string[];
}

export interface ProjectConfig {
  version: string;
  projectName: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  panoramas: Panorama[];
  metadata: ProjectMetadata;
}
