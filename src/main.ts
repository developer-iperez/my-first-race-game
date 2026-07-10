import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { RaceScene } from './scenes/RaceScene';

// Resolución interna baja (estética 90s), escalada con nearest-neighbor
// (ver index.html) hasta el tamaño de la ventana.
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 384,
  height: 224,
  pixelArt: true,
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'app',
    width: 384,
    height: 224,
  },
  scene: [BootScene, RaceScene],
};

new Phaser.Game(config);
