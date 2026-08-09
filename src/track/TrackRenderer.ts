import Phaser from 'phaser';
import type { TrackDefinition, Waypoint } from '../config/schema/track';

/**
 * Dibuja un circuito: el layer visual "surface" del tilemap (rejilla de
 * asfalto/hierba/arena, con los tiles de muro pintados encima como en el
 * JSON original) más los marcadores de meta/checkpoints, dibujados igual
 * que siempre a partir de `track.waypoints`. El layer "walls" del tilemap
 * es solo lógico (colisión, ver TiledMapAdapter/TrackQuery) y no se
 * renderiza aquí.
 */
const TILESET_NAME = 'rally-tiles';
const TILESET_IMAGE_KEY = 'tileset';

export function renderTrack(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap, track: TrackDefinition): void {
  const tileset = map.addTilesetImage(TILESET_NAME, TILESET_IMAGE_KEY);
  if (!tileset) {
    throw new Error(`No se pudo cargar el tileset "${TILESET_NAME}" (¿falta precargar "${TILESET_IMAGE_KEY}"?)`);
  }
  map.createLayer('surface', tileset, 0, 0);

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
