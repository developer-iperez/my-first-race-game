import Phaser from 'phaser';
import type { TrackDefinition, Waypoint } from '../config/schema/track';

/**
 * Dibuja un circuito a partir de su TrackDefinition, usando los tiles de
 * pixel art precargados en BootScene (uno por superficie, más uno de
 * muro). La clave de textura de cada superficie es un mapeo fijo aquí, no
 * parte del esquema de datos: el JSON del circuito solo dice qué
 * superficie hay en cada celda, no de qué imagen se pinta.
 */
const SURFACE_TEXTURE_KEYS: Record<string, string> = {
  asphalt: 'tile-asphalt',
  grass: 'tile-grass',
  sand: 'tile-sand',
};
const WALL_TEXTURE_KEY = 'tile-wall';
const FALLBACK_TEXTURE_KEY = 'tile-grass';

export function renderTrack(scene: Phaser.Scene, track: TrackDefinition): void {
  const { tileSize } = track;

  track.layers.surface.forEach((row, rowIndex) => {
    row.forEach((surfaceKey, colIndex) => {
      const isWall = track.layers.walls[rowIndex]?.[colIndex] === 1;
      const textureKey = isWall
        ? WALL_TEXTURE_KEY
        : (SURFACE_TEXTURE_KEYS[surfaceKey] ?? FALLBACK_TEXTURE_KEY);
      scene.add
        .image(colIndex * tileSize, rowIndex * tileSize, textureKey)
        .setOrigin(0, 0)
        .setDisplaySize(tileSize, tileSize);
    });
  });

  // Marcadores de meta/checkpoints por encima de los tiles.
  const graphics = scene.add.graphics();
  for (const waypoint of track.waypoints) {
    if (waypoint.type === 'start_finish' && waypoint.angle !== undefined && waypoint.width !== undefined) {
      drawCheckeredLine(graphics, waypoint);
      continue;
    }
    const color = waypoint.type === 'start_finish' ? 0xffffff : 0xffff00;
    const radius = waypoint.type === 'start_finish' ? 9 : 7;
    graphics.fillStyle(color, 0.25);
    graphics.fillCircle(waypoint.x, waypoint.y, radius);
    graphics.lineStyle(2, color, 1);
    graphics.strokeCircle(waypoint.x, waypoint.y, radius);
  }
}

const CHECKER_SQUARE = 8;

/**
 * Meta clásica a cuadros: una franja de dos filas perpendicular a la
 * dirección de carrera (waypoint.angle, misma convención que spawn.angle),
 * centrada en el waypoint y con la anchura definida en el propio circuito
 * (waypoint.width) — la geometría es dato, no una decisión del renderer.
 */
function drawCheckeredLine(graphics: Phaser.GameObjects.Graphics, waypoint: Waypoint): void {
  const { x, y, angle = 0, width = CHECKER_SQUARE * 4 } = waypoint;
  const count = Math.max(2, Math.round(width / CHECKER_SQUARE));
  const start = -(count * CHECKER_SQUARE) / 2;

  graphics.save();
  graphics.translateCanvas(x, y);
  // Perpendicular a la dirección de carrera, con la misma convención de
  // ángulos que el resto del juego (0 = +x, 90 = +y).
  graphics.rotateCanvas(Phaser.Math.DegToRad(angle + 90));

  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < count; i++) {
      const isWhite = (i + row) % 2 === 0;
      graphics.fillStyle(isWhite ? 0xffffff : 0x111111, 1);
      graphics.fillRect(
        start + i * CHECKER_SQUARE,
        -CHECKER_SQUARE + row * CHECKER_SQUARE,
        CHECKER_SQUARE,
        CHECKER_SQUARE,
      );
    }
  }

  graphics.restore();
}
