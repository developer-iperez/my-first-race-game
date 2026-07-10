import Phaser from 'phaser';
import { parseCar, type CarDefinition } from '../config/schema/car';

/**
 * Carga y valida vehículos definidos por datos (public/cars/*.json).
 * Añadir un coche nuevo (más o menos peso, potencia, longitud...) es crear
 * un fichero que cumpla el esquema; esta clase no conoce ningún coche en
 * particular.
 */
export class CarLoader {
  static enqueue(scene: Phaser.Scene, key: string, url: string): void {
    scene.load.json(key, url);
  }

  static get(scene: Phaser.Scene, key: string): CarDefinition {
    const raw = scene.cache.json.get(key);
    if (!raw) {
      throw new Error(`Coche "${key}" no encontrado en caché (¿faltó enqueue/preload?)`);
    }
    return parseCar(raw);
  }
}
