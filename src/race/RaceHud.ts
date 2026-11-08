import Phaser from 'phaser';
import type { LapTrackerState } from './LapTracker';
import { formatLapTime } from './formatTime';
import { formatSignedDelta, getDriveDisplay } from './driveDisplay';

const PANEL_PADDING = 4;
const PANEL_BG = 0x0a0a0a;
const PANEL_BORDER = 0xffcc00;
const SPEED_PANEL_WIDTH = 104;
const SPEED_PANEL_HEIGHT = 54;
// A la izquierda del botón DOM de ajustes (⚙️), para no taparlo y para que
// el panel no oculte los waypoints del borde superior.
const SPEED_PANEL_MARGIN = 60;
const SPEED_PANEL_TOP = 6;

export interface DrivingHudState {
  speed: number;
  maxSpeed: number;
  isSkidding: boolean;
  /** Tiempo total de carrera (incluye vueltas ya completadas). */
  totalTimeMs: number;
}

const EMPTY_DRIVING: DrivingHudState = {
  speed: 0,
  maxSpeed: 1,
  isSkidding: false,
  totalTimeMs: 0,
};

/**
 * Dibuja un panel estilo "marcador arcade" (fondo oscuro + borde de 2px)
 * detrás de un Text, ajustado a su tamaño actual. Se llama tras cada
 * setText() porque el contenido (y por tanto el tamaño) cambia.
 */
function drawPanel(
  graphics: Phaser.GameObjects.Graphics,
  text: Phaser.GameObjects.Text,
  borderColor = PANEL_BORDER,
): void {
  const x = text.x - PANEL_PADDING - (text.originX ?? 0) * text.width;
  const y = text.y - PANEL_PADDING - (text.originY ?? 0) * text.height;
  const w = text.width + PANEL_PADDING * 2;
  const h = text.height + PANEL_PADDING * 2;

  graphics.clear();
  graphics.fillStyle(PANEL_BG, 0.88);
  graphics.fillRect(x, y, w, h);
  graphics.lineStyle(2, borderColor, 1);
  graphics.strokeRect(x, y, w, h);
}

/**
 * HUD estilo marcador arcade: vuelta actual, cronómetro, mejor/última vuelta,
 * delta, velocímetro, marcha, RPM y aviso de derrape. Fijo a la cámara.
 */
export class RaceHud {
  private readonly lapPanel: Phaser.GameObjects.Graphics;
  private readonly lapText: Phaser.GameObjects.Text;
  private readonly speedPanel: Phaser.GameObjects.Graphics;
  private readonly speedText: Phaser.GameObjects.Text;
  private readonly speedDetailText: Phaser.GameObjects.Text;
  private readonly rpmBar: Phaser.GameObjects.Graphics;
  private readonly driftText: Phaser.GameObjects.Text;
  private readonly speedPanelX: number;
  private readonly finishPanel: Phaser.GameObjects.Graphics;
  private readonly finishText: Phaser.GameObjects.Text;
  private readonly restartButton: Phaser.GameObjects.Text;
  private readonly menuButton: Phaser.GameObjects.Text;
  private readonly scene: Phaser.Scene;
  private readonly toastText: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, onRestart: () => void, onMenu: () => void) {
    this.scene = scene;
    this.lapPanel = scene.add.graphics().setScrollFactor(0).setDepth(99);
    this.lapText = scene.add
      .text(4 + PANEL_PADDING, 4 + PANEL_PADDING, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#fff176',
        lineSpacing: 2,
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.speedPanelX = scene.scale.width - SPEED_PANEL_MARGIN - SPEED_PANEL_WIDTH;
    this.speedPanel = scene.add.graphics().setScrollFactor(0).setDepth(99);
    this.speedPanel.fillStyle(PANEL_BG, 0.88);
    this.speedPanel.fillRect(
      this.speedPanelX,
      SPEED_PANEL_TOP,
      SPEED_PANEL_WIDTH,
      SPEED_PANEL_HEIGHT,
    );
    this.speedPanel.lineStyle(2, PANEL_BORDER, 1);
    this.speedPanel.strokeRect(
      this.speedPanelX,
      SPEED_PANEL_TOP,
      SPEED_PANEL_WIDTH,
      SPEED_PANEL_HEIGHT,
    );

    const right = this.speedPanelX + SPEED_PANEL_WIDTH - 6;
    this.speedText = scene.add
      .text(right, SPEED_PANEL_TOP + 2, '0', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffcc00',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.speedDetailText = scene.add
      .text(right, SPEED_PANEL_TOP + 26, 'km/h · M1', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#fff176',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.rpmBar = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.driftText = scene.add
      .text(right, SPEED_PANEL_TOP + 44, 'DRIFT', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#ff8800',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    this.finishPanel = scene.add.graphics().setScrollFactor(0).setDepth(100).setVisible(false);
    this.finishText = scene.add
      .text(scene.scale.width / 2, scene.scale.height / 2 - 16, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffcc00',
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);

    this.restartButton = scene.add
      .text(scene.scale.width / 2, scene.scale.height / 2 + 30, '► VOLVER A EMPEZAR ◄', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#000000',
        backgroundColor: '#ffcc00',
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onRestart);

    this.menuButton = scene.add
      .text(scene.scale.width / 2, scene.scale.height / 2 + 56, '⌂ MENÚ PRINCIPAL', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffffff',
        backgroundColor: '#202020',
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onMenu);

    this.toastText = scene.add
      .text(scene.scale.width / 2, scene.scale.height / 2 - 72, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffcc00',
        backgroundColor: '#000000',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(150)
      .setVisible(false);

    this.drawRpmBar(0);
  }

  update(
    state: LapTrackerState,
    currentLapElapsedMs: number,
    driving: DrivingHudState = EMPTY_DRIVING,
  ): void {
    const best = state.bestLapMs !== null ? formatLapTime(state.bestLapMs) : '--:--.---';
    const clock = state.finished
      ? formatLapTime(state.lastLapMs ?? 0)
      : formatLapTime(currentLapElapsedMs);

    const lines = [
      `\u{1F3C1} ${state.currentLap}/${state.totalLaps}`,
      `⏱ ${clock}`,
      `\u{1F3C6} ${best}`,
    ];
    if (state.lastLapMs !== null) {
      lines.push(`↺ ${formatLapTime(state.lastLapMs)}`);
      if (state.bestLapMs !== null) {
        lines.push(`Δ ${formatSignedDelta(state.lastLapMs - state.bestLapMs)}`);
      }
    }
    this.lapText.setText(lines.join('\n'));
    drawPanel(this.lapPanel, this.lapText);

    const display = getDriveDisplay(state.finished ? 0 : driving.speed, driving.maxSpeed);
    this.speedText.setText(`${Math.round(display.speedKmh)}`);
    this.speedDetailText.setText(`km/h · M${display.gear}`);
    this.drawRpmBar(display.rpm);
    this.driftText.setVisible(!state.finished && driving.isSkidding);

    if (state.finished && !this.finishText.visible) {
      this.finishText.setText(
        `\u{1F3C1} ¡META! \u{1F3C1}\nTiempo total: ${formatLapTime(driving.totalTimeMs)}\nMejor vuelta: ${best}`,
      );
      this.finishText.setVisible(true);
      drawPanel(this.finishPanel, this.finishText, 0xff3333);
      this.finishPanel.setVisible(true);
      this.restartButton.setVisible(true);
      this.menuButton.setVisible(true);
    }
  }

  /** Aviso breve (reset con penalización, etc.). */
  flashMessage(message: string, durationMs = 1500): void {
    this.toastText.setText(message);
    this.toastText.setVisible(true);
    this.toastTimer?.remove(false);
    this.toastTimer = this.scene.time.delayedCall(durationMs, () => {
      this.toastText.setVisible(false);
    });
  }

  private drawRpmBar(rpm: number): void {
    const x = this.speedPanelX + 6;
    const y = SPEED_PANEL_TOP + 38;
    const width = SPEED_PANEL_WIDTH - 12;
    const height = 5;
    const clamped = Math.max(0, Math.min(1, rpm));
    const color = clamped > 0.85 ? 0xff3c3c : clamped > 0.65 ? 0xffcc00 : 0x7cfc66;

    this.rpmBar.clear();
    this.rpmBar.fillStyle(0x333333, 1);
    this.rpmBar.fillRect(x, y, width, height);
    this.rpmBar.fillStyle(color, 1);
    this.rpmBar.fillRect(x, y, width * clamped, height);
    this.rpmBar.lineStyle(1, 0xffffff, 0.35);
    this.rpmBar.strokeRect(x, y, width, height);
  }
}
