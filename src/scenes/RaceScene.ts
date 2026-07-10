import Phaser from 'phaser';
import { TrackLoader } from '../track/TrackLoader';
import { renderTrack } from '../track/TrackRenderer';
import { getSurfaceGripAt, isWallAt } from '../track/TrackQuery';
import { CarLoader } from '../entities/CarLoader';
import { Car } from '../entities/Car';
import { TouchControls } from '../input/TouchControls';
import { SettingsMenu } from '../settings/SettingsMenu';
import { Settings } from '../settings/Settings';
import { applyDifficultyToPhysics } from '../settings/difficulty';
import { LapTracker } from '../race/LapTracker';
import { RaceHud } from '../race/RaceHud';
import { NextTargetIndicator } from '../race/NextTargetIndicator';
import { RaceAudio } from '../race/RaceAudio';
import type { CarDefinition } from '../config/schema/car';
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
  private settingsMenu!: SettingsMenu;
  private carDefinition!: CarDefinition;
  private unsubscribeSettings?: () => void;
  private lapTracker!: LapTracker;
  private hud!: RaceHud;
  private nextTargetIndicator!: NextTargetIndicator;
  private audio!: RaceAudio;
  private raceElapsedMs = 0;
  private sceneData!: RaceSceneData;

  constructor() {
    super('Race');
  }

  create(data: RaceSceneData): void {
    // scene.restart() (botón "Volver a empezar") reutiliza esta misma
    // instancia: los campos de clase NO se reinician solos, hay que
    // resetearlos aquí a mano o se arrastra el cronómetro de la carrera anterior.
    this.raceElapsedMs = 0;

    this.sceneData = data;
    this.track = TrackLoader.get(this, data.trackKey);
    this.carDefinition = CarLoader.get(this, data.carKey);

    renderTrack(this, this.track);

    // Cámara fija encuadrando el circuito completo (F3): sin scroll.
    this.cameras.main.setBounds(0, 0, this.track.size.width, this.track.size.height);
    this.cameras.main.centerOn(this.track.size.width / 2, this.track.size.height / 2);

    const spawnAngleRad = Phaser.Math.DegToRad(this.track.spawn.angle);
    this.car = new Car(this, this.carDefinition, {
      x: this.track.spawn.x,
      y: this.track.spawn.y,
      angle: spawnAngleRad,
      vx: 0,
      vy: 0,
    });
    this.applyDifficulty();

    // Radio de activación generoso (arcade, no simulación): el circuito no
    // es tan ancho como para que el jugador tenga que pasar por el centro
    // exacto de cada checkpoint.
    this.lapTracker = new LapTracker(this.track.waypoints, this.track.laps, this.track.tileSize * 2.5);
    this.hud = new RaceHud(this, () => this.restartRace());
    this.nextTargetIndicator = new NextTargetIndicator(this);
    this.audio = new RaceAudio(this);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.handbrakeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Controles táctiles: para tablet/móvil sin teclado físico. Se montan
    // como DOM aparte de Phaser (multi-touch real) y se combinan con el
    // teclado en readInput(), así que ambos funcionan a la vez.
    this.touchControls = new TouchControls(document.body);
    this.settingsMenu = new SettingsMenu(document.body);
    this.unsubscribeSettings = Settings.onChange(() => this.applyDifficulty());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.touchControls.destroy();
      this.settingsMenu.destroy();
      this.nextTargetIndicator.destroy();
      // scene.restart() (botón de reinicio) dispara SHUTDOWN antes de volver
      // a llamar a create(): si no se destruye aquí, el motor/derrape de la
      // carrera anterior se quedarían sonando en bucle indefinidamente,
      // superpuestos con los nuevos.
      this.audio.destroy();
      this.unsubscribeSettings?.();
    });
  }

  private applyDifficulty(): void {
    const { difficulty } = Settings.get();
    this.car.setPhysics(applyDifficultyToPhysics(this.carDefinition.physics, difficulty));
  }

  /** Reinicia la carrera desde cero: mismo circuito y coche, todo el estado limpio. */
  private restartRace(): void {
    this.scene.restart(this.sceneData);
  }

  update(_time: number, deltaMs: number): void {
    if (this.settingsMenu.isOpen) return;

    const wasFinished = this.lapTracker.getState().finished;

    if (wasFinished) {
      // Carrera terminada: el coche se congela donde esté (no se procesa
      // más física ni entrada) y se oculta el indicador de objetivo.
      this.nextTargetIndicator.hide();
    } else {
      this.raceElapsedMs += deltaMs;

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

      const previousTargetIndex = this.lapTracker.nextTargetIndex;
      this.lapTracker.update(
        this.car.state.x,
        this.car.state.y,
        this.car.state.vx,
        this.car.state.vy,
        this.raceElapsedMs,
      );
      if (this.lapTracker.nextTargetIndex !== previousTargetIndex) {
        this.audio.playCheckpoint();
      }
      if (this.lapTracker.getState().finished) {
        this.audio.playFinish();
      }

      const speed = Math.hypot(this.car.state.vx, this.car.state.vy);
      this.audio.update(speed, this.car.maxSpeed, this.car.isSkidding);

      const nextTarget = this.track.waypoints[this.lapTracker.nextTargetIndex];
      this.nextTargetIndicator.update(nextTarget.x, nextTarget.y, this.raceElapsedMs);
    }

    this.hud.update(this.lapTracker.getState(), this.raceElapsedMs - this.lapTracker.currentLapStartMs);
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
