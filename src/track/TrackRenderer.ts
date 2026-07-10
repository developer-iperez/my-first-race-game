import Phaser from 'phaser';
import type { TrackDefinition } from '../config/schema/track';

/**
 * Dibuja un circuito a partir de su TrackDefinition. V1 no tiene tileset
 * final (docs/ROADMAP.md), así que pinta cada tile como un rectángulo de
 * color según su superficie; el color es solo una paleta de marcador de
 * posición, no forma parte del esquema de datos.
 */
const PLACEHOLDER_SURFACE_COLORS: Record<string, number> = {
  asphalt: 0x3a3a3a,
  grass: 0x2f6b2f,
  sand: 0xc2a05a,
};
const WALL_COLOR = 0x8b1a1a;

export function renderTrack(scene: Phaser.Scene, track: TrackDefinition): void {
  const graphics = scene.add.graphics();
  const { tileSize } = track;

  track.layers.surface.forEach((row, rowIndex) => {
    row.forEach((surfaceKey, colIndex) => {
      const isWall = track.layers.walls[rowIndex]?.[colIndex] === 1;
      const color = isWall
        ? WALL_COLOR
        : (PLACEHOLDER_SURFACE_COLORS[surfaceKey] ?? 0x555555);
      graphics.fillStyle(color, 1);
      graphics.fillRect(colIndex * tileSize, rowIndex * tileSize, tileSize, tileSize);
    });
  });

  for (const waypoint of track.waypoints) {
    const color = waypoint.type === 'start_finish' ? 0xffffff : 0xffff00;
    graphics.lineStyle(2, color, 1);
    graphics.strokeCircle(waypoint.x, waypoint.y, 4);
  }
}
