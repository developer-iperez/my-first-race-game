import Phaser from 'phaser';
import { TrackLoader } from '../track/TrackLoader';
import { renderTrack } from '../track/TrackRenderer';
import { sampleCarSurfaces } from '../track/TrackQuery';
import { CarLoader } from '../entities/CarLoader';
import { Car } from '../entities/Car';
import { TouchControls } from '../input/TouchControls';
import { InputManager, type GamepadLike } from '../input/InputManager';
import { SettingsMenu } from '../settings/SettingsMenu';
import { Settings } from '../settings/Settings';
import { applyTuningToPhysics, getTuningKey } from '../settings/carTuning';
import { BestLaps } from '../race/BestLaps';
import { GhostRecorder } from '../race/GhostRecorder';
import { GhostPlayer } from '../race/GhostPlayer';
import { GhostStore } from '../race/GhostStore';
import { getMedal } from '../race/medals';
import { LapTracker } from '../race/LapTracker';
import { RaceHud, type DrivingHudState } from '../race/RaceHud';
import { PauseMenu } from '../race/PauseMenu';
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
const RESET_PENALTY_MS = 3000;

export class RaceScene extends Phaser.Scene {
  private track!: TrackDefinition;
  private map!: Phaser.Tilemaps.Tilemap;
  private car!: Car;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private handbrakeKey!: Phaser.Input.Keyboard.Key;
  private readonly inputManager = new InputManager();
  private touchControls!: TouchControls;
  private settingsMenu!: SettingsMenu;
  private carDefinition!: CarDefinition;
  private unsubscribeSettings?: () => void;
  private lapTracker!: LapTracker;
  private hud!: RaceHud;
  private ghostRecorder!: GhostRecorder;
  private ghostPlayer!: GhostPlayer;
  private tuningKey = '';
  private pauseMenu!: PauseMenu;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private escapeKey!: Phaser.Input.Keyboard.Key;
  private resetKey!: Phaser.Input.Keyboard.Key;
  private manualPaused = false;
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
    this.manualPaused = false;
    this.fixedStep.reset();
    this.inputManager.reset();

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
    this.tuningKey = getTuningKey(Settings.get());
    const savedBestLapMs = BestLaps.get(data.trackKey, data.carKey, this.tuningKey);
    this.lapTracker = new LapTracker(
      this.track.waypoints,
      this.track.laps,
      this.track.tileSize * 2.5,
      savedBestLapMs,
    );
    this.hud = new RaceHud(
      this,
      () => this.restartRace(),
      () => this.exitToMenu(),
    );
    this.nextTargetIndicator = new NextTargetIndicator(this);

    this.ghostRecorder = new GhostRecorder();
    this.ghostRecorder.reset(0);
    this.ghostPlayer = new GhostPlayer(
      this,
      this.carDefinition.physics.length,
      this.carDefinition.physics.width,
    );
    this.ghostPlayer.setGhost(GhostStore.get(data.trackKey, data.carKey, this.tuningKey));

    this.audio = new RaceAudio(this);
    this.skidParticles = new SkidParticles(this);
    this.telemetryHud = new DriveTelemetryHud(this);
    this.telemetryHud.setVisible(Settings.get().debugTelemetryEnabled);
    // Cuenta atrás de salida: el coche queda congelado en la parrilla hasta
    // el "¡YA!". Se recrea en cada create(), así que "Volver a empezar"
    // (scene.restart) también repite la cuenta atrás.
    this.countdown = new RaceCountdown(this, (final) => this.audio.playCountdownBeep(final));

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.handbrakeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.pauseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.escapeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.resetKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.pauseMenu = new PauseMenu(this, {
      onResume: () => this.setManualPaused(false),
      onRestart: () => this.restartRace(),
      onMenu: () => this.exitToMenu(),
    });

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
      this.pauseMenu.destroy();
      this.nextTargetIndicator.destroy();
      this.ghostPlayer.destroy();
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
    } else if (!this.settingsMenu.isOpen && !this.manualPaused) {
      this.sound.resumeAll();
    }
  }

  private setManualPaused(paused: boolean): void {
    if (paused === this.manualPaused) return;
    this.manualPaused = paused;

    if (paused) {
      this.fixedStep.reset();
      this.touchControls.setVisible(false);
      this.pauseMenu.show();
      this.sound.pauseAll();
    } else {
      this.pauseMenu.hide();
      this.touchControls.setVisible(!this.lapTracker.getState().finished);
      if (!this.autoPaused && !this.settingsMenu.isOpen) this.sound.resumeAll();
    }
  }

  /**
   * Recoloca el coche en la última puerta superada (R). Sirve para salir de
   * un atasco sin abandonar; añade 3 s al cronómetro para que no sea una
   * forma de hacer trampa.
   */
  private resetToLastGate(): void {
    const target = this.lapTracker.lastPassedWaypoint;
    const next = this.track.waypoints[this.lapTracker.nextTargetIndex];
    // Mirando hacia la siguiente puerta, no hacia la dirección de la puerta
    // recién pasada: en un checkpoint en curva, lo segundo apuntaría a la pared.
    const angle = next
      ? Math.atan2(next.y - target.y, next.x - target.x)
      : (target.angle !== undefined ? Phaser.Math.DegToRad(target.angle) : this.car.state.angle);
    const resetSpeed = 0;

    this.car.setState({
      ...this.car.state,
      x: target.x,
      y: target.y,
      angle,
      vx: resetSpeed,
      vy: resetSpeed,
      yawRate: 0,
      reverseHold: 0,
    });
    this.lapTracker.resetPreviousPosition(target.x, target.y);
    this.ghostRecorder.discard();
    this.raceElapsedMs += RESET_PENALTY_MS;
    this.fixedStep.reset();
    this.hud.flashMessage('RESET +3 s');
  }

  private getDrivingHudState(): DrivingHudState {
    const finished = this.lapTracker.getState().finished;
    return {
      speed: Math.hypot(this.car.state.vx, this.car.state.vy),
      maxSpeed: this.car.maxSpeed,
      isSkidding: this.car.isSkidding,
      totalTimeMs: this.raceElapsedMs,
      medal: finished ? getMedal(this.raceElapsedMs, this.track.medals) : null,
    };
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

    if (this.manualPaused) {
      if (
        Phaser.Input.Keyboard.JustDown(this.pauseKey) ||
        Phaser.Input.Keyboard.JustDown(this.escapeKey)
      ) {
        this.setManualPaused(false);
      }
      return;
    }

    if (
      !this.settingsMenu.isOpen &&
      (Phaser.Input.Keyboard.JustDown(this.pauseKey) ||
        Phaser.Input.Keyboard.JustDown(this.escapeKey))
    ) {
      this.setManualPaused(true);
      return;
    }

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
      this.nextTargetIndicator.update(nextTarget, time);
      this.ghostPlayer.hide();
      this.hud.update(this.lapTracker.getState(), 0, this.getDrivingHudState());
      return;
    }

    const wasFinished = this.lapTracker.getState().finished;

    if (!wasFinished && Phaser.Input.Keyboard.JustDown(this.resetKey)) {
      this.resetToLastGate();
      return;
    }

    if (wasFinished) {
      // Carrera terminada: el coche se congela donde esté (no se procesa
      // más física ni entrada) y se oculta el indicador de objetivo.
      this.nextTargetIndicator.hide();
      this.ghostPlayer.hide();
      this.skidParticles.update(
        this.car.state.x,
        this.car.state.y,
        this.car.state.angle,
        false,
        this.car.surfaceKey,
      );
    } else {
      const input = this.readInput(frameDeltaSeconds);
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

        this.ghostRecorder.record(
          this.raceElapsedMs,
          this.car.state.x,
          this.car.state.y,
          this.car.state.angle,
        );

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
      if (lapState.lastLapMs !== previousLastLapMs) {
        // Se acaba de completar una vuelta: forzar la muestra final antes de
        // decidir si el fantasma de esta vuelta merece guardarse.
        this.ghostRecorder.forceSample(
          this.raceElapsedMs,
          this.car.state.x,
          this.car.state.y,
          this.car.state.angle,
        );

        const lastLapMs = lapState.lastLapMs;
        const isNewBest =
          lastLapMs !== null && lapState.bestLapMs !== null && lastLapMs <= lapState.bestLapMs;
        if (lastLapMs !== null && isNewBest && this.ghostRecorder.isValid) {
          const ghost = {
            version: 1 as const,
            lapMs: lastLapMs,
            frames: this.ghostRecorder.getSamples(),
          };
          GhostStore.save(
            this.sceneData.trackKey,
            this.sceneData.carKey,
            this.tuningKey,
            ghost,
          );
          this.ghostPlayer.setGhost(ghost);
        }

        if (lapState.bestLapMs !== null) {
          // reportLap ya comprueba internamente si mejora lo guardado, así
          // que es seguro llamarlo siempre que se cierra vuelta.
          BestLaps.reportLap(
            this.sceneData.trackKey,
            this.sceneData.carKey,
            lapState.bestLapMs,
            this.tuningKey,
          );
        }
        this.ghostRecorder.reset(this.raceElapsedMs);
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
      this.ghostPlayer.update(
        this.raceElapsedMs - this.lapTracker.currentLapStartMs,
        lapState.finished,
      );

      if (lapState.finished) {
        this.nextTargetIndicator.hide();
        this.touchControls.setVisible(false);
      } else {
        const nextTarget = this.track.waypoints[this.lapTracker.nextTargetIndex];
        this.nextTargetIndicator.update(nextTarget, this.raceElapsedMs);
      }
    }

    this.hud.update(
      this.lapTracker.getState(),
      this.raceElapsedMs - this.lapTracker.currentLapStartMs,
      this.getDrivingHudState(),
    );
  }

  private readInput(dtSeconds: number): CarInput {
    return this.inputManager.update(dtSeconds, {
      keyboard: {
        throttleUp: this.cursors.up.isDown || this.wasd.up.isDown,
        throttleDown: this.cursors.down.isDown || this.wasd.down.isDown,
        left: this.cursors.left.isDown || this.wasd.left.isDown,
        right: this.cursors.right.isDown || this.wasd.right.isDown,
        handbrake: this.handbrakeKey.isDown,
      },
      touch: this.touchControls.state,
      gamepad: this.readGamepad(),
    });
  }

  private readGamepad(): GamepadLike | null {
    const gamepads = navigator.getGamepads?.();
    if (!gamepads) return null;
    for (const gamepad of gamepads) {
      if (gamepad?.connected) return gamepad;
    }
    return null;
  }
}
