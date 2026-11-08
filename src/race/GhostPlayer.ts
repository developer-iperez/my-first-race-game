import Phaser from 'phaser';
import type { GhostFrame, StoredGhost } from './GhostStore';

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Coche fantasma translúcido que reproduce la mejor vuelta guardada. No
 * participa en colisiones ni en la física: solo se mueve por interpolación
 * entre frames.
 */
export class GhostPlayer {
  private readonly sprite: Phaser.GameObjects.Image;
  private ghost: StoredGhost | null = null;

  constructor(scene: Phaser.Scene, length: number, width: number) {
    this.sprite = scene.add
      .image(0, 0, 'car-sprite')
      .setDisplaySize(length, width)
      .setAlpha(0.38)
      .setTint(0x66ccff)
      .setDepth(1)
      .setVisible(false);
  }

  setGhost(ghost: StoredGhost | null): void {
    this.ghost = ghost;
    this.sprite.setVisible(false);
  }

  hide(): void {
    this.sprite.setVisible(false);
  }

  update(elapsedMs: number, finished = false): void {
    if (!this.ghost || finished || this.ghost.frames.length === 0) {
      this.sprite.setVisible(false);
      return;
    }

    const frames = this.ghost.frames;
    const last = frames[frames.length - 1];
    if (elapsedMs > last[0] + 250) {
      this.sprite.setVisible(false);
      return;
    }

    const time = Phaser.Math.Clamp(elapsedMs, 0, last[0]);
    let index = 0;
    while (index + 1 < frames.length && frames[index + 1][0] <= time) index += 1;

    const from: GhostFrame = frames[index];
    const to: GhostFrame | undefined = frames[index + 1];
    const span = to ? to[0] - from[0] : 0;
    const t = to && span > 0 ? (time - from[0]) / span : 0;

    const x = to ? lerp(from[1], to[1], t) : from[1];
    const y = to ? lerp(from[2], to[2], t) : from[2];
    const angle = to ? lerp(from[3], to[3], t) : from[3];

    this.sprite.setPosition(x, y);
    this.sprite.setRotation(angle);
    this.sprite.setVisible(true);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
