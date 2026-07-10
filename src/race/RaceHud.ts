import Phaser from 'phaser';
import type { LapTrackerState } from './LapTracker';
import { formatLapTime } from './formatTime';

const PANEL_PADDING = 4;
const PANEL_BG = 0x0a0a0a;
const PANEL_BORDER = 0xffcc00;

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
 * HUD estilo marcador arcade: vuelta actual, cronómetro y mejor vuelta,
 * más un aviso al completar la carrera con un botón para volver a
 * empezar. Fijo a la cámara (no se mueve ni escala con el circuito).
 */
export class RaceHud {
  private readonly lapPanel: Phaser.GameObjects.Graphics;
  private readonly lapText: Phaser.GameObjects.Text;
  private readonly finishPanel: Phaser.GameObjects.Graphics;
  private readonly finishText: Phaser.GameObjects.Text;
  private readonly restartButton: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, onRestart: () => void) {
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
  }

  update(state: LapTrackerState, currentLapElapsedMs: number): void {
    const best = state.bestLapMs !== null ? formatLapTime(state.bestLapMs) : '--:--.---';
    const clock = state.finished ? formatLapTime(state.lastLapMs ?? 0) : formatLapTime(currentLapElapsedMs);

    this.lapText.setText(
      `\u{1F3C1} ${state.currentLap}/${state.totalLaps}\n⏱ ${clock}\n\u{1F3C6} ${best}`,
    );
    drawPanel(this.lapPanel, this.lapText);

    if (state.finished && !this.finishText.visible) {
      this.finishText.setText(`\u{1F3C1} ¡META! \u{1F3C1}\nMejor vuelta: ${best}`);
      this.finishText.setVisible(true);
      drawPanel(this.finishPanel, this.finishText, 0xff3333);
      this.finishPanel.setVisible(true);
      this.restartButton.setVisible(true);
    }
  }
}
