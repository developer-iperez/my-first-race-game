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
  }

  create(): void {
    this.scene.start('Race', { trackKey: 'track:rally-01', carKey: 'car:rally-hatch' });
  }
}
