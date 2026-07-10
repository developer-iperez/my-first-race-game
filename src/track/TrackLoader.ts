import Phaser from 'phaser';
import { parseTrack, type TrackDefinition } from '../config/schema/track';

/**
 * Carga y valida circuitos definidos por datos (public/tracks/*.json).
 * La escena solo pide "el circuito con esta key", nunca conoce un circuito
 * concreto: añadir uno nuevo no requiere tocar este fichero.
 */
export class TrackLoader {
  static enqueue(scene: Phaser.Scene, key: string, url: string): void {
    scene.load.json(key, url);
  }

  static get(scene: Phaser.Scene, key: string): TrackDefinition {
    const raw = scene.cache.json.get(key);
    if (!raw) {
      throw new Error(`Circuito "${key}" no encontrado en caché (¿faltó enqueue/preload?)`);
    }
    return parseTrack(raw);
  }
}
