import Phaser from 'phaser';

const MAX_SEGMENTS = 800;

const SURFACE_COLORS: Record<string, number> = {
  asphalt: 0x3a4148,
  grass: 0x2d522b,
  sand: 0x9b7d4e,
  offtrack: 0x5b4b39,
  wall: 0x3a4148,
};

/**
 * Marcas de neumático persistentes en el asfalto. Se dibujan como segmentos
 * de dos líneas (rueda trasera izquierda/derecha) sobre un Graphics de poca
 * profundidad. Se limitan para no crecer sin control durante la carrera.
 */
export class SkidMarks {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private previousLeft: { x: number; y: number } | null = null;
  private previousRight: { x: number; y: number } | null = null;
  private segments = 0;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(0.5);
  }

  update(
    x: number,
    y: number,
    angle: number,
    skidding: boolean,
    surfaceKey = 'asphalt',
    rearOffset = 20,
    halfWidth = 12,
  ): void {
    if (!skidding) {
      this.previousLeft = null;
      this.previousRight = null;
      return;
    }

    const forward = { x: Math.cos(angle), y: Math.sin(angle) };
    const right = { x: -forward.y, y: forward.x };
    const rearX = x - forward.x * rearOffset;
    const rearY = y - forward.y * rearOffset;
    const left = { x: rearX - right.x * halfWidth, y: rearY - right.y * halfWidth };
    const rightWheel = { x: rearX + right.x * halfWidth, y: rearY + right.y * halfWidth };

    if (this.previousLeft && this.previousRight) {
      const color = SURFACE_COLORS[surfaceKey] ?? SURFACE_COLORS.asphalt;
      this.graphics.lineStyle(2, color, 0.32);
      this.graphics.lineBetween(this.previousLeft.x, this.previousLeft.y, left.x, left.y);
      this.graphics.lineBetween(
        this.previousRight.x,
        this.previousRight.y,
        rightWheel.x,
        rightWheel.y,
      );

      this.segments += 1;
      if (this.segments > MAX_SEGMENTS) {
        this.graphics.clear();
        this.segments = 0;
      }
    }

    this.previousLeft = left;
    this.previousRight = rightWheel;
  }

  clear(): void {
    this.graphics.clear();
    this.segments = 0;
    this.previousLeft = null;
    this.previousRight = null;
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
