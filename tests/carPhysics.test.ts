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

  it('never exceeds maxSpeed even after many accelerating steps', () => {
    let state = stillState;
    for (let i = 0; i < 600; i++) {
      state = stepCarPhysics(state, { ...noSteerInput, throttle: 1 }, baseConfig, 1 / 60);
    }
    const speed = Math.hypot(state.vx, state.vy);
    expect(speed).toBeLessThanOrEqual(baseConfig.maxSpeed + 1e-6);
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

  describe('Arcade-Drift Dynamics (v0.4.1: derrape sostenido por acelerador, sin trompos)', () => {
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
      // 3 segundos a fondo: si no hubiera techo de estabilización, el
      // ángulo real (heading) daría vueltas y vueltas sin parar y el ratio
      // de deslizamiento subiría sin control hasta un patinazo total.
      const result = simulateFrames(fast, { throttle: 1, steer: 1, handbrake: false }, 180);
      expect(slipRatio(result)).toBeGreaterThan(0.5);
      expect(slipRatio(result)).toBeLessThan(0.98);
    });

    it('sustaining a drift keeps the slip ratio steady over time instead of climbing without bound', () => {
      const fast: CarState = { x: 0, y: 0, angle: 0, vx: 260, vy: 0 };
      const midway = simulateFrames(fast, { throttle: 1, steer: 1, handbrake: false }, 90);
      const later = simulateFrames(midway, { throttle: 1, steer: 1, handbrake: false }, 90);
      expect(Math.abs(slipRatio(later) - slipRatio(midway))).toBeLessThan(0.05);
    });

    it('releasing the accelerator mid-drift lets the slip die down quickly (throttle is what sustains it)', () => {
      const fast: CarState = { x: 0, y: 0, angle: 0, vx: 260, vy: 0 };
      const drifting = simulateFrames(fast, { throttle: 1, steer: 1, handbrake: false }, 90);
      const afterRelease = simulateFrames(drifting, { throttle: 0, steer: 0, handbrake: false }, 10);
      expect(slipRatio(afterRelease)).toBeLessThan(0.1);
    });

    it('steering alone without any throttle cannot sustain a drift the way holding the gas does', () => {
      const fast: CarState = { x: 0, y: 0, angle: 0, vx: 260, vy: 0 };
      const withThrottle = simulateFrames(fast, { throttle: 1, steer: 1, handbrake: false }, 90);
      const withoutThrottle = simulateFrames(fast, { throttle: 0, steer: 1, handbrake: false }, 90);
      expect(slipRatio(withoutThrottle)).toBeLessThan(slipRatio(withThrottle));
    });

    it('countersteering out of a drift always has full rotational authority, even near the slip ceiling', () => {
      const fast: CarState = { x: 0, y: 0, angle: 0, vx: 260, vy: 0 };
      const drifted = simulateFrames(fast, { throttle: 1, steer: 1, handbrake: false }, 120);
      const widening = stepCarPhysics(drifted, { throttle: 1, steer: 1, handbrake: false }, baseConfig, 1 / 60);
      const countersteering = stepCarPhysics(drifted, { throttle: 1, steer: -1, handbrake: false }, baseConfig, 1 / 60);
      const widenAngleDelta = Math.abs(widening.angle - drifted.angle);
      const counterAngleDelta = Math.abs(countersteering.angle - drifted.angle);
      expect(counterAngleDelta).toBeGreaterThan(widenAngleDelta);
    });

    it('handbrake alone (no throttle) is still enough to kick off a drift', () => {
      const cornering: CarState = { x: 0, y: 0, angle: 0, vx: 220, vy: 0 };
      const result = simulateFrames(cornering, { throttle: 0, steer: 1, handbrake: true }, 20);
      expect(isSkidding(result)).toBe(true);
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
