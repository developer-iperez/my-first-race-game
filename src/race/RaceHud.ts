import Phaser from 'phaser';
import type { LapTrackerState } from './LapTracker';
import { formatLapTime } from './formatTime';

/**
 * HUD mínimo de carrera: vuelta actual, cronómetro y mejor vuelta, más un
 * aviso al completar la carrera con un botón para volver a empezar. Fijo a
 * la cámara (no se mueve ni escala con el circuito).
 */
export class RaceHud {
  private readonly lapText: Phaser.GameObjects.Text;
  private readonly finishText: Phaser.GameObjects.Text;
  private readonly restartButton: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, onRestart: () => void) {
    this.lapText = scene.add
      .text(4, 4, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 3, y: 2 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.finishText = scene.add
      .text(scene.scale.width / 2, scene.scale.height / 2 - 16, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffcc00',
        backgroundColor: '#000000cc',
        align: 'center',
        padding: { x: 8, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);

    this.restartButton = scene.add
      .text(scene.scale.width / 2, scene.scale.height / 2 + 28, 'Volver a empezar', {
        fontFamily: 'monospace',
        fontSize: '11px',
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
      `Vuelta ${state.currentLap}/${state.totalLaps}\n${clock}\nMejor: ${best}`,
    );

    if (state.finished && !this.finishText.visible) {
      this.finishText.setText(`¡Meta!\nMejor vuelta: ${best}`);
      this.finishText.setVisible(true);
      this.restartButton.setVisible(true);
    }
  }
}
