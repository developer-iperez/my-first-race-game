import Phaser from 'phaser';

export interface PauseMenuCallbacks {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
}

const PANEL_WIDTH = 280;
const PANEL_HEIGHT = 164;
const PANEL_BG = 0x0a0a0a;
const PANEL_BORDER = 0xffcc00;

/**
 * Menú de pausa en Phaser. Se abre con P/Esc y congela la carrera desde
 * RaceScene; los botones siguen siendo interactivos porque la escena no se
 * detiene, solo nuestra lógica de simulación.
 */
export class PauseMenu {
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly buttons: Phaser.GameObjects.Text[] = [];
  private visible = false;

  constructor(scene: Phaser.Scene, callbacks: PauseMenuCallbacks) {
    const x = (scene.scale.width - PANEL_WIDTH) / 2;
    const y = (scene.scale.height - PANEL_HEIGHT) / 2;
    const centerX = scene.scale.width / 2;

    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(300);
    this.panel.fillStyle(PANEL_BG, 0.94);
    this.panel.fillRect(x, y, PANEL_WIDTH, PANEL_HEIGHT);
    this.panel.lineStyle(2, PANEL_BORDER, 1);
    this.panel.strokeRect(x, y, PANEL_WIDTH, PANEL_HEIGHT);

    this.title = scene.add
      .text(centerX, y + 18, 'PAUSA', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffcc00',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(301);

    this.hint = scene.add
      .text(centerX, y + 44, 'P / ESC para reanudar', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#fff176',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(301);

    const entries: { label: string; callback: () => void; color: string }[] = [
      { label: '▶ REANUDAR', callback: callbacks.onResume, color: '#ffcc00' },
      { label: '↻ REINICIAR CARRERA', callback: callbacks.onRestart, color: '#ffffff' },
      { label: '⌂ VOLVER AL MENÚ', callback: callbacks.onMenu, color: '#ffffff' },
    ];

    entries.forEach((entry, index) => {
      const button = scene.add
        .text(centerX, y + 68 + index * 28, entry.label, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: entry.color,
          backgroundColor: '#202020',
          padding: { x: 12, y: 4 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(301)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', entry.callback);
      this.buttons.push(button);
    });

    this.setVisible(false);
  }

  get isOpen(): boolean {
    return this.visible;
  }

  show(): void {
    this.visible = true;
    this.setVisible(true);
  }

  hide(): void {
    this.visible = false;
    this.setVisible(false);
  }

  private setVisible(visible: boolean): void {
    this.panel.setVisible(visible);
    this.title.setVisible(visible);
    this.hint.setVisible(visible);
    for (const button of this.buttons) button.setVisible(visible);
  }

  destroy(): void {
    this.panel.destroy();
    this.title.destroy();
    this.hint.destroy();
    for (const button of this.buttons) button.destroy();
  }
}
