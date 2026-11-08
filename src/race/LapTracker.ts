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

/** Por debajo de esta velocidad no se exige dirección (coasteando/casi parado no es "ir marcha atrás"). */
const MIN_SPEED_FOR_DIRECTION_CHECK = 5;

/**
 * Progreso de una carrera: exige pasar por los waypoints del circuito EN
 * ORDEN (el primero, `start_finish`, es tanto la salida como la meta) para
 * contar una vuelta como válida — así no vale con tocar la línea de meta
 * sin dar la vuelta completa, ni cortar por en medio del circuito.
 *
 * También exige cruzar cada waypoint en el sentido correcto: si el coche
 * va claramente marcha atrás o recorre el circuito al revés, no cuenta
 * (ver docs/CHANGELOG.md). El sentido esperado de cada waypoint se calcula
 * solo, como el vector desde el waypoint anterior hasta él — no hace falta
 * definirlo a mano en el JSON del circuito.
 *
 * Es una máquina de estados pura (sin Phaser): se le da la posición y
 * velocidad del coche y el tiempo transcurrido en cada frame, y expone el
 * estado de la carrera. Eso la hace fácil de testear y de reutilizar si el
 * HUD cambia.
 */
export class LapTracker {
  private nextWaypointIndex: number;
  private currentLapNumber = 1;
  private lapStartMs = 0;
  private laps: LapRecord[] = [];
  private bestLapMs: number | null;
  private finished = false;
  private previousX: number | null = null;
  private previousY: number | null = null;
  private readonly expectedDirections: { x: number; y: number }[];

  constructor(
    private readonly waypoints: readonly Waypoint[],
    private readonly totalLaps: number,
    private readonly triggerRadius: number,
    /**
     * Mejor vuelta ya conseguida antes de esta carrera (p. ej. guardada
     * entre sesiones, ver `BestLaps`), para que `bestLapMs` refleje el
     * récord real desde el primer frame en vez de empezar en null cada
     * vez que se reinicia la carrera.
     */
    initialBestLapMs: number | null = null,
  ) {
    this.bestLapMs = initialBestLapMs;
    // El coche sale ya situado en waypoints[0] (start_finish): el primer
    // objetivo es el siguiente punto, no la propia salida. La posición
    // anterior arranca en la salida para poder detectar el primer cruce de
    // puerta sin esperar un frame extra.
    this.previousX = waypoints[0]?.x ?? null;
    this.previousY = waypoints[0]?.y ?? null;
    this.nextWaypointIndex = waypoints.length > 1 ? 1 : 0;

    this.expectedDirections = waypoints.map((wp, i) => {
      const prev = waypoints[(i - 1 + waypoints.length) % waypoints.length];
      const dx = wp.x - prev.x;
      const dy = wp.y - prev.y;
      const length = Math.hypot(dx, dy) || 1;
      return { x: dx / length, y: dy / length };
    });
  }

  get currentLapStartMs(): number {
    return this.lapStartMs;
  }

  /** Índice del próximo waypoint al que hay que llegar (para señalarlo en pantalla). */
  get nextTargetIndex(): number {
    return this.nextWaypointIndex;
  }

  /** Última puerta superada; sirve para recolocar el coche tras un atasco. */
  get lastPassedWaypoint(): Waypoint {
    const index = (this.nextWaypointIndex - 1 + this.waypoints.length) % this.waypoints.length;
    return this.waypoints[index];
  }

  /**
   * Fija la posición anterior tras un reset manual. Evita que el primer
   * frame después de recolocar el coche interprete el teletransporte como un
   * cruce de puerta.
   */
  resetPreviousPosition(x: number, y: number): void {
    this.previousX = x;
    this.previousY = y;
  }

  update(x: number, y: number, vx: number, vy: number, elapsedMs: number): void {
    if (this.finished || this.waypoints.length === 0) return;

    if (this.previousX === null || this.previousY === null) {
      this.previousX = x;
      this.previousY = y;
      return;
    }

    const targetIndex = this.nextWaypointIndex;
    const target = this.waypoints[targetIndex];
    const crossed = this.crossesGate(target, targetIndex, this.previousX, this.previousY, x, y, vx, vy);

    this.previousX = x;
    this.previousY = y;
    if (!crossed) return;

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

  /**
   * Una puerta con `angle` + `width` se cruza como un segmento: se exige
   * cambiar de lado del plano en el sentido de carrera y pasar dentro de la
   * anchura. Sin esos datos se mantiene el comportamiento antiguo de círculo
   * de activación, para no romper circuitos antiguos.
   */
  private crossesGate(
    target: Waypoint,
    targetIndex: number,
    previousX: number,
    previousY: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
  ): boolean {
    if (target.angle !== undefined && target.width !== undefined) {
      const direction = {
        x: Math.cos((target.angle * Math.PI) / 180),
        y: Math.sin((target.angle * Math.PI) / 180),
      };
      const perpendicular = { x: -direction.y, y: direction.x };
      const previousAlong =
        (previousX - target.x) * direction.x + (previousY - target.y) * direction.y;
      const currentAlong = (x - target.x) * direction.x + (y - target.y) * direction.y;

      if (!(previousAlong <= 0 && currentAlong > 0)) return false;

      const denominator = currentAlong - previousAlong;
      const t = denominator !== 0 ? -previousAlong / denominator : 0;
      const crossingX = previousX + (x - previousX) * t;
      const crossingY = previousY + (y - previousY) * t;
      const lateral =
        (crossingX - target.x) * perpendicular.x + (crossingY - target.y) * perpendicular.y;

      return Math.abs(lateral) <= target.width / 2;
    }

    const distance = Math.hypot(x - target.x, y - target.y);
    if (distance > this.triggerRadius) return false;

    const speed = Math.hypot(vx, vy);
    if (speed > MIN_SPEED_FOR_DIRECTION_CHECK) {
      const expected = this.expectedDirections[targetIndex];
      if (vx * expected.x + vy * expected.y < 0) return false;
    }

    return true;
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
