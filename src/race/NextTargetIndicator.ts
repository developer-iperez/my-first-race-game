import Phaser from 'phaser';

/**
 * Anillo pulsante sobre el próximo checkpoint/meta al que hay que llegar.
 * Sin esto, el jugador no tiene forma de saber hacia dónde conducir (los
 * waypoints son datos del circuito, no una ruta dibujada) — este indicador
 * resuelve a la vez "no sé por dónde ir" y "no veo la meta": siempre sabes
 * qué punto (parpadeante) es el que toca ahora mismo.
 */
export class NextTargetIndicator {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(50);
  }

  update(x: number, y: number, elapsedMs: number): void {
    const pulse = 4 + Math.sin(elapsedMs / 180) * 3;
    const radius = 12 + pulse;

    this.graphics.clear();
    this.graphics.fillStyle(0x00ff66, 0.18);
    this.graphics.fillCircle(x, y, radius);
    this.graphics.lineStyle(2, 0x00ff66, 1);
    this.graphics.strokeCircle(x, y, radius);
  }

  /** Oculta el indicador (p. ej. al terminar la carrera, ya no hay "próximo" objetivo). */
  hide(): void {
    this.graphics.clear();
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
