import type { GhostFrame } from './GhostStore';

/** 20 Hz: suficiente para un fantasma suave y ~30 KB por vuelta de 60 s. */
const SAMPLE_INTERVAL_MS = 50;
const MAX_DURATION_MS = 90_000;

/**
 * Graba la posición del coche durante una vuelta en frames compactos.
 * Se reinicia al empezar cada vuelta y se descarta si el jugador usa un
 * reset manual (R), para no guardar un fantasma con un teletransporte.
 */
export class GhostRecorder {
  private startMs = 0;
  private lastSampleMs = Number.NEGATIVE_INFINITY;
  private samples: GhostFrame[] = [];
  private valid = true;

  reset(elapsedMs: number): void {
    this.startMs = elapsedMs;
    this.lastSampleMs = Number.NEGATIVE_INFINITY;
    this.samples = [];
    this.valid = true;
  }

  /** Invalida la vuelta actual (reset con penalización). */
  discard(): void {
    this.valid = false;
    this.samples = [];
  }

  get isValid(): boolean {
    return this.valid;
  }

  record(elapsedMs: number, x: number, y: number, angle: number): void {
    if (!this.valid) return;
    const relativeMs = elapsedMs - this.startMs;
    if (relativeMs < 0 || relativeMs > MAX_DURATION_MS) return;
    if (this.lastSampleMs !== Number.NEGATIVE_INFINITY && elapsedMs - this.lastSampleMs < SAMPLE_INTERVAL_MS) {
      return;
    }
    this.push(relativeMs, x, y, angle);
    this.lastSampleMs = elapsedMs;
  }

  /** Fuerza una muestra final (cruce de meta) aunque no toque por intervalo. */
  forceSample(elapsedMs: number, x: number, y: number, angle: number): void {
    if (!this.valid) return;
    const relativeMs = elapsedMs - this.startMs;
    if (relativeMs < 0 || relativeMs > MAX_DURATION_MS) return;
    this.push(relativeMs, x, y, angle);
    this.lastSampleMs = elapsedMs;
  }

  getSamples(): GhostFrame[] {
    return this.samples;
  }

  private push(relativeMs: number, x: number, y: number, angle: number): void {
    this.samples.push([
      Math.round(relativeMs),
      Math.round(x * 10) / 10,
      Math.round(y * 10) / 10,
      Math.round(angle * 1000) / 1000,
    ]);
  }
}
