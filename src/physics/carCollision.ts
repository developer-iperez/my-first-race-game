import type { CarState } from './carPhysics';
import type { TrackDefinition } from '../config/schema/track';
import { getWallTileRectsInAabb, type WallTileRect } from '../track/TrackQuery';

/**
 * Colisión del coche contra la rejilla de muros.
 *
 * El coche se aproxima con una cápsula de 3 círculos (frontal, centro y
 * trasero). Se hace un sweep de cada círculo contra los tiles del tramo
 * recorrido para que a velocidad alta no se atraviese una pared, y después
 * se resuelven las penetraciones empujando el coche fuera y proyectando la
 * velocidad sobre la normal del muro. El resultado es deslizamiento, no un
 * rebote duro: el coche conserva la componente tangencial.
 *
 * Módulo puro (sin Phaser), para testearlo con circuitos sintéticos.
 */

export interface CarCollisionDimensions {
  length: number;
  width: number;
}

export interface CarCollisionImpact {
  x: number;
  y: number;
  normalX: number;
  normalY: number;
  /** Velocidad normal contra el muro en el momento del impacto (px/s). */
  speed: number;
}

export interface CarCollisionResult {
  state: CarState;
  impact: CarCollisionImpact | null;
  collided: boolean;
}

export interface CarCollisionOptions {
  /** Rebote mínimo al chocar. 0 = deslizar sin rebote. */
  restitution?: number;
  /** Por debajo de esta velocidad normal no se emite evento de impacto. */
  impactSpeedThreshold?: number;
  /** Iteraciones de resolución para esquinas y contactos múltiples. */
  maxIterations?: number;
}

interface Contact {
  normalX: number;
  normalY: number;
  penetration: number;
  pointX: number;
  pointY: number;
}

interface SweepHit {
  time: number;
  tile: WallTileRect;
  circleOffset: number;
}

const EPSILON = 1e-6;

function capsule(dimensions: CarCollisionDimensions): { radius: number; offsets: number[] } {
  const radius = Math.max(0, dimensions.width / 2);
  const halfLength = Math.max(radius, dimensions.length / 2);
  const offset = halfLength - radius;
  return { radius, offsets: [-offset, 0, offset] };
}

function circleCenter(state: CarState, offset: number): { x: number; y: number } {
  return {
    x: state.x + Math.cos(state.angle) * offset,
    y: state.y + Math.sin(state.angle) * offset,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Contacto de un círculo contra un tile. Si `requireOverlap` es false,
 * también devuelve la normal en el caso tangente (penetración 0), que es lo
 * que necesita el sweep justo en el punto de entrada.
 */
function contactAgainstTile(
  center: { x: number; y: number },
  radius: number,
  tile: WallTileRect,
  requireOverlap: boolean,
): Contact | null {
  const closestX = clamp(center.x, tile.x, tile.x + tile.width);
  const closestY = clamp(center.y, tile.y, tile.y + tile.height);
  const dx = center.x - closestX;
  const dy = center.y - closestY;
  const distanceSq = dx * dx + dy * dy;

  if (distanceSq > radius * radius && requireOverlap) return null;

  if (distanceSq > EPSILON * EPSILON) {
    const distance = Math.sqrt(distanceSq);
    return {
      normalX: dx / distance,
      normalY: dy / distance,
      penetration: Math.max(0, radius - distance),
      pointX: closestX,
      pointY: closestY,
    };
  }

  // Centro dentro del tile (o justo sobre un borde): se elige la salida más
  // corta. Esto solo debería ocurrir en un spawn inválido, un teletransporte
  // o tras un frame perdido; la resolución lo devuelve a una posición libre.
  const left = center.x - tile.x;
  const right = tile.x + tile.width - center.x;
  const top = center.y - tile.y;
  const bottom = tile.y + tile.height - center.y;
  const minimum = Math.min(left, right, top, bottom);

  if (minimum === left) {
    return {
      normalX: -1,
      normalY: 0,
      penetration: radius + left,
      pointX: tile.x,
      pointY: center.y,
    };
  }
  if (minimum === right) {
    return {
      normalX: 1,
      normalY: 0,
      penetration: radius + right,
      pointX: tile.x + tile.width,
      pointY: center.y,
    };
  }
  if (minimum === top) {
    return {
      normalX: 0,
      normalY: -1,
      penetration: radius + top,
      pointX: center.x,
      pointY: tile.y,
    };
  }
  return {
    normalX: 0,
    normalY: 1,
    penetration: radius + bottom,
    pointX: center.x,
    pointY: tile.y + tile.height,
  };
}

function findDeepestContact(
  state: CarState,
  track: TrackDefinition,
  dimensions: CarCollisionDimensions,
): Contact | null {
  const { radius, offsets } = capsule(dimensions);
  let deepest: Contact | null = null;

  for (const offset of offsets) {
    const center = circleCenter(state, offset);
    const tiles = getWallTileRectsInAabb(
      track,
      center.x - radius,
      center.y - radius,
      center.x + radius,
      center.y + radius,
    );

    for (const tile of tiles) {
      const contact = contactAgainstTile(center, radius, tile, true);
      if (contact && contact.penetration > (deepest?.penetration ?? 0) + EPSILON) {
        deepest = contact;
      }
    }
  }

  return deepest;
}

/**
 * Empuja el coche fuera de las paredes iterando el contacto más profundo.
 * Resolver uno a uno (en vez de sumar todas las penetraciones) evita
 * sobrecorregir en esquinas y es estable con varios círculos.
 */
function resolvePenetrations(
  initialState: CarState,
  track: TrackDefinition,
  dimensions: CarCollisionDimensions,
  maxIterations: number,
): { state: CarState; contacts: Contact[] } {
  let state = { ...initialState };
  const contacts: Contact[] = [];

  for (let i = 0; i < maxIterations; i++) {
    const contact = findDeepestContact(state, track, dimensions);
    if (!contact || contact.penetration <= EPSILON) break;

    state = {
      ...state,
      x: state.x + contact.normalX * (contact.penetration + EPSILON),
      y: state.y + contact.normalY * (contact.penetration + EPSILON),
    };
    contacts.push(contact);
  }

  return { state, contacts };
}

/** Sweep de un círculo (origen + desplazamiento) contra un AABB. */
function sweepCircleAgainstTile(
  startX: number,
  startY: number,
  deltaX: number,
  deltaY: number,
  radius: number,
  tile: WallTileRect,
): number | null {
  const minX = tile.x - radius;
  const maxX = tile.x + tile.width + radius;
  const minY = tile.y - radius;
  const maxY = tile.y + tile.height + radius;

  let tMin = 0;
  let tMax = 1;

  const axes: [number, number, number, number][] = [
    [startX, deltaX, minX, maxX],
    [startY, deltaY, minY, maxY],
  ];

  for (const [start, delta, min, max] of axes) {
    if (Math.abs(delta) < EPSILON) {
      if (start < min || start > max) return null;
      continue;
    }

    let t1 = (min - start) / delta;
    let t2 = (max - start) / delta;
    if (t1 > t2) [t1, t2] = [t2, t1];

    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }

  return tMin >= 0 && tMin <= 1 ? tMin : null;
}

function interpolateState(previous: CarState, next: CarState, t: number): CarState {
  return {
    x: previous.x + (next.x - previous.x) * t,
    y: previous.y + (next.y - previous.y) * t,
    angle: previous.angle + (next.angle - previous.angle) * t,
    vx: next.vx,
    vy: next.vy,
    yawRate: next.yawRate,
    lateralGrip: next.lateralGrip,
    reverseHold: next.reverseHold,
  };
}

function findSweepHit(
  previous: CarState,
  next: CarState,
  track: TrackDefinition,
  dimensions: CarCollisionDimensions,
): SweepHit | null {
  if (Math.hypot(next.x - previous.x, next.y - previous.y) < EPSILON) return null;

  const { radius, offsets } = capsule(dimensions);
  let earliest: SweepHit | null = null;

  for (const circleOffset of offsets) {
    const start = circleCenter(previous, circleOffset);
    const end = circleCenter(next, circleOffset);
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;

    const tiles = getWallTileRectsInAabb(
      track,
      Math.min(start.x, end.x) - radius,
      Math.min(start.y, end.y) - radius,
      Math.max(start.x, end.x) + radius,
      Math.max(start.y, end.y) + radius,
    );

    for (const tile of tiles) {
      const time = sweepCircleAgainstTile(start.x, start.y, deltaX, deltaY, radius, tile);
      // Un impacto en t≈0 significa que el círculo ya estaba tocando el
      // muro al empezar el paso. Tratarlo como colisión congelaría el coche
      // contra la pared al deslizar en paralelo; la resolución discreta del
      // estado siguiente se encarga de ese contacto.
      if (time !== null && time > EPSILON && (earliest === null || time < earliest.time - EPSILON)) {
        earliest = { time, tile, circleOffset };
      }
    }
  }

  return earliest;
}

function contactForSweep(
  state: CarState,
  hit: SweepHit,
  dimensions: CarCollisionDimensions,
): Contact | null {
  const { radius } = capsule(dimensions);
  return contactAgainstTile(circleCenter(state, hit.circleOffset), radius, hit.tile, false);
}

function applyVelocityResponse(
  state: CarState,
  contacts: Contact[],
  restitution: number,
  impactSpeedThreshold: number,
): { state: CarState; impact: CarCollisionImpact | null } {
  if (contacts.length === 0) return { state, impact: null };

  const unique = new Map<string, Contact>();
  for (const contact of contacts) {
    const key = `${contact.normalX.toFixed(4)},${contact.normalY.toFixed(4)}`;
    if (!unique.has(key)) unique.set(key, contact);
  }

  const initialVx = state.vx;
  const initialVy = state.vy;
  let strongest: { contact: Contact; speed: number } | null = null;

  for (const contact of unique.values()) {
    const normalSpeed = initialVx * contact.normalX + initialVy * contact.normalY;
    if (normalSpeed < 0 && (strongest === null || -normalSpeed > strongest.speed)) {
      strongest = { contact, speed: -normalSpeed };
    }
  }

  let vx = state.vx;
  let vy = state.vy;
  for (const contact of unique.values()) {
    const normalSpeed = vx * contact.normalX + vy * contact.normalY;
    if (normalSpeed < 0) {
      const bounce = normalSpeed * (1 + restitution);
      vx -= contact.normalX * bounce;
      vy -= contact.normalY * bounce;
    }
  }

  const impact =
    strongest && strongest.speed >= impactSpeedThreshold
      ? {
          x: strongest.contact.pointX,
          y: strongest.contact.pointY,
          normalX: strongest.contact.normalX,
          normalY: strongest.contact.normalY,
          speed: strongest.speed,
        }
      : null;

  return { state: { ...state, vx, vy }, impact };
}

/**
 * Resuelve la colisión entre el estado anterior y el resultante de la física.
 *
 * `previousState` se usa para el sweep continuo; `nextState` es la posición
 * propuesta por el motor. Devuelve el estado corregido y, si el golpe fue
 * suficientemente fuerte, un evento para audio/partículas.
 */
export function resolveCarCollision(
  previousState: CarState,
  nextState: CarState,
  track: TrackDefinition,
  dimensions: CarCollisionDimensions,
  options: CarCollisionOptions = {},
): CarCollisionResult {
  const restitution = options.restitution ?? 0.12;
  const impactSpeedThreshold = options.impactSpeedThreshold ?? 30;
  const maxIterations = options.maxIterations ?? 5;

  const sweep = findSweepHit(previousState, nextState, track, dimensions);
  let working = nextState;
  const contacts: Contact[] = [];
  let collided = false;

  if (sweep) {
    collided = true;
    working = interpolateState(previousState, nextState, Math.max(0, sweep.time - 1e-5));
    const sweepContact = contactForSweep(working, sweep, dimensions);
    if (sweepContact) contacts.push(sweepContact);
  }

  const resolved = resolvePenetrations(working, track, dimensions, maxIterations);
  if (resolved.contacts.length > 0) collided = true;
  contacts.push(...resolved.contacts);

  const response = applyVelocityResponse(resolved.state, contacts, restitution, impactSpeedThreshold);

  return {
    state: response.state,
    impact: response.impact,
    collided,
  };
}
