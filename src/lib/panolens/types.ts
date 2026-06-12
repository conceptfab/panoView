/* eslint-disable @typescript-eslint/no-explicit-any */

// Type definitions for Panolens.js and Three.js (minimal)

export interface Vector3 {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z: number): this;
  clone(): Vector3;
}

export interface Vector2 {
  x: number;
  y: number;
  set(x: number, y: number): this;
}

export interface PanolensViewerOptions {
  container?: HTMLElement;
  controlBar?: boolean;
  cameraFov?: number;
  renderer?: any;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  autoRotateActivationDuration?: number;
}

export interface ImagePanorama {
  addEventListener(event: string, callback: () => void): void;
  removeEventListener(event: string, callback: () => void): void;
  add(object: any): void;
  link(
    panorama: ImagePanorama,
    position: Vector3,
    size: number,
    icon?: string
  ): void;
  traverse(callback: (obj: any) => void): void;
}

export interface Infospot {
  position: Vector3;
  visible: boolean;
  element?: HTMLElement;
  addHoverText(text: string): void;
  addEventListener(event: string, callback: () => void): void;
}

export interface OrbitControls {
  autoRotate: boolean;
  autoRotateSpeed: number;
  target: Vector3;
}

export interface PanolensViewer {
  container: HTMLElement;
  camera: { position: Vector3 };
  scene: { add(object: any): void; remove(object: any): void };
  panorama: ImagePanorama | null;
  OrbitControls: OrbitControls;
  options: PanolensViewerOptions;
  add(...panoramas: ImagePanorama[]): void;
  setPanorama(panorama: ImagePanorama): void;
  tweenControlCenter(position: Vector3, duration: number): void;
  enableAutoRate(): void;
  disableAutoRate(): void;
  addEventListener(event: string, callback: () => void): void;
  dispose(): void;
}

export interface Raycaster {
  setFromCamera(mouse: Vector2, camera: any): void;
  intersectObject(object: any, recursive: boolean): { point: Vector3 }[];
}

declare global {
  interface Window {
    THREE: {
      WebGLRenderer: new (options?: any) => any;
      Vector3: new (x?: number, y?: number, z?: number) => Vector3;
      Vector2: new (x?: number, y?: number) => Vector2;
      Raycaster: new () => Raycaster;
      CanvasTexture: new (canvas: HTMLCanvasElement) => any;
      SpriteMaterial: new (options?: any) => any;
      Sprite: new (material?: any) => any;
    };
    PANOLENS: {
      Viewer: new (options?: PanolensViewerOptions) => PanolensViewer;
      ImagePanorama: new (src: string) => ImagePanorama;
      Infospot: new (size: number, icon: string, animated?: boolean) => Infospot;
      DataImage: {
        Info: string;
      };
    };
    process?: { env: Record<string, string> };
  }
}
