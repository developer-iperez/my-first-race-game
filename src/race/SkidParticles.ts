import Phaser from 'phaser';

/**
 * Partículas de humo/polvo tras el coche mientras derrapa (car.isSkidding).
 * Se posicionan detrás del morro cada frame y solo emiten mientras dura el
 * derrape — reutiliza la misma condición que ya dispara el sonido y el
 * tinte visual, sin duplicar la lógica de detección.
 */
export class SkidParticles {
  private readonly emitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.emitter = scene.add.particles(0, 0, 'particle-dust', {
      speed: { min: 4, max: 18 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.1, end: 2, ease: 'Sine.easeOut' },
      alpha: { start: 0.55, end: 0 },
      lifespan: 320,
      frequency: 35,
      quantity: 1,
    });
    this.emitter.stop();
    this.emitter.setDepth(40);
  }

  update(x: number, y: number, angle: number, skidding: boolean): void {
    if (skidding) {
      // Un poco por detrás del centro del coche (opuesto al morro).
      this.emitter.setPosition(x - Math.cos(angle) * 6, y - Math.sin(angle) * 6);
      if (!this.emitter.emitting) this.emitter.start();
    } else if (this.emitter.emitting) {
      this.emitter.stop();
    }
  }

  destroy(): void {
    this.emitter.destroy();
  }
}
