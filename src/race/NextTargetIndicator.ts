import Phaser from 'phaser';
import type { Waypoint } from '../config/schema/track';

/**
 * Señala la próxima puerta: línea perpendicular a la dirección de carrera,
 * postes en los extremos y una flecha en el sentido en que hay que cruzarla.
 * Si el waypoint antiguo no tiene angle/width, cae al anillo pulsante.
 */
export class NextTargetIndicator {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    // Por encima del HUD: si la puerta cae detrás de un panel, el jugador
    // debe seguir viendo la línea y la flecha del próximo objetivo.
    this.graphics = scene.add.graphics().setDepth(102);
  }

  update(waypoint: Waypoint, elapsedMs: number): void {
    const pulse = 0.55 + Math.sin(elapsedMs / 180) * 0.2;
    this.graphics.clear();

    if (waypoint.angle === undefined || waypoint.width === undefined) {
      const radius = 12 + Math.sin(elapsedMs / 180) * 3;
      this.graphics.fillStyle(0x00ff66, 0.18);
      this.graphics.fillCircle(waypoint.x, waypoint.y, radius);
      this.graphics.lineStyle(2, 0x00ff66, 1);
      this.graphics.strokeCircle(waypoint.x, waypoint.y, radius);
      return;
    }

    const angle = Phaser.Math.DegToRad(waypoint.angle);
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    const perpendicular = { x: -direction.y, y: direction.x };
    const halfWidth = waypoint.width / 2;

    const left = {
      x: waypoint.x - perpendicular.x * halfWidth,
      y: waypoint.y - perpendicular.y * halfWidth,
    };
    const right = {
      x: waypoint.x + perpendicular.x * halfWidth,
      y: waypoint.y + perpendicular.y * halfWidth,
    };

    this.graphics.lineStyle(3, 0x00ff66, pulse);
    this.graphics.lineBetween(left.x, left.y, right.x, right.y);

    this.graphics.fillStyle(0x00ff66, Math.min(1, pulse + 0.2));
    this.graphics.fillCircle(left.x, left.y, 4);
    this.graphics.fillCircle(right.x, right.y, 4);

    const arrowLength = 18;
    const tip = {
      x: waypoint.x + direction.x * arrowLength,
      y: waypoint.y + direction.y * arrowLength,
    };
    const tail = {
      x: waypoint.x + direction.x * 4,
      y: waypoint.y + direction.y * 4,
    };
    this.graphics.lineStyle(2, 0x00ff66, pulse + 0.2);
    this.graphics.lineBetween(tail.x, tail.y, tip.x, tip.y);

    const wing = 6;
    const back = { x: tip.x - direction.x * wing, y: tip.y - direction.y * wing };
    this.graphics.lineBetween(
      tip.x,
      tip.y,
      back.x + perpendicular.x * wing,
      back.y + perpendicular.y * wing,
    );
    this.graphics.lineBetween(
      tip.x,
      tip.y,
      back.x - perpendicular.x * wing,
      back.y - perpendicular.y * wing,
    );
  }

  hide(): void {
    this.graphics.clear();
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
