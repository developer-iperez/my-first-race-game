import Phaser from 'phaser';
import { TrackLoader } from '../track/TrackLoader';
import { renderTrack } from '../track/TrackRenderer';
import { getSurfaceGripAt, isWallAt } from '../track/TrackQuery';
import { CarLoader } from '../entities/CarLoader';
import { Car } from '../entities/Car';
import { TouchControls } from '../input/TouchControls';
import type { CarInput } from '../physics/carPhysics';
import type { TrackDefinition } from '../config/schema/track';

interface RaceSceneData {
  trackKey: string;
  carKey: string;
}

/** Rebote simple al chocar contra un muro: frena y empuja hacia atrás. */
const WALL_BOUNCE_DAMPING = -0.3;

export class RaceScene extends Phaser.Scene {
  private track!: TrackDefinition;
  private car!: Car;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private handbrakeKey!: Phaser.Input.Keyboard.Key;
  private touchControls!: TouchControls;

  constructor() {
    super('Race');
  }

  create(data: RaceSceneData): void {
    this.track = TrackLoader.get(this, data.trackKey);
    const carDefinition = CarLoader.get(this, data.carKey);

    renderTrack(this, this.track);

    // Cámara fija encuadrando el circuito completo (F3): sin scroll.
    this.cameras.main.setBounds(0, 0, this.track.size.width, this.track.size.height);
    this.cameras.main.centerOn(this.track.size.width / 2, this.track.size.height / 2);

    const spawnAngleRad = Phaser.Math.DegToRad(this.track.spawn.angle);
    this.car = new Car(this, carDefinition, {
      x: this.track.spawn.x,
      y: this.track.spawn.y,
      angle: spawnAngleRad,
      vx: 0,
      vy: 0,
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.handbrakeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Controles táctiles: para tablet/móvil sin teclado físico. Se montan
    // como DOM aparte de Phaser (multi-touch real) y se combinan con el
    // teclado en readInput(), así que ambos funcionan a la vez.
    this.touchControls = new TouchControls(document.body);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.touchControls.destroy());
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const input = this.readInput();
    const surfaceGrip = getSurfaceGripAt(this.track, this.car.state.x, this.car.state.y);

    const previous = { ...this.car.state };
    this.car.update(dt, input, surfaceGrip);

    if (isWallAt(this.track, this.car.state.x, this.car.state.y)) {
      this.car.setState({
        ...previous,
        vx: previous.vx * WALL_BOUNCE_DAMPING,
        vy: previous.vy * WALL_BOUNCE_DAMPING,
      });
    }
  }

  private readInput(): CarInput {
    const touch = this.touchControls.state;

    let throttle = 0;
    if (this.cursors.up.isDown || touch.throttleUp) throttle += 1;
    if (this.cursors.down.isDown || touch.throttleDown) throttle -= 1;

    let steer = 0;
    if (this.cursors.left.isDown || touch.left) steer -= 1;
    if (this.cursors.right.isDown || touch.right) steer += 1;

    return {
      throttle,
      steer,
      handbrake: this.handbrakeKey.isDown || touch.handbrake,
    };
  }
}
