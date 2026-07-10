import type { Waypoint } from '../config/schema/track';

export interface LapRecord {
  lapNumber: number;
  timeMs: number;
}

export interface LapTrackerState {
  currentLap: number;
  totalLaps: number;
  lastLapMs: number | null;
  bestLapMs: number | null;
  finished: boolean;
}

/**
 * Progreso de una carrera: exige pasar por los waypoints del circuito EN
 * ORDEN (el primero, `start_finish`, es tanto la salida como la meta) para
 * contar una vuelta como válida — así no vale con tocar la línea de meta
 * sin dar la vuelta completa, ni cortar por en medio del circuito.
 *
 * Es una máquina de estados pura (sin Phaser): se le da la posición del
 * coche y el tiempo transcurrido en cada frame, y expone el estado de la
 * carrera. Eso la hace fácil de testear y de reutilizar si el HUD cambia.
 */
export class LapTracker {
  private nextWaypointIndex: number;
  private currentLapNumber = 1;
  private lapStartMs = 0;
  private laps: LapRecord[] = [];
  private bestLapMs: number | null = null;
  private finished = false;

  constructor(
    private readonly waypoints: readonly Waypoint[],
    private readonly totalLaps: number,
    private readonly triggerRadius: number,
  ) {
    // El coche sale ya situado en waypoints[0] (start_finish): el primer
    // objetivo es el siguiente punto, no la propia salida.
    this.nextWaypointIndex = waypoints.length > 1 ? 1 : 0;
  }

  get currentLapStartMs(): number {
    return this.lapStartMs;
  }

  /** Índice del próximo waypoint al que hay que llegar (para señalarlo en pantalla). */
  get nextTargetIndex(): number {
    return this.nextWaypointIndex;
  }

  update(x: number, y: number, elapsedMs: number): void {
    if (this.finished || this.waypoints.length === 0) return;

    const targetIndex = this.nextWaypointIndex;
    const target = this.waypoints[targetIndex];
    const distance = Math.hypot(x - target.x, y - target.y);
    if (distance > this.triggerRadius) return;

    // Objetivo alcanzado: el siguiente pasa a ser el de después (con vuelta
    // al principio del array). Esto solo marca a qué checkpoint apuntar
    // después; NO decide todavía si se ha completado una vuelta (eso
    // depende del checkpoint que se acaba de alcanzar, no del siguiente).
    this.nextWaypointIndex = (targetIndex + 1) % this.waypoints.length;

    if (targetIndex !== 0) return; // era un checkpoint intermedio, no la meta

    // El checkpoint alcanzado (targetIndex === 0) es la propia meta: solo se
    // llega a apuntar a ella tras haber pasado antes por todos los demás en
    // orden, así que cruzarla aquí sí es una vuelta completa.
    const lapTimeMs = elapsedMs - this.lapStartMs;
    this.laps.push({ lapNumber: this.currentLapNumber, timeMs: lapTimeMs });
    this.bestLapMs = this.bestLapMs === null ? lapTimeMs : Math.min(this.bestLapMs, lapTimeMs);
    this.lapStartMs = elapsedMs;

    if (this.currentLapNumber >= this.totalLaps) {
      this.finished = true;
    } else {
      this.currentLapNumber += 1;
    }
  }

  getState(): LapTrackerState {
    return {
      currentLap: Math.min(this.currentLapNumber, this.totalLaps),
      totalLaps: this.totalLaps,
      lastLapMs: this.laps.at(-1)?.timeMs ?? null,
      bestLapMs: this.bestLapMs,
      finished: this.finished,
    };
  }
}
