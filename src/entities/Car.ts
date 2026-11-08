import Phaser from 'phaser';
import type { CarDefinition, CarPhysicsConfig } from '../config/schema/car';
import type { SurfaceSample } from '../track/TrackQuery';
import {
  stepCarPhysicsWithTelemetry,
  isSkidding,
  type CarInput,
  type CarState,
  type DriveTelemetry,
} from '../physics/carPhysics';

const DEFAULT_SURFACE: SurfaceSample = { surfaceKey: 'asphalt', grip: 1, drag: 1 };

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
  /** Superficie media bajo las ruedas en el último frame (para polvo/sonido/tinte). */
  private currentSurface: SurfaceSample = DEFAULT_SURFACE;
  /** Diagnóstico del último frame de física (ver DriveTelemetry) para el HUD de depuración. */
  telemetry?: DriveTelemetry;

  constructor(scene: Phaser.Scene, definition: CarDefinition, spawn: CarState) {
    this.definition = definition;
    this.physics = definition.physics;
    this.state = { ...spawn };
    this.skidTint = Phaser.Display.Color.HexStringToColor(definition.appearance.skidColor).color;

    const { length, width } = definition.physics;
    this.sprite = scene.add.image(spawn.x, spawn.y, 'car-sprite');
    this.sprite.setDisplaySize(length, width);
    this.sprite.setRotation(spawn.angle);
    // Por encima de la decoración y del fantasma, por debajo del HUD.
    this.sprite.setDepth(3);
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

  /** Superficie dominante bajo las ruedas (para polvo, sonido y tinte). */
  get surfaceKey(): string {
    return this.currentSurface.surfaceKey;
  }

  update(dt: number, input: CarInput, surface: SurfaceSample = DEFAULT_SURFACE): void {
    this.currentSurface = surface;
    const { nextState, telemetry } = stepCarPhysicsWithTelemetry(
      this.state,
      input,
      this.physics,
      dt,
      surface.grip,
      surface.drag,
    );
    this.telemetry = telemetry;
    this.telemetry.surfaceKey = surface.surfaceKey;
    this.setState(nextState);
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
