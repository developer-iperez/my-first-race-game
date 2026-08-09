import Phaser from 'phaser';

/**
 * Reconstruye el objeto plano que espera `parseTrack` (mismo esquema de
 * siempre: rejillas surface/walls, surfaces, spawn, waypoints, laps, theme)
 * a partir de un Phaser.Tilemaps.Tilemap ya cargado desde un .tmj de Tiled.
 * Así TrackQuery.ts y el esquema Zod no necesitan saber que el circuito
 * viene de Tiled: siguen operando sobre la misma forma de datos de siempre.
 */

function mapProperty(map: Phaser.Tilemaps.Tilemap, name: string): unknown {
  const prop = (map.properties as { name: string; value: unknown }[] | undefined)?.find((p) => p.name === name);
  if (!prop) {
    throw new Error(`Circuito Tiled inválido: falta la propiedad de mapa "${name}"`);
  }
  return prop.value;
}

function requiredLayer(map: Phaser.Tilemaps.Tilemap, name: string): Phaser.Tilemaps.LayerData {
  const layer = map.getLayer(name);
  if (!layer) {
    throw new Error(`Circuito Tiled inválido: falta el layer de tiles "${name}"`);
  }
  return layer;
}

function objectProperty(obj: Phaser.Types.Tilemaps.TiledObject, name: string): unknown {
  const prop = (obj.properties as { name: string; value: unknown }[] | undefined)?.find((p) => p.name === name);
  return prop?.value;
}

export function buildTrackData(map: Phaser.Tilemaps.Tilemap): unknown {
  const surfaceLayer = requiredLayer(map, 'surface');
  const wallsLayer = requiredLayer(map, 'walls');

  const surfaces: Record<string, { grip: number; drag: number }> = {};
  const surfaceGrid: string[][] = [];
  const wallsGrid: number[][] = [];

  for (let row = 0; row < map.height; row++) {
    const surfaceRow: string[] = [];
    const wallRow: number[] = [];
    for (let col = 0; col < map.width; col++) {
      const surfaceTile = surfaceLayer.data[row][col];
      const wallTile = wallsLayer.data[row][col];

      // El tile de muro (dibujado en el layer visual "surface" para tapar
      // la superficie en las celdas de colisión, igual que antes) solo
      // lleva la propiedad "isWall", no "surfaceKey": no hace falta un
      // material real ahí, porque en cuanto isWallAt() es true la fricción
      // de fuera-de-pista (RaceScene.ts) manda sobre cualquier grip/drag.
      const surfaceKey = (surfaceTile?.properties as { surfaceKey?: string })?.surfaceKey ?? 'wall';
      surfaceRow.push(surfaceKey);
      if (surfaceKey !== 'wall' && !(surfaceKey in surfaces)) {
        const { grip, drag } = surfaceTile.properties as { grip?: number; drag?: number };
        if (grip !== undefined && drag !== undefined) {
          surfaces[surfaceKey] = { grip, drag };
        }
      }

      wallRow.push(wallTile && wallTile.index !== -1 ? 1 : 0);
    }
    surfaceGrid.push(surfaceRow);
    wallsGrid.push(wallRow);
  }

  const waypointsLayer = map.getObjectLayer('waypoints');
  if (!waypointsLayer) {
    throw new Error('Circuito Tiled inválido: falta el object layer "waypoints"');
  }

  let spawn: { x: number; y: number; angle: number } | undefined;
  const waypoints: Record<string, unknown>[] = [];
  for (const obj of waypointsLayer.objects) {
    const angle = objectProperty(obj, 'angle') as number | undefined;
    if (obj.type === 'spawn') {
      spawn = { x: obj.x ?? 0, y: obj.y ?? 0, angle: angle ?? 0 };
      continue;
    }
    const waypoint: Record<string, unknown> = { x: obj.x, y: obj.y, type: obj.type };
    if (obj.type === 'start_finish') {
      if (angle !== undefined) waypoint.angle = angle;
      const width = objectProperty(obj, 'width') as number | undefined;
      if (width !== undefined) waypoint.width = width;
    }
    waypoints.push(waypoint);
  }
  if (!spawn) {
    throw new Error('Circuito Tiled inválido: falta el objeto "spawn" en el layer "waypoints"');
  }

  return {
    schemaVersion: mapProperty(map, 'schemaVersion'),
    id: mapProperty(map, 'id'),
    name: mapProperty(map, 'name'),
    size: { width: map.widthInPixels, height: map.heightInPixels },
    tileSize: map.tileWidth,
    surfaces,
    layers: { surface: surfaceGrid, walls: wallsGrid },
    spawn,
    waypoints,
    laps: mapProperty(map, 'laps'),
    theme: mapProperty(map, 'theme'),
  };
}
