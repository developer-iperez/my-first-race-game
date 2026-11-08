import Phaser from 'phaser';

/**
 * Partículas de humo/polvo tras el coche mientras derrapa (car.isSkidding).
 * Se posicionan detrás del morro cada frame y solo emiten mientras dura el
 * derrape — reutiliza la misma condición que ya dispara el sonido y el
 * tinte visual, sin duplicar la lógica de detección.
 */
const SURFACE_TINTS: Record<string, number> = {
  asphalt: 0x555555,
  grass: 0x5f8f3f,
  sand: 0xd8c08a,
  dirt: 0x8a6a4a,
  offtrack: 0x9a8b6a,
  wall: 0x8a6a4a,
};

export class SkidParticles {
  private readonly emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private currentSurfaceKey = '';

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

  update(x: number, y: number, angle: number, skidding: boolean, surfaceKey = 'asphalt'): void {
    this.setSurface(surfaceKey);

    if (skidding) {
      // Un poco por detrás del centro del coche (opuesto al morro).
      this.emitter.setPosition(x - Math.cos(angle) * 6, y - Math.sin(angle) * 6);
      if (!this.emitter.emitting) this.emitter.start();
    } else if (this.emitter.emitting) {
      this.emitter.stop();
    }
  }

  private setSurface(surfaceKey: string): void {
    if (surfaceKey === this.currentSurfaceKey) return;
    this.currentSurfaceKey = surfaceKey;
    this.emitter.setParticleTint(SURFACE_TINTS[surfaceKey] ?? 0x999999);
  }

  /** Golpe contra un muro: una ráfaga corta de polvo en el punto de impacto. */
  emitImpact(x: number, y: number, speed: number): void {
    const count = Math.min(12, Math.max(3, Math.round(speed / 35)));
    this.emitter.explode(count, x, y);
  }

  destroy(): void {
    this.emitter.destroy();
  }
}
