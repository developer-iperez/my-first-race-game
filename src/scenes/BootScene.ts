import Phaser from 'phaser';
import { TrackLoader } from '../track/TrackLoader';
import { CarLoader } from '../entities/CarLoader';

/**
 * Precarga los datos (JSON) del circuito y el coche de la v1. Cuando haya
 * selector de circuito/vehículo, esta escena pasará a recibir las keys/urls
 * a cargar en vez de tenerlas fijas.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    TrackLoader.enqueue(this, 'track:rally-01', 'tracks/rally-01.json');
    CarLoader.enqueue(this, 'car:rally-hatch', 'cars/rally-hatch.json');

    // Sprites de pixel art (v0.3). Con un solo coche/circuito, se precargan
    // aquí directamente; cuando haya selector de varios, esto pasaría a
    // derivarse de appearance.sprite / theme una vez parseado el JSON.
    this.load.image('car-sprite', 'cars/rally-hatch.png');
    this.load.image('tile-asphalt', 'tiles/asphalt.png');
    this.load.image('tile-grass', 'tiles/grass.png');
    this.load.image('tile-sand', 'tiles/sand.png');
    this.load.image('tile-wall', 'tiles/wall.png');
  }

  create(): void {
    this.scene.start('Race', { trackKey: 'track:rally-01', carKey: 'car:rally-hatch' });
  }
}
