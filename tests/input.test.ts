import { describe, expect, it } from 'vitest';
import { InputManager, type DigitalInputState, type GamepadLike } from '../src/input/InputManager';

const noInput: DigitalInputState = {
  throttleUp: false,
  throttleDown: false,
  left: false,
  right: false,
  handbrake: false,
};

function sources(partial: Partial<DigitalInputState> = {}, gamepad: GamepadLike | null = null) {
  return {
    keyboard: { ...noInput, ...partial },
    touch: { ...noInput },
    gamepad,
  };
}

function gamepad(partial: Partial<GamepadLike> = {}): GamepadLike {
  return {
    axes: [0, 0],
    buttons: [],
    ...partial,
  };
}

describe('InputManager', () => {
  it('rampa el volante: no salta de 0 a 1 en un frame', () => {
    const manager = new InputManager();
    const first = manager.update(1 / 60, sources({ right: true }));
    expect(first.steer).toBeGreaterThan(0);
    expect(first.steer).toBeLessThan(0.2);

    let state = first;
    for (let i = 0; i < 8; i++) {
      state = manager.update(1 / 60, sources({ right: true }));
    }
    expect(state.steer).toBeCloseTo(1, 2);
  });

  it('devuelve el volante a centro al soltar, sin quedarse girado', () => {
    const manager = new InputManager();
    for (let i = 0; i < 20; i++) manager.update(1 / 60, sources({ right: true }));
    let state = manager.update(1 / 60, sources());
    expect(state.steer).toBeGreaterThan(0);

    for (let i = 0; i < 8; i++) state = manager.update(1 / 60, sources());
    expect(state.steer).toBeCloseTo(0, 2);
  });

  it('izquierda + derecha se cancelan', () => {
    const manager = new InputManager();
    for (let i = 0; i < 20; i++) {
      manager.update(1 / 60, sources({ left: true, right: true }));
    }
    const state = manager.update(1 / 60, sources({ left: true, right: true }));
    expect(state.steer).toBeCloseTo(0, 5);
  });

  it('combina teclado y táctil sin duplicar el acelerador', () => {
    const manager = new InputManager();
    const state = manager.update(1 / 60, {
      keyboard: { ...noInput, throttleUp: true },
      touch: { ...noInput, throttleUp: true },
      gamepad: null,
    });
    expect(state.throttle).toBe(1);
  });

  it('aplica zona muerta a los ejes del gamepad', () => {
    const manager = new InputManager();
    for (let i = 0; i < 30; i++) {
      manager.update(1 / 60, sources({}, gamepad({ axes: [0.1, 0] })));
    }
    const centered = manager.update(1 / 60, sources({}, gamepad({ axes: [0.1, 0] })));
    expect(centered.steer).toBeCloseTo(0, 5);

    for (let i = 0; i < 30; i++) {
      manager.update(1 / 60, sources({}, gamepad({ axes: [0.5, 0] })));
    }
    const analog = manager.update(1 / 60, sources({}, gamepad({ axes: [0.5, 0] })));
    expect(analog.steer).toBeCloseTo((0.5 - 0.15) / (1 - 0.15), 2);
  });

  it('el gamepad analógico tiene prioridad sobre las flechas', () => {
    const manager = new InputManager();
    for (let i = 0; i < 30; i++) {
      manager.update(1 / 60, sources({ left: true }, gamepad({ axes: [0.8, 0] })));
    }
    const state = manager.update(1 / 60, sources({ left: true }, gamepad({ axes: [0.8, 0] })));
    expect(state.steer).toBeGreaterThan(0);
  });

  it('lee gatillos, botones A/B y freno de mano del gamepad', () => {
    const manager = new InputManager();
    const withTriggers = manager.update(
      1 / 60,
      sources(
        {},
        gamepad({
          buttons: [
            { pressed: false, value: 0 },
            { pressed: false, value: 0 },
            { pressed: false, value: 0 },
            { pressed: false, value: 0 },
            { pressed: false, value: 0 },
            { pressed: true, value: 1 },
            { pressed: false, value: 0.2 },
            { pressed: false, value: 0.8 },
          ],
        }),
      ),
    );
    expect(withTriggers.throttle).toBeCloseTo(0.6, 2);
    expect(withTriggers.handbrake).toBe(true);

    const withButtons = manager.update(
      1 / 60,
      sources(
        {},
        gamepad({
          buttons: [
            { pressed: true, value: 1 },
            { pressed: false, value: 0 },
          ],
        }),
      ),
    );
    expect(withButtons.throttle).toBe(1);
  });

  it('reset vuelve el volante a centro', () => {
    const manager = new InputManager();
    for (let i = 0; i < 20; i++) manager.update(1 / 60, sources({ right: true }));
    manager.reset();
    const state = manager.update(1 / 60, sources());
    expect(state.steer).toBe(0);
  });

  it('ignora dt inválidos sin romper la rampa', () => {
    const manager = new InputManager();
    const state = manager.update(Number.NaN, sources({ right: true }));
    expect(state.steer).toBe(0);
  });
});
