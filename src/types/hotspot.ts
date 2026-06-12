export type HotspotType = 'link' | 'info';

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface BaseHotspot {
  id: string;
  type: HotspotType;
  position: Position3D;
  title: string;
  icon: string;
  scale: number;
  color?: string;
}

export interface LinkHotspot extends BaseHotspot {
  type: 'link';
  target: string;
}

export interface InfoHotspot extends BaseHotspot {
  type: 'info';
  description: string;
}

export type Hotspot = LinkHotspot | InfoHotspot;

export interface PanoramaVariant {
  file: string;
  width: number;
  height: number;
}

export interface Panorama {
  id: string;
  name: string;
  file: string;
  variants?: PanoramaVariant[];
  thumbnail: string;
  initialPosition: Position3D;
  hotspots: Hotspot[];
}
