import Phaser from 'phaser';
import { TrackLoader } from '../track/TrackLoader';
import { TRACK_CATALOG } from '../track/trackCatalog';
import { CarLoader } from '../entities/CarLoader';

/**
 * Precarga los datos (JSON) de todos los circuitos del catálogo y del
 * coche. Con un solo coche, se precarga aquí directamente; cuando haya
 * selector de vehículo, seguiría el mismo patrón que TRACK_CATALOG.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    for (const track of TRACK_CATALOG) {
      TrackLoader.enqueue(this, track.key, track.path);
    }
    CarLoader.enqueue(this, 'car:rally-hatch', 'cars/rally-hatch.json');

    // Sprites de pixel art (v0.3). Con un solo coche/circuito, se precargan
    // aquí directamente; cuando haya selector de varios, esto pasaría a
    // derivarse de appearance.sprite / theme una vez parseado el JSON.
    this.load.image('car-sprite', 'cars/rally-hatch.png');
    this.load.image('tile-asphalt', 'tiles/asphalt.png');
    this.load.image('tile-grass', 'tiles/grass.png');
    this.load.image('tile-sand', 'tiles/sand.png');
    this.load.image('tile-wall', 'tiles/wall.png');
    this.load.image('particle-dust', 'tiles/particle-dust.png');
    // Atlas empaquetado (asfalto/hierba/arena/muro, en ese orden) para el
    // tileset de Tiled que consume TrackRenderer.ts vía Phaser.Tilemaps.
    this.load.image('tileset', 'tiles/tileset.png');

    // Efectos de sonido sintetizados (v0.3), sin depender de bancos de
    // audio externos: motor (bucle), derrape (bucle), checkpoint y meta.
    this.load.audio('sfx-engine', 'audio/engine.wav');
    this.load.audio('sfx-skid', 'audio/skid.wav');
    this.load.audio('sfx-checkpoint', 'audio/checkpoint.wav');
    this.load.audio('sfx-finish', 'audio/finish.wav');
  }

  create(): void {
    // El circuito lo decide el jugador en el título (Settings.trackKey);
    // aquí solo hace falta el coche, único por ahora.
    this.scene.start('Title', { carKey: 'car:rally-hatch' });
  }
}
