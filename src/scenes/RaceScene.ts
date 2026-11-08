import Phaser from 'phaser';
import { TrackLoader } from '../track/TrackLoader';
import { renderTrack } from '../track/TrackRenderer';
import { sampleCarSurfaces } from '../track/TrackQuery';
import { CarLoader } from '../entities/CarLoader';
import { Car } from '../entities/Car';
import { TouchControls } from '../input/TouchControls';
import { SettingsMenu } from '../settings/SettingsMenu';
import { Settings } from '../settings/Settings';
import { applyTuningToPhysics } from '../settings/carTuning';
import { BestLaps } from '../race/BestLaps';
import { LapTracker } from '../race/LapTracker';
import { RaceHud } from '../race/RaceHud';
import { NextTargetIndicator } from '../race/NextTargetIndicator';
import { RaceAudio } from '../race/RaceAudio';
import { RaceCountdown } from '../race/RaceCountdown';
import { SkidParticles } from '../race/SkidParticles';
import { DriveTelemetryHud } from '../race/DriveTelemetryHud';
import type { CarDefinition } from '../config/schema/car';
import { frameRateIndependentDecay, type CarInput } from '../physics/carPhysics';
import { resolveCarCollision, type CarCollisionImpact } from '../physics/carCollision';
import { DEFAULT_MAX_FRAME_DELTA_SECONDS, FixedStepLoop } from '../physics/fixedStep';
import type { TrackDefinition } from '../config/schema/track';

interface RaceSceneData {
  trackKey: string;
  carKey: string;
}

/**
 * Fricción al tocar el borde del mapa (fuera de cámara): el coche no debe
 * desaparecer ni seguir deslizando contra el límite de la pantalla. Los
 * muros de los tiles ya se resuelven por colisión real en `carCollision.ts`;
 * esto solo queda para el recorte de los bordes del mapa.
 * Retención por frame a 60fps: con 0.9, en ~0.2s se pierde la mayoría de la
 * velocidad.
 */
const OFFTRACK_GRIP_RETENTION = 0.9;

export class RaceScene extends Phaser.Scene {
  private track!: TrackDefinition;
  private map!: Phaser.Tilemaps.Tilemap;
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
  private countdown!: RaceCountdown;
  private skidParticles!: SkidParticles;
  private telemetryHud!: DriveTelemetryHud;
  private raceElapsedMs = 0;
  private sceneData!: RaceSceneData;
  private wasSettingsMenuOpen = false;
  private readonly fixedStep = new FixedStepLoop();
  private autoPaused = false;

  private readonly onVisibilityChange = (): void => {
    this.setAutoPaused(document.visibilityState === 'hidden');
  };
  private readonly onWindowBlur = (): void => {
    this.setAutoPaused(true);
  };
  private readonly onWindowFocus = (): void => {
    this.setAutoPaused(false);
  };

  constructor() {
    super('Race');
  }

  create(data: RaceSceneData): void {
    // scene.restart() (botón "Volver a empezar") reutiliza esta misma
    // instancia: los campos de clase NO se reinician solos, hay que
    // resetearlos aquí a mano o se arrastra el cronómetro de la carrera anterior.
    this.raceElapsedMs = 0;
    this.wasSettingsMenuOpen = false;
    this.autoPaused = false;
    this.fixedStep.reset();

    this.sceneData = data;
    const loaded = TrackLoader.get(this, data.trackKey);
    this.track = loaded.track;
    this.map = loaded.map;
    this.carDefinition = CarLoader.get(this, data.carKey);

    renderTrack(this, this.map, this.track);

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
    this.applyCarTuning();

    // Radio de activación generoso (arcade, no simulación): el circuito no
    // es tan ancho como para que el jugador tenga que pasar por el centro
    // exacto de cada checkpoint.
    //
    // La mejor vuelta se siembra desde localStorage (BestLaps, por
    // circuito+coche) para que "🏆 mejor vuelta" muestre el récord de
    // siempre desde el primer frame, no solo el de esta sesión.
    const savedBestLapMs = BestLaps.get(data.trackKey, data.carKey);
    this.lapTracker = new LapTracker(
      this.track.waypoints,
      this.track.laps,
      this.track.tileSize * 2.5,
      savedBestLapMs,
    );
    this.hud = new RaceHud(this, () => this.restartRace());
    this.nextTargetIndicator = new NextTargetIndicator(this);
    this.audio = new RaceAudio(this);
    this.skidParticles = new SkidParticles(this);
    this.telemetryHud = new DriveTelemetryHud(this);
    this.telemetryHud.setVisible(Settings.get().debugTelemetryEnabled);
    // Cuenta atrás de salida: el coche queda congelado en la parrilla hasta
    // el "¡YA!". Se recrea en cada create(), así que "Volver a empezar"
    // (scene.restart) también repite la cuenta atrás.
    this.countdown = new RaceCountdown(this, (final) => this.audio.playCountdownBeep(final));

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.handbrakeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Controles táctiles: para tablet/móvil sin teclado físico. Se montan
    // como DOM aparte de Phaser (multi-touch real) y se combinan con el
    // teclado en readInput(), así que ambos funcionan a la vez.
    this.touchControls = new TouchControls(document.body);
    this.settingsMenu = new SettingsMenu(document.body, () => this.exitToMenu());
    this.applySound();
    this.unsubscribeSettings = Settings.onChange(() => {
      this.applyCarTuning();
      this.applySound();
      this.telemetryHud.setVisible(Settings.get().debugTelemetryEnabled);
    });

    // Pausa real al perder foco: no basta con que Phaser deje de llamar a
    // update(), porque al volver habría un delta gigante y el motor/derrape
    // seguirían sonando. Se congela el bucle y se reanuda con el acumulador
    // a cero.
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('focus', this.onWindowFocus);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      window.removeEventListener('blur', this.onWindowBlur);
      window.removeEventListener('focus', this.onWindowFocus);
      this.fixedStep.reset();
      this.touchControls.destroy();
      this.settingsMenu.destroy();
      this.nextTargetIndicator.destroy();
      this.countdown.destroy();
      this.skidParticles.destroy();
      this.telemetryHud.destroy();
      // scene.restart() (botón de reinicio) dispara SHUTDOWN antes de volver
      // a llamar a create(): si no se destruye aquí, el motor/derrape de la
      // carrera anterior se quedarían sonando en bucle indefinidamente,
      // superpuestos con los nuevos.
      this.audio.destroy();
      this.unsubscribeSettings?.();
    });
  }

  private applyCarTuning(): void {
    const { speedFactor, accelFactor, gripFactor } = Settings.get();
    this.car.setPhysics(
      applyTuningToPhysics(this.carDefinition.physics, { speedFactor, accelFactor, gripFactor }),
    );
  }

  // El gestor de sonido (this.sound) es una única instancia compartida por
  // todo el juego (no una por escena): silenciarlo aquí también afecta a la
  // pantalla de título. Se aplica igual en TitleScene por si el ajuste
  // cambia estando ahí.
  private applySound(): void {
    this.sound.mute = !Settings.get().soundEnabled;
  }

  /**
   * Congela/reanuda la carrera al perder el foco de la ventana. Si los
   * ajustes están abiertos, el audio debe seguir pausado: ya lo gestiona
   * SettingsMenu, así que al volver solo se reanuda si el panel está cerrado.
   */
  private setAutoPaused(paused: boolean): void {
    if (paused === this.autoPaused) return;
    this.autoPaused = paused;

    if (paused) {
      this.fixedStep.reset();
      this.sound.pauseAll();
    } else if (!this.settingsMenu.isOpen) {
      this.sound.resumeAll();
    }
  }

  private handleImpact(impact: CarCollisionImpact): void {
    this.audio.playImpact(impact.speed);
    this.skidParticles.emitImpact(impact.x, impact.y, impact.speed);
  }

  /** Reinicia la carrera desde cero: mismo circuito y coche, todo el estado limpio. */
  private restartRace(): void {
    this.scene.restart(this.sceneData);
  }

  /** Abandona la carrera en curso y vuelve a la pantalla de título (elegir otro circuito). */
  private exitToMenu(): void {
    this.scene.start('Title', { carKey: this.sceneData.carKey });
  }

  update(time: number, deltaMs: number): void {
    // Si la ventana perdió el foco, no se simula nada: al volver el
    // acumulador está a cero y no hay salto de física.
    if (this.autoPaused) return;

    // Abrir los ajustes congela el juego (early return de abajo), pero eso
    // solo detiene NUESTRA lógica de frame — el motor/derrape de Phaser
    // siguen sonando en bucle por su cuenta si no se pausan explícitamente.
    if (this.settingsMenu.isOpen !== this.wasSettingsMenuOpen) {
      this.wasSettingsMenuOpen = this.settingsMenu.isOpen;
      if (this.settingsMenu.isOpen) {
        this.sound.pauseAll();
      } else {
        this.sound.resumeAll();
      }
    }
    if (this.settingsMenu.isOpen) return;

    // El delta real se recorta antes de la cuenta atrás y del acumulador.
    // Tras un freeze, un frame de varios segundos no debe mover el coche ni
    // saltarse medio cronómetro.
    const frameDeltaSeconds = Math.min(deltaMs / 1000, DEFAULT_MAX_FRAME_DELTA_SECONDS);

    // Cuenta atrás de salida: mientras muestra 3/2/1 el coche está congelado
    // en la parrilla — no se procesa entrada ni física, ni corre el crono
    // (que arranca en el "¡YA!"). El indicador de objetivo sí se muestra ya,
    // para saber hacia dónde salir.
    if (this.countdown.update(frameDeltaSeconds * 1000)) {
      const nextTarget = this.track.waypoints[this.lapTracker.nextTargetIndex];
      this.nextTargetIndicator.update(nextTarget.x, nextTarget.y, time);
      this.hud.update(this.lapTracker.getState(), 0);
      return;
    }

    const wasFinished = this.lapTracker.getState().finished;

    if (wasFinished) {
      // Carrera terminada: el coche se congela donde esté (no se procesa
      // más física ni entrada) y se oculta el indicador de objetivo.
      this.nextTargetIndicator.hide();
      this.skidParticles.update(
        this.car.state.x,
        this.car.state.y,
        this.car.state.angle,
        false,
        this.car.surfaceKey,
      );
    } else {
      const input = this.readInput();
      const previousTargetIndex = this.lapTracker.nextTargetIndex;
      const previousLastLapMs = this.lapTracker.getState().lastLapMs;
      let finishedDuringFrame = false;

      this.fixedStep.advance(frameDeltaSeconds, (dt) => {
        if (finishedDuringFrame) return false;

        this.raceElapsedMs += dt * 1000;

        const surface = sampleCarSurfaces(
          this.track,
          this.car.state.x,
          this.car.state.y,
          this.car.state.angle,
          {
            length: this.carDefinition.physics.length,
            width: this.carDefinition.physics.width,
            wheelbaseOffset: this.carDefinition.appearance.wheelbaseOffset,
          },
        );

        const previousCarState = this.car.state;
        this.car.update(dt, input, surface);

        const collision = resolveCarCollision(
          previousCarState,
          this.car.state,
          this.track,
          this.carDefinition.physics,
        );
        if (collision.collided) {
          this.car.setState(collision.state);
          if (collision.impact) this.handleImpact(collision.impact);
        }

        // La cámara es fija y encuadra el circuito completo sin scroll (F3):
        // sin este límite, un derrape fuerte hacia el borde podría sacar el
        // coche fuera del área visible y "perderlo" de la pantalla. Se trata
        // como un muro (misma fricción fuerte que isWallAt) en vez de solo
        // recortar la posición: si no, el coche podía quedarse pegado al
        // borde a toda velocidad y seguir deslizando a lo largo de él
        // indefinidamente, como si el borde de la pantalla no existiera.
        const clampedX = Phaser.Math.Clamp(this.car.state.x, 0, this.track.size.width);
        const clampedY = Phaser.Math.Clamp(this.car.state.y, 0, this.track.size.height);
        const hitScreenEdge = clampedX !== this.car.state.x || clampedY !== this.car.state.y;
        const edgeDecay = hitScreenEdge ? frameRateIndependentDecay(OFFTRACK_GRIP_RETENTION, dt) : 1;
        this.car.setState({
          ...this.car.state,
          x: clampedX,
          y: clampedY,
          vx: this.car.state.vx * edgeDecay,
          vy: this.car.state.vy * edgeDecay,
        });

        this.lapTracker.update(
          this.car.state.x,
          this.car.state.y,
          this.car.state.vx,
          this.car.state.vy,
          this.raceElapsedMs,
        );

        if (this.lapTracker.getState().finished) {
          finishedDuringFrame = true;
          return false;
        }

        return true;
      });

      this.telemetryHud.update(this.car.telemetry);

      if (this.lapTracker.nextTargetIndex !== previousTargetIndex) {
        this.audio.playCheckpoint();
      }
      const lapState = this.lapTracker.getState();
      if (lapState.lastLapMs !== previousLastLapMs && lapState.bestLapMs !== null) {
        // Se acaba de completar una vuelta: si es la mejor conseguida hasta
        // ahora (esta sesión o guardada de antes), persistirla entre
        // sesiones. reportLap ya comprueba internamente si mejora lo
        // guardado, así que es seguro llamarlo siempre que se cierra vuelta.
        BestLaps.reportLap(this.sceneData.trackKey, this.sceneData.carKey, lapState.bestLapMs);
      }
      if (lapState.finished) {
        this.audio.playFinish();
      }

      const speed = Math.hypot(this.car.state.vx, this.car.state.vy);
      this.audio.update(speed, this.car.maxSpeed, this.car.isSkidding);
      this.skidParticles.update(
        this.car.state.x,
        this.car.state.y,
        this.car.state.angle,
        this.car.isSkidding,
        this.car.surfaceKey,
      );

      if (lapState.finished) {
        this.nextTargetIndicator.hide();
      } else {
        const nextTarget = this.track.waypoints[this.lapTracker.nextTargetIndex];
        this.nextTargetIndicator.update(nextTarget.x, nextTarget.y, this.raceElapsedMs);
      }
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
