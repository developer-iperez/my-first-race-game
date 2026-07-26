import Phaser from 'phaser';
import type { CarDefinition, CarPhysicsConfig } from '../config/schema/car';
import { stepCarPhysics, isSkidding, type CarInput, type CarState } from '../physics/carPhysics';

/**
 * Entidad de coche construida enteramente a partir de un CarDefinition
 * (JSON validado). No contiene ninguna constante de tuning propia: cambiar
 * de vehículo es cargar otro fichero, no tocar esta clase.
 *
 * El sprite (appearance.sprite, precargado como 'car-sprite' en BootScene)
 * se escala a physics.length/width: cambiar esos valores en el JSON del
 * coche redimensiona el sprite en pantalla sin tocar código.
 */
export class Car {
  state: CarState;
  readonly definition: CarDefinition;

  private readonly sprite: Phaser.GameObjects.Image;
  private readonly skidTint: number;
  /** Físicas efectivas usadas en la simulación: definition.physics + ajustes del jugador (dificultad). */
  private physics: CarPhysicsConfig;

  constructor(scene: Phaser.Scene, definition: CarDefinition, spawn: CarState) {
    this.definition = definition;
    this.physics = definition.physics;
    this.state = { ...spawn };
    this.skidTint = Phaser.Display.Color.HexStringToColor(definition.appearance.skidColor).color;

    const { length, width } = definition.physics;
    this.sprite = scene.add.image(spawn.x, spawn.y, 'car-sprite');
    this.sprite.setDisplaySize(length, width);
    this.sprite.setRotation(spawn.angle);
  }

  /** Sustituye las físicas efectivas (p. ej. tras aplicar la dificultad elegida). */
  setPhysics(physics: CarPhysicsConfig): void {
    this.physics = physics;
  }

  /** Velocidad máxima efectiva actual (según dificultad), para normalizar el sonido de motor. */
  get maxSpeed(): number {
    return this.physics.maxSpeed;
  }

  /** Si el coche está derrapando ahora mismo (para el sonido de derrape). */
  get isSkidding(): boolean {
    return isSkidding(this.state);
  }

  update(dt: number, input: CarInput, surfaceGrip = 1, surfaceDrag = 1): void {
    this.setState(stepCarPhysics(this.state, input, this.physics, dt, surfaceGrip, surfaceDrag));
  }

  /** Fija el estado físico y sincroniza el render (p. ej. tras resolver una colisión). */
  setState(state: CarState): void {
    this.state = state;
    this.sprite.setPosition(this.state.x, this.state.y);
    this.sprite.setRotation(this.state.angle);

    if (isSkidding(this.state)) {
      this.sprite.setTint(this.skidTint);
    } else {
      this.sprite.clearTint();
    }
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
