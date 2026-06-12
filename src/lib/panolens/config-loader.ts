import { ProjectConfig, Panorama, Hotspot, Position3D } from '@/types';

export interface LegacyPanoramaConfig {
  panoramas: Array<{
    file: string;
    position: [number, number, number];
    links: Array<{
      to: number;
      position: [number, number, number];
    }>;
  }>;
  infospots?: Array<{
    panoramaIndex: number;
    position: [number, number, number];
    hoverText: string;
    clickText: string;
    visible: boolean;
  }>;
}

export function convertLegacyConfig(legacy: LegacyPanoramaConfig): ProjectConfig {
  const panoramas: Panorama[] = legacy.panoramas.map((pano, index) => {
    const hotspots: Hotspot[] = pano.links.map((link, linkIndex) => ({
      id: `hs-${index}-${linkIndex}`,
      type: 'link' as const,
      position: {
        x: link.position[0],
        y: link.position[1],
        z: link.position[2],
      },
      target: `pano-${String(link.to).padStart(3, '0')}`,
      title: `Przejdź do panoramy ${link.to + 1}`,
      icon: 'arrow-up',
      scale: 1.0,
    }));

    const infospots =
      legacy.infospots?.flatMap((info, infoIndex) =>
        info.panoramaIndex === index && info.visible
          ? [
              {
                id: `info-${index}-${infoIndex}`,
                type: 'info' as const,
                position: {
                  x: info.position[0],
                  y: info.position[1],
                  z: info.position[2],
                },
                title: info.hoverText,
                description: info.clickText,
                icon: 'info',
                scale: 1.0,
              },
            ]
          : []
      ) || [];

    return {
      id: `pano-${String(index).padStart(3, '0')}`,
      name: `Panorama ${index + 1}`,
      file: pano.file,
      thumbnail: `thumb_${pano.file}`,
      initialPosition: {
        x: pano.position[0],
        y: pano.position[1],
        z: pano.position[2],
      },
      hotspots: [...hotspots, ...infospots],
    };
  });

  return {
    version: '1.0',
    projectName: 'Imported Project',
    description: 'Imported from legacy config',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    panoramas,
    metadata: {
      author: 'CONCEPTFAB',
      client: '',
      tags: [],
    },
  };
}

export function position3DToArray(pos: Position3D): [number, number, number] {
  return [pos.x, pos.y, pos.z];
}

export function arrayToPosition3D(arr: [number, number, number]): Position3D {
  return { x: arr[0], y: arr[1], z: arr[2] };
}
