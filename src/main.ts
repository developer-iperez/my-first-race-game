import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { RaceScene } from './scenes/RaceScene';
import { showFatalError } from './debug/errorOverlay';

window.addEventListener('error', (event) => showFatalError(event.message));
window.addEventListener('unhandledrejection', (event) => showFatalError(String(event.reason)));

// Resolución interna baja (estética 90s), escalada con nearest-neighbor
// (ver index.html) hasta el tamaño de la ventana.
const config: Phaser.Types.Core.GameConfig = {
  // Canvas 2D, no WebGL: el render son solo formas simples (rectángulos,
  // círculos), no hace falta GPU/shaders y así evitamos incompatibilidades
  // de WebGL en navegadores/móviles menos habituales.
  type: Phaser.CANVAS,
  parent: 'app',
  width: 768,
  height: 448,
  pixelArt: true,
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'app',
    width: 768,
    height: 448,
  },
  scene: [BootScene, TitleScene, RaceScene],
};

try {
  new Phaser.Game(config);
} catch (err) {
  showFatalError(String(err));
}
