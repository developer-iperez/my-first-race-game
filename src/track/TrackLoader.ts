import Phaser from 'phaser';
import { parseTrack, type TrackDefinition } from '../config/schema/track';
import { buildTrackData } from './TiledMapAdapter';

/**
 * Carga y valida circuitos definidos por datos: un .tmj exportado de Tiled
 * (public/tracks/*.json). La escena solo pide "el circuito con esta key",
 * nunca conoce un circuito concreto: añadir uno nuevo no requiere tocar
 * este fichero. El adaptador de Tiled reconstruye el mismo TrackDefinition
 * de siempre, así que TrackQuery.ts y el resto del juego no cambian.
 */
export class TrackLoader {
  static enqueue(scene: Phaser.Scene, key: string, url: string): void {
    scene.load.tilemapTiledJSON(key, url);
  }

  static get(scene: Phaser.Scene, key: string): { track: TrackDefinition; map: Phaser.Tilemaps.Tilemap } {
    const map = scene.make.tilemap({ key });
    const track = parseTrack(buildTrackData(map));
    return { track, map };
  }
}
