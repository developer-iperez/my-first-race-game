import Phaser from 'phaser';
import type { CarDefinition } from '../config/schema/car';
import { stepCarPhysics, isSkidding, type CarInput, type CarState } from '../physics/carPhysics';

/**
 * Entidad de coche construida enteramente a partir de un CarDefinition
 * (JSON validado). No contiene ninguna constante de tuning propia: cambiar
 * de vehículo es cargar otro fichero, no tocar esta clase.
 *
 * V1 no tiene arte final (docs/ROADMAP.md), así que se representa con un
 * rectángulo de Graphics dimensionado por physics.length/width en vez de
 * cargar appearance.sprite.
 */
export class Car {
  state: CarState;
  readonly definition: CarDefinition;

  private readonly graphics: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Rectangle;
  private readonly nose: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, definition: CarDefinition, spawn: CarState) {
    this.definition = definition;
    this.state = { ...spawn };

    const { length, width } = definition.physics;
    this.body = scene.add.rectangle(0, 0, length, width, 0x2277cc);
    this.nose = scene.add.rectangle(length / 2 - 3, 0, 6, width * 0.6, 0xffcc00);
    this.graphics = scene.add.container(spawn.x, spawn.y, [this.body, this.nose]);
    this.graphics.setRotation(spawn.angle);
  }

  update(dt: number, input: CarInput, surfaceGrip = 1): void {
    this.setState(stepCarPhysics(this.state, input, this.definition.physics, dt, surfaceGrip));
  }

  /** Fija el estado físico y sincroniza el render (p. ej. tras resolver una colisión). */
  setState(state: CarState): void {
    this.state = state;
    this.graphics.setPosition(this.state.x, this.state.y);
    this.graphics.setRotation(this.state.angle);

    const skidColorHex = Phaser.Display.Color.HexStringToColor(
      this.definition.appearance.skidColor,
    ).color;
    this.body.setFillStyle(isSkidding(this.state) ? skidColorHex : 0x2277cc);
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
