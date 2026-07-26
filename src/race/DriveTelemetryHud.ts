import Phaser from 'phaser';
import type { DriveTelemetry } from '../physics/carPhysics';

/**
 * HUD de depuración de conducción: expone en pantalla los valores
 * intermedios de la física (agarre efectivo, si se ha detectado un flick,
 * freno de mano...) frame a frame. Pensado para diagnosticar la SENSACIÓN
 * de conducción jugando en el móvil, donde no hay devtools para leer un
 * console.log en directo — el jugador puede leer estos números (o hacer
 * una captura) y reportarlos en vez de solo describir "no se nota".
 *
 * Temporal a propósito mientras se ajusta la física del derrape/freno de
 * mano: quitar (o hacer que dependa de un ajuste) una vez esté afinada.
 */
export class DriveTelemetryHud {
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(98);
    this.text = scene.add
      .text(4, scene.scale.height - 4, '', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#00ff88',
        lineSpacing: 1,
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(99);
  }

  setVisible(visible: boolean): void {
    this.panel.setVisible(visible);
    this.text.setVisible(visible);
  }

  update(telemetry: DriveTelemetry | undefined): void {
    if (!telemetry || !this.text.visible) return;

    const lines = [
      `speed ${telemetry.speed.toFixed(0)} (${(telemetry.speedFactor * 100).toFixed(0)}%)`,
      `slip ${(telemetry.slipRatio * 100).toFixed(0)}%  grip ${(telemetry.effectiveLateralGrip * 100).toFixed(0)}%  loss ${(telemetry.corneringGripLoss * 100).toFixed(0)}%`,
      `handbrake ${telemetry.handbrake ? 'ON' : 'off'}  flick ${telemetry.isFlick ? `ON ${(telemetry.flickStrength * 100).toFixed(0)}%` : 'off'}`,
    ];
    this.text.setText(lines.join('\n'));

    const x = this.text.x;
    const y = this.text.y - this.text.height;
    this.panel.clear();
    this.panel.fillStyle(0x000000, 0.55);
    this.panel.fillRect(x, y, this.text.width + 4, this.text.height + 4);
  }

  destroy(): void {
    this.panel.destroy();
    this.text.destroy();
  }
}
