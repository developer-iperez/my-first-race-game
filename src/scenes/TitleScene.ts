import Phaser from 'phaser';
import { SettingsMenu } from '../settings/SettingsMenu';
import { Settings } from '../settings/Settings';
import { TRACK_CATALOG } from '../track/trackCatalog';

interface TitleSceneData {
  carKey: string;
}

const CHECKER_SQUARE = 8;

/**
 * Pantalla de inicio: título del juego y "pulsa para empezar". Deja abrir
 * los ajustes (⚙️) para tunear la conducción antes de arrancar, y el primer
 * toque/tecla que inicia la carrera sirve además para desbloquear el audio
 * del navegador (que bloquea el sonido hasta la primera interacción).
 */
export class TitleScene extends Phaser.Scene {
  private settingsMenu!: SettingsMenu;
  private sceneData!: TitleSceneData;
  private trackLabel!: Phaser.GameObjects.Text;
  private started = false;
  private unsubscribeSettings?: () => void;

  constructor() {
    super('Title');
  }

  create(data: TitleSceneData): void {
    this.sceneData = data;
    this.started = false;

    const { width, height } = this.scale;

    // Fondo de hierba tileada + una franja a cuadros (parrilla de salida).
    this.add.tileSprite(0, 0, width, height, 'tile-grass').setOrigin(0, 0);
    this.drawCheckeredBand(height / 2 + 30, width);

    // Coche de muestra sobre la parrilla.
    this.add
      .image(width / 2, height / 2 + 8, 'car-sprite')
      .setDisplaySize(48, 24)
      .setAngle(-90);

    // Selector de circuito: flechas interactivas + nombre del elegido
    // (persistido en Settings.trackKey). Flechas suficientemente grandes
    // para tocar con el dedo en móvil.
    const trackRowY = 94;
    this.trackLabel = this.add
      .text(width / 2, trackRowY, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.refreshTrackLabel();

    const arrowStyle = {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 4,
    };
    this.add
      .text(width / 2 - 78, trackRowY, '◀', arrowStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.cycleTrack(-1));
    this.add
      .text(width / 2 + 78, trackRowY, '▶', arrowStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.cycleTrack(1));

    // Título del juego (mismo nombre que <title> del index.html).
    this.add
      .text(width / 2, 44, 'RALLY 90s', {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: '#ffcc00',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 72, '// ARCADE RALLY //', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setAlpha(0.85);

    // "Pulsa para empezar", parpadeante.
    const prompt = this.add
      .text(width / 2, height - 30, 'PULSA PARA EMPEZAR', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.15 },
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Pista hacia los ajustes (velocidad/aceleración/agarre y sonido).
    this.add
      .text(width / 2, height - 12, '⚙️ AJUSTES DE CONDUCCIÓN', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#ffcc00',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // Ajustes (⚙️) también aquí: tunear la conducción antes de correr.
    this.settingsMenu = new SettingsMenu(document.body);
    this.applySound();
    this.unsubscribeSettings = Settings.onChange(() => {
      this.applySound();
      this.refreshTrackLabel();
    });

    // Empezar con cualquier tecla o toque (salvo si el menú de ajustes está
    // abierto, o si el toque fue sobre una flecha del selector de circuito:
    // currentlyOver trae los game objects interactivos bajo el puntero).
    this.input.keyboard?.on('keydown', () => this.start());
    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (currentlyOver.length === 0) this.start();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.settingsMenu.destroy();
      this.unsubscribeSettings?.();
    });
  }

  // El gestor de sonido (this.sound) es una única instancia compartida por
  // todo el juego (no una por escena), así que silenciarlo aquí también
  // afecta a la carrera; se aplica igual en RaceScene para que el ajuste
  // se refleje esté donde esté el jugador cuando lo cambie.
  private applySound(): void {
    this.sound.mute = !Settings.get().soundEnabled;
  }

  private start(): void {
    if (this.started || this.settingsMenu.isOpen) return;
    this.started = true;
    this.scene.start('Race', { trackKey: Settings.get().trackKey, carKey: this.sceneData.carKey });
  }

  private refreshTrackLabel(): void {
    const entry = TRACK_CATALOG.find((track) => track.key === Settings.get().trackKey) ?? TRACK_CATALOG[0];
    this.trackLabel.setText(entry.label);
  }

  private cycleTrack(direction: number): void {
    const currentIndex = TRACK_CATALOG.findIndex((track) => track.key === Settings.get().trackKey);
    const nextIndex = (currentIndex + direction + TRACK_CATALOG.length) % TRACK_CATALOG.length;
    Settings.update({ trackKey: TRACK_CATALOG[nextIndex].key });
  }

  private drawCheckeredBand(centerY: number, width: number): void {
    const graphics = this.add.graphics();
    const rows = 2;
    const cols = Math.ceil(width / CHECKER_SQUARE);
    const startY = centerY - (rows * CHECKER_SQUARE) / 2;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        graphics.fillStyle((col + row) % 2 === 0 ? 0xffffff : 0x111111, 1);
        graphics.fillRect(col * CHECKER_SQUARE, startY + row * CHECKER_SQUARE, CHECKER_SQUARE, CHECKER_SQUARE);
      }
    }
  }
}
