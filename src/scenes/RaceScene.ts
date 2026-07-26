import Phaser from 'phaser';
import { TrackLoader } from '../track/TrackLoader';
import { renderTrack } from '../track/TrackRenderer';
import { getSurfaceDragAt, getSurfaceGripAt, isWallAt } from '../track/TrackQuery';
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
import type { CarDefinition } from '../config/schema/car';
import { frameRateIndependentDecay, type CarInput } from '../physics/carPhysics';
import type { TrackDefinition } from '../config/schema/track';

interface RaceSceneData {
  trackKey: string;
  carKey: string;
}

/**
 * Fricción fuerte al salirse de pista (muro/fuera de mapa): NO paramos en
 * seco ni rebotamos — el coche sigue moviéndose, solo que cuesta mucho
 * mantener velocidad, así es fácil corregir y volver al trazado sin sentir
 * un choque. Retención por frame a 60fps: con 0.9, en ~0.2s se pierde
 * la mayoría de la velocidad.
 */
const OFFTRACK_GRIP_RETENTION = 0.9;

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
  private countdown!: RaceCountdown;
  private skidParticles!: SkidParticles;
  private raceElapsedMs = 0;
  private sceneData!: RaceSceneData;
  private wasSettingsMenuOpen = false;

  constructor() {
    super('Race');
  }

  create(data: RaceSceneData): void {
    // scene.restart() (botón "Volver a empezar") reutiliza esta misma
    // instancia: los campos de clase NO se reinician solos, hay que
    // resetearlos aquí a mano o se arrastra el cronómetro de la carrera anterior.
    this.raceElapsedMs = 0;
    this.wasSettingsMenuOpen = false;

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
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.touchControls.destroy();
      this.settingsMenu.destroy();
      this.nextTargetIndicator.destroy();
      this.countdown.destroy();
      this.skidParticles.destroy();
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

  /** Reinicia la carrera desde cero: mismo circuito y coche, todo el estado limpio. */
  private restartRace(): void {
    this.scene.restart(this.sceneData);
  }

  /** Abandona la carrera en curso y vuelve a la pantalla de título (elegir otro circuito). */
  private exitToMenu(): void {
    this.scene.start('Title', { carKey: this.sceneData.carKey });
  }

  update(_time: number, deltaMs: number): void {
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

    // Cuenta atrás de salida: mientras muestra 3/2/1 el coche está congelado
    // en la parrilla — no se procesa entrada ni física, ni corre el crono
    // (que arranca en el "¡YA!"). El indicador de objetivo sí se muestra ya,
    // para saber hacia dónde salir.
    if (this.countdown.update(deltaMs)) {
      const nextTarget = this.track.waypoints[this.lapTracker.nextTargetIndex];
      this.nextTargetIndicator.update(nextTarget.x, nextTarget.y, _time);
      this.hud.update(this.lapTracker.getState(), 0);
      return;
    }

    const wasFinished = this.lapTracker.getState().finished;

    if (wasFinished) {
      // Carrera terminada: el coche se congela donde esté (no se procesa
      // más física ni entrada) y se oculta el indicador de objetivo.
      this.nextTargetIndicator.hide();
      this.skidParticles.update(this.car.state.x, this.car.state.y, this.car.state.angle, false);
    } else {
      this.raceElapsedMs += deltaMs;

      const dt = deltaMs / 1000;
      const input = this.readInput();
      const surfaceGrip = getSurfaceGripAt(this.track, this.car.state.x, this.car.state.y);
      const surfaceDrag = getSurfaceDragAt(this.track, this.car.state.x, this.car.state.y);

      this.car.update(dt, input, surfaceGrip, surfaceDrag);

      if (isWallAt(this.track, this.car.state.x, this.car.state.y)) {
        const offtrackDecay = frameRateIndependentDecay(OFFTRACK_GRIP_RETENTION, dt);
        this.car.setState({
          ...this.car.state,
          vx: this.car.state.vx * offtrackDecay,
          vy: this.car.state.vy * offtrackDecay,
        });
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

      const previousTargetIndex = this.lapTracker.nextTargetIndex;
      const previousLastLapMs = this.lapTracker.getState().lastLapMs;
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
      this.skidParticles.update(this.car.state.x, this.car.state.y, this.car.state.angle, this.car.isSkidding);

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
