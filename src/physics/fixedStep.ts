/**
 * Bucle de simulación con paso fijo.
 *
 * El juego no puede usar el `delta` del frame directamente para la física:
 * un tirón de framerate, un cambio de pestaña o una caída a 20 fps movían el
 * coche distancias distintas y podían atravesar muros. Este acumulador
 * consume el tiempo real en pasos de duración constante, de modo que el
 * mismo input produce el mismo resultado a 30, 60 o 144 fps.
 *
 * Es una clase pequeña y sin Phaser, para poder testearla en Node.
 */

export interface FixedStepOptions {
  /** Pasos de simulación por segundo. Por defecto 120 Hz. */
  hz?: number;
  /** Delta máximo que se acepta de un frame (evita saltos tras un freeze). */
  maxFrameDeltaSeconds?: number;
  /** Máximo de pasos por frame (evita la "espiral de la muerte"). */
  maxSubsteps?: number;
}

export const DEFAULT_PHYSICS_HZ = 120;
/** Un frame de más de 250 ms se considera un freeze, no tiempo jugable. */
export const DEFAULT_MAX_FRAME_DELTA_SECONDS = 0.25;
export const DEFAULT_MAX_SUBSTEPS = 8;

export class FixedStepLoop {
  readonly hz: number;
  readonly fixedDt: number;
  readonly maxFrameDeltaSeconds: number;
  readonly maxSubsteps: number;

  private accumulatorSeconds = 0;

  constructor(options: FixedStepOptions = {}) {
    this.hz = options.hz ?? DEFAULT_PHYSICS_HZ;
    this.maxFrameDeltaSeconds = options.maxFrameDeltaSeconds ?? DEFAULT_MAX_FRAME_DELTA_SECONDS;
    this.maxSubsteps = options.maxSubsteps ?? DEFAULT_MAX_SUBSTEPS;

    if (!(this.hz > 0) || !Number.isFinite(this.hz)) {
      throw new Error(`FixedStepLoop: hz debe ser un número positivo (recibido ${this.hz})`);
    }
    if (!(this.maxFrameDeltaSeconds > 0) || !Number.isFinite(this.maxFrameDeltaSeconds)) {
      throw new Error(
        `FixedStepLoop: maxFrameDeltaSeconds debe ser un número positivo (recibido ${this.maxFrameDeltaSeconds})`,
      );
    }
    if (!Number.isInteger(this.maxSubsteps) || this.maxSubsteps <= 0) {
      throw new Error(`FixedStepLoop: maxSubsteps debe ser un entero positivo (recibido ${this.maxSubsteps})`);
    }

    this.fixedDt = 1 / this.hz;
  }

  /**
   * Avanza la simulación con el tiempo transcurrido desde el último frame.
   *
   * `step` recibe siempre `fixedDt` y puede devolver `false` para detener el
   * bucle (por ejemplo, al terminar la carrera a mitad de frame). Devuelve
   * cuántos pasos se han ejecutado.
   */
  advance(deltaSeconds: number, step: (dt: number) => boolean | void): number {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;

    this.accumulatorSeconds += Math.min(deltaSeconds, this.maxFrameDeltaSeconds);

    let steps = 0;
    while (this.accumulatorSeconds + 1e-9 >= this.fixedDt && steps < this.maxSubsteps) {
      const shouldContinue = step(this.fixedDt);
      this.accumulatorSeconds -= this.fixedDt;
      if (this.accumulatorSeconds < 0) this.accumulatorSeconds = 0;
      steps += 1;

      if (shouldContinue === false) {
        this.accumulatorSeconds = 0;
        return steps;
      }
    }

    // Si se ha llegado al límite de subpasos, se descarta el tiempo restante
    // en vez de arrastrarlo: es preferible ralentizar un frame a acumular
    // deuda y dar un salto enorme en el siguiente.
    if (steps >= this.maxSubsteps) {
      this.accumulatorSeconds = 0;
    }

    return steps;
  }

  /** Tiempo pendiente que aún no ha llegado a formar un paso completo. */
  get pendingSeconds(): number {
    return this.accumulatorSeconds;
  }

  /** Interpolación 0..1 dentro del paso actual, útil para render suave. */
  get alpha(): number {
    return this.accumulatorSeconds / this.fixedDt;
  }

  /** Descarta el tiempo acumulado (pausa, reanudación, reinicio de escena). */
  reset(): void {
    this.accumulatorSeconds = 0;
  }
}
