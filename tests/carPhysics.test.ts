import { describe, expect, it } from 'vitest';
import { stepCarPhysics, isSkidding, type CarState } from '../src/physics/carPhysics';
import type { CarPhysicsConfig } from '../src/config/schema/car';

const baseConfig: CarPhysicsConfig = {
  mass: 1,
  enginePower: 900,
  brakingPower: 1200,
  maxSpeed: 260,
  turnRate: 3.2,
  gripForward: 0.98,
  gripLateral: 0.9,
  handbrakeGrip: 0.6,
  length: 24,
  width: 12,
};

const stillState: CarState = { x: 0, y: 0, angle: 0, vx: 0, vy: 0 };
const noSteerInput = { throttle: 0, steer: 0, handbrake: false };

describe('stepCarPhysics', () => {
  it('accelerates forward when throttle is positive', () => {
    const result = stepCarPhysics(stillState, { ...noSteerInput, throttle: 1 }, baseConfig, 1 / 60);
    expect(result.vx).toBeGreaterThan(0);
    expect(result.x).toBeGreaterThan(0);
  });

  it('does not move with zero throttle from rest', () => {
    const result = stepCarPhysics(stillState, noSteerInput, baseConfig, 1 / 60);
    expect(result.vx).toBeCloseTo(0);
    expect(result.vy).toBeCloseTo(0);
  });

  it('reverses from rest, but accelerates backwards more gently than it accelerates forwards', () => {
    const forward = stepCarPhysics(stillState, { ...noSteerInput, throttle: 1 }, baseConfig, 1 / 60);
    const reverse = stepCarPhysics(stillState, { ...noSteerInput, throttle: -1 }, baseConfig, 1 / 60);
    // Marcha atrás: se mueve hacia -x...
    expect(reverse.vx).toBeLessThan(0);
    // ...pero con menos empuje que hacia delante (no debe usar el frenado
    // fuerte, que es incluso mayor que el motor).
    expect(Math.abs(reverse.vx)).toBeLessThan(Math.abs(forward.vx));
  });

  it('braking while moving forward is stronger than reverse acceleration (freno != marcha atrás)', () => {
    const movingForward: CarState = { x: 0, y: 0, angle: 0, vx: 150, vy: 0 };
    const braking = stepCarPhysics(movingForward, { ...noSteerInput, throttle: -1 }, baseConfig, 1 / 60);
    const reverseFromRest = stepCarPhysics(stillState, { ...noSteerInput, throttle: -1 }, baseConfig, 1 / 60);
    // El frenado (yendo hacia delante) aplica más deceleración que el
    // empuje de la marcha atrás desde parado.
    const brakingDelta = movingForward.vx - braking.vx; // cuánto ha frenado
    const reverseDelta = Math.abs(reverseFromRest.vx); // cuánto ha empujado atrás
    expect(brakingDelta).toBeGreaterThan(reverseDelta);
  });

  it('never exceeds maxSpeed even after many accelerating steps', () => {
    let state = stillState;
    for (let i = 0; i < 600; i++) {
      state = stepCarPhysics(state, { ...noSteerInput, throttle: 1 }, baseConfig, 1 / 60);
    }
    const speed = Math.hypot(state.vx, state.vy);
    expect(speed).toBeLessThanOrEqual(baseConfig.maxSpeed + 1e-6);
  });

  it('handbrake alone in a straight line actually brakes (not just a lateral-grip switch)', () => {
    const moving: CarState = { x: 0, y: 0, angle: 0, vx: 150, vy: 0 };
    const coasting = stepCarPhysics(moving, noSteerInput, baseConfig, 0.2);
    const handbraking = stepCarPhysics(moving, { throttle: 0, steer: 0, handbrake: true }, baseConfig, 0.2);
    expect(handbraking.vx).toBeLessThan(coasting.vx);
  });

  it('does not turn while stationary (parado no gira)', () => {
    const result = stepCarPhysics(stillState, { ...noSteerInput, steer: 1 }, baseConfig, 1 / 60);
    expect(result.angle).toBe(stillState.angle);
  });

  it('turns when moving and steering', () => {
    const moving: CarState = { x: 0, y: 0, angle: 0, vx: 100, vy: 0 };
    const result = stepCarPhysics(moving, { ...noSteerInput, steer: 1 }, baseConfig, 1 / 60);
    expect(result.angle).toBeGreaterThan(moving.angle);
  });

  it('is frame-rate independent for straight-line acceleration', () => {
    const bigStep = stepCarPhysics(stillState, { ...noSteerInput, throttle: 1 }, baseConfig, 1);
    let small = stillState;
    for (let i = 0; i < 60; i++) {
      small = stepCarPhysics(small, { ...noSteerInput, throttle: 1 }, baseConfig, 1 / 60);
    }
    expect(small.vx).toBeCloseTo(bigStep.vx, 0);
  });

  it('reducing lateral grip (handbrake) produces more skid than normal grip', () => {
    const cornering: CarState = { x: 0, y: 0, angle: 0, vx: 150, vy: 0 };
    const normal = stepCarPhysics(
      cornering,
      { throttle: 0, steer: 1, handbrake: false },
      baseConfig,
      0.2,
    );
    const handbraking = stepCarPhysics(
      cornering,
      { throttle: 0, steer: 1, handbrake: true },
      baseConfig,
      0.2,
    );
    const lateralOf = (s: CarState) => {
      const fwd = { x: Math.cos(s.angle), y: Math.sin(s.angle) };
      const right = { x: -fwd.y, y: fwd.x };
      return Math.abs(s.vx * right.x + s.vy * right.y);
    };
    expect(lateralOf(handbraking)).toBeGreaterThan(lateralOf(normal));
  });

  it('higher surface drag slows forward speed more (off-track deceleration)', () => {
    const moving: CarState = { x: 0, y: 0, angle: 0, vx: 150, vy: 0 };
    const onAsphalt = stepCarPhysics(moving, noSteerInput, baseConfig, 0.2, 1, 1);
    const onMud = stepCarPhysics(moving, noSteerInput, baseConfig, 0.2, 1, 3);
    expect(onMud.vx).toBeLessThan(onAsphalt.vx);
  });

  it('lower surface grip increases lateral sliding', () => {
    const cornering: CarState = { x: 0, y: 0, angle: 0, vx: 150, vy: 0 };
    const onAsphalt = stepCarPhysics(cornering, { throttle: 0, steer: 1, handbrake: false }, baseConfig, 0.2, 1);
    const onGrass = stepCarPhysics(cornering, { throttle: 0, steer: 1, handbrake: false }, baseConfig, 0.2, 0.5);
    const lateralOf = (s: CarState) => {
      const fwd = { x: Math.cos(s.angle), y: Math.sin(s.angle) };
      const right = { x: -fwd.y, y: fwd.x };
      return Math.abs(s.vx * right.x + s.vy * right.y);
    };
    expect(lateralOf(onGrass)).toBeGreaterThan(lateralOf(onAsphalt));
  });

  describe('derrape en curva (v0.4: espectacular pero manejable)', () => {
    const lateralOf = (s: CarState) => {
      const fwd = { x: Math.cos(s.angle), y: Math.sin(s.angle) };
      const right = { x: -fwd.y, y: fwd.x };
      return Math.abs(s.vx * right.x + s.vy * right.y);
    };

    it('cornering hard at high speed slides more than the same turn at low speed, without handbrake', () => {
      const fast: CarState = { x: 0, y: 0, angle: 0, vx: 240, vy: 0 };
      const slow: CarState = { x: 0, y: 0, angle: 0, vx: 40, vy: 0 };
      const input = { throttle: 0, steer: 1, handbrake: false };
      const fastResult = stepCarPhysics(fast, input, baseConfig, 0.2);
      const slowResult = stepCarPhysics(slow, input, baseConfig, 0.2);
      // Comparamos como fracción de la velocidad total para que no sea solo
      // "hay más velocidad luego hay más lateral" en términos absolutos.
      const fastRatio = lateralOf(fastResult) / Math.hypot(fastResult.vx, fastResult.vy);
      const slowRatio = lateralOf(slowResult) / Math.hypot(slowResult.vx, slowResult.vy);
      expect(fastRatio).toBeGreaterThan(slowRatio);
    });

    it('light steering at speed slides less than steering at full lock', () => {
      const cornering: CarState = { x: 0, y: 0, angle: 0, vx: 200, vy: 0 };
      const lightSteer = stepCarPhysics(cornering, { throttle: 0, steer: 0.2, handbrake: false }, baseConfig, 0.2);
      const fullSteer = stepCarPhysics(cornering, { throttle: 0, steer: 1, handbrake: false }, baseConfig, 0.2);
      expect(lateralOf(fullSteer)).toBeGreaterThan(lateralOf(lightSteer));
    });

    it('precise low-speed maneuvering keeps near-full grip (maniobrabilidad intacta)', () => {
      const crawling: CarState = { x: 0, y: 0, angle: 0, vx: 15, vy: 0 };
      const result = stepCarPhysics(crawling, { throttle: 0, steer: 1, handbrake: false }, baseConfig, 0.2);
      const ratio = lateralOf(result) / Math.hypot(result.vx, result.vy);
      expect(ratio).toBeLessThan(0.15);
    });

    it('steering authority does not collapse while sliding sideways (can countersteer out of a drift)', () => {
      const speed = 200;
      // Mismo módulo de velocidad, repartido distinto: uno todo hacia
      // delante, otro casi todo lateral (como a mitad de un derrape).
      const drivingStraight: CarState = { x: 0, y: 0, angle: 0, vx: speed, vy: 0 };
      const midDrift: CarState = { x: 0, y: 0, angle: 0, vx: speed * 0.2, vy: speed * 0.98 };
      const input = { throttle: 0, steer: 1, handbrake: false };
      const a = stepCarPhysics(drivingStraight, input, baseConfig, 1 / 60).angle;
      const b = stepCarPhysics(midDrift, input, baseConfig, 1 / 60).angle;
      // El giro conseguido debe ser comparable (mismo orden de magnitud),
      // no desplomarse porque la mayoría de la velocidad sea lateral.
      expect(Math.abs(b)).toBeGreaterThan(Math.abs(a) * 0.5);
    });

    // Estos tests anteriores usan un único paso con dt grande (0.2s) para
    // amplificar la diferencia y que sea fácil de comprobar, pero el juego
    // real avanza en pasos pequeños (dt ≈ 1/60s) muchas veces por segundo.
    // Con decaimiento exponencial por frame, un efecto que se ve claro en
    // un solo salto grande puede desvanecerse en pasos pequeños repetidos
    // (el lateral se cancela casi tan rápido como se genera). Por eso se
    // simula aquí igual que lo haría RaceScene: en bucle, con dt pequeño.
    function simulateFrames(
      initial: CarState,
      input: { throttle: number; steer: number; handbrake: boolean },
      frames: number,
    ): CarState {
      let state = initial;
      for (let i = 0; i < frames; i++) {
        state = stepCarPhysics(state, input, baseConfig, 1 / 60);
      }
      return state;
    }

    it('a sustained hard turn at speed actually skids at real 60fps frame steps', () => {
      const fast: CarState = { x: 0, y: 0, angle: 0, vx: 260, vy: 0 };
      const result = simulateFrames(fast, { throttle: 1, steer: 1, handbrake: false }, 60);
      expect(isSkidding(result)).toBe(true);
    });

    it('light steering at real 60fps frame steps stays well clear of the skid threshold', () => {
      const fast: CarState = { x: 0, y: 0, angle: 0, vx: 260, vy: 0 };
      const result = simulateFrames(fast, { throttle: 1, steer: 0.2, handbrake: false }, 60);
      expect(isSkidding(result)).toBe(false);
    });

    it('precise low-speed maneuvering at real 60fps frame steps never skids', () => {
      const crawling: CarState = { x: 0, y: 0, angle: 0, vx: 15, vy: 0 };
      const result = simulateFrames(crawling, { throttle: 0, steer: 1, handbrake: false }, 60);
      expect(isSkidding(result)).toBe(false);
    });
  });

  describe('inercia de giro (yawRate): el volante marca objetivo, no ángulo directo', () => {
    function simulateFrames(
      initial: CarState,
      input: { throttle: number; steer: number; handbrake: boolean },
      frames: number,
    ): CarState {
      let state = initial;
      for (let i = 0; i < frames; i++) {
        state = stepCarPhysics(state, input, baseConfig, 1 / 60);
      }
      return state;
    }

    const slipRatio = (s: CarState): number => {
      const fwd = { x: Math.cos(s.angle), y: Math.sin(s.angle) };
      const right = { x: -fwd.y, y: fwd.x };
      const lat = s.vx * right.x + s.vy * right.y;
      return Math.abs(lat) / Math.hypot(s.vx, s.vy);
    };

    it('holding full lock + throttle settles into a stable held drift, not a runaway spin', () => {
      const fast: CarState = { x: 0, y: 0, angle: 0, vx: 260, vy: 0 };
      // 3 segundos a fondo: sin la inercia de giro reduciendo la capacidad
      // de redirigir el morro mientras patina, esto podría descontrolarse;
      // el propio modelo (sin ningún techo artificial) debe converger solo.
      const result = simulateFrames(fast, { throttle: 1, steer: 1, handbrake: false }, 180);
      expect(slipRatio(result)).toBeGreaterThan(0.4);
      expect(slipRatio(result)).toBeLessThan(0.98);
    });

    it('sustaining full lock keeps the slip ratio steady over time instead of climbing without bound', () => {
      const fast: CarState = { x: 0, y: 0, angle: 0, vx: 260, vy: 0 };
      const midway = simulateFrames(fast, { throttle: 1, steer: 1, handbrake: false }, 90);
      const later = simulateFrames(midway, { throttle: 1, steer: 1, handbrake: false }, 90);
      expect(Math.abs(slipRatio(later) - slipRatio(midway))).toBeLessThan(0.05);
    });

    it('countersteering out of a drift reverses yaw rate gradually, not instantly (inertia, not a snap)', () => {
      const cornering: CarState = { x: 0, y: 0, angle: 0, vx: 220, vy: 0 };
      const drifted = simulateFrames(cornering, { throttle: 1, steer: 1, handbrake: false }, 30);
      const initialYawRate = drifted.yawRate ?? 0;
      expect(initialYawRate).toBeGreaterThan(0);

      // Un solo frame de contravolante no debería ya invertir el sentido de
      // giro de golpe: la inercia hace que tarde varios frames en "morder".
      const oneFrame = stepCarPhysics(drifted, { throttle: 1, steer: -1, handbrake: false }, baseConfig, 1 / 60);
      expect(oneFrame.yawRate ?? 0).toBeLessThan(initialYawRate);
      expect(oneFrame.yawRate ?? 0).toBeGreaterThan(-initialYawRate);

      // Pero sostenido varios frames, sí que llega a revertir el sentido de
      // giro por completo — el contravolante funciona, solo que no es
      // instantáneo.
      let s = drifted;
      for (let i = 0; i < 8; i++) s = stepCarPhysics(s, { throttle: 1, steer: -1, handbrake: false }, baseConfig, 1 / 60);
      expect(s.yawRate ?? 0).toBeLessThan(0);
    });

    it('countersteering held long enough visibly reduces the slip ratio compared to continuing to steer into the slide', () => {
      const cornering: CarState = { x: 0, y: 0, angle: 0, vx: 220, vy: 0 };
      const drifted = simulateFrames(cornering, { throttle: 1, steer: 1, handbrake: false }, 30);
      const widening = simulateFrames(drifted, { throttle: 1, steer: 1, handbrake: false }, 8);
      const countersteering = simulateFrames(drifted, { throttle: 1, steer: -1, handbrake: false }, 8);
      expect(slipRatio(countersteering)).toBeLessThan(slipRatio(widening));
    });

    it('good grip (light steering, low speed) responds to the wheel almost immediately, without a sluggish feel', () => {
      const fast: CarState = { x: 0, y: 0, angle: 0, vx: 260, vy: 0 };
      const oneFrame = stepCarPhysics(fast, { throttle: 1, steer: 0.3, handbrake: false }, baseConfig, 1 / 60);
      const target = 0.3 * baseConfig.turnRate * 1; // speedFactor≈1, turnDirection=1
      // Con agarre normal (sin patinar), el primer frame ya debe acercarse
      // bastante al objetivo, no arrastrar un retraso perceptible.
      expect(oneFrame.yawRate ?? 0).toBeGreaterThan(target * 0.5);
    });

    it('handbrake alone (no throttle) is still enough to kick off a drift', () => {
      const cornering: CarState = { x: 0, y: 0, angle: 0, vx: 220, vy: 0 };
      const result = simulateFrames(cornering, { throttle: 0, steer: 1, handbrake: true }, 20);
      expect(isSkidding(result)).toBe(true);
    });

    it('pulling the handbrake mid-corner slides more than continuing without it (not swallowed by cornering grip loss)', () => {
      const cornering: CarState = { x: 0, y: 0, angle: 0, vx: 150, vy: 0 };
      const midCorner = simulateFrames(cornering, { throttle: 1, steer: 1, handbrake: false }, 15);
      const withoutHandbrake = simulateFrames(midCorner, { throttle: 0, steer: 1, handbrake: false }, 15);
      const withHandbrake = simulateFrames(midCorner, { throttle: 0, steer: 1, handbrake: true }, 15);
      expect(slipRatio(withHandbrake)).toBeGreaterThan(slipRatio(withoutHandbrake));
    });

    it('a quick opposite-steer flick before turning in produces a bigger, sustained slide than turning in directly', () => {
      const straight: CarState = { x: 0, y: 0, angle: 0, vx: 150, vy: 0 };
      const flicked = simulateFrames(straight, { throttle: 1, steer: -1, handbrake: false }, 8);
      const afterFlick = simulateFrames(flicked, { throttle: 1, steer: 1, handbrake: false }, 12);
      const direct = simulateFrames(straight, { throttle: 1, steer: 1, handbrake: false }, 12);
      expect(slipRatio(afterFlick)).toBeGreaterThan(slipRatio(direct));
    });

    it('even a single-frame flick tap (not just a held one) still gives a noticeably bigger slide', () => {
      const straight: CarState = { x: 0, y: 0, angle: 0, vx: 150, vy: 0 };
      const flicked = stepCarPhysics(straight, { throttle: 1, steer: -1, handbrake: false }, baseConfig, 1 / 60);
      const afterFlick = simulateFrames(flicked, { throttle: 1, steer: 1, handbrake: false }, 12);
      const direct = simulateFrames(straight, { throttle: 1, steer: 1, handbrake: false }, 12);
      expect(slipRatio(afterFlick)).toBeGreaterThan(slipRatio(direct) * 1.2);
    });

    it('countersteering to recover an existing drift does not get treated as a fresh flick (no extra kick)', () => {
      // Mismo escenario que el test de contravolante de más arriba: el coche
      // YA está derrapando fuerte cuando se contravolantea para corregir.
      // El cambio de signo de yawRate es idéntico al de un flick, pero aquí
      // no debe sumar ningún empujón extra — si lo hiciera, "recoger" el
      // derrape en realidad lo alimentaría en vez de corregirlo.
      const cornering: CarState = { x: 0, y: 0, angle: 0, vx: 220, vy: 0 };
      const drifted = simulateFrames(cornering, { throttle: 1, steer: 1, handbrake: false }, 30);
      const widening = simulateFrames(drifted, { throttle: 1, steer: 1, handbrake: false }, 8);
      const countersteering = simulateFrames(drifted, { throttle: 1, steer: -1, handbrake: false }, 8);
      expect(slipRatio(countersteering)).toBeLessThan(slipRatio(widening));
    });
  });
});

describe('isSkidding', () => {
  it('is false for a stationary car', () => {
    expect(isSkidding(stillState)).toBe(false);
  });

  it('is true when lateral speed dominates', () => {
    const sliding: CarState = { x: 0, y: 0, angle: 0, vx: 0, vy: 100 };
    expect(isSkidding(sliding)).toBe(true);
  });

  it('is false when moving purely forward', () => {
    const straight: CarState = { x: 0, y: 0, angle: 0, vx: 100, vy: 0 };
    expect(isSkidding(straight)).toBe(false);
  });
});
