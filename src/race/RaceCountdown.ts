import Phaser from 'phaser';

/**
 * Cuenta atrás de salida "3 · 2 · 1 · ¡YA!" sobre el circuito. Mientras
 * muestra 3/2/1 el coche está congelado en la parrilla (la escena consulta
 * update() cada frame y no procesa carrera mientras devuelva `true`); al
 * llegar a "¡YA!" arranca la carrera y el cartel se queda un instante más
 * antes de desaparecer.
 *
 * La lógica de tiempos es pura y determinista (solo depende de cuánto dt se
 * le va pasando), así que la salida es siempre igual independientemente del
 * framerate real.
 */
const STEP_MS = 700;
const GO_HOLD_MS = 600;
/** Etiquetas de los pasos previos al "¡YA!" (uno por STEP_MS). */
const STEP_LABELS = ['3', '2', '1'];

export class RaceCountdown {
  private readonly text: Phaser.GameObjects.Text;
  private readonly onBeep: (final: boolean) => void;
  private elapsedMs = 0;
  private lastStep = -1;
  private finished = false;

  constructor(scene: Phaser.Scene, onBeep: (final: boolean) => void) {
    this.onBeep = onBeep;
    this.text = scene.add
      .text(scene.scale.width / 2, scene.scale.height / 2, '', {
        fontFamily: 'monospace',
        fontSize: '52px',
        color: '#ffcc00',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200);
  }

  /**
   * Avanza la cuenta atrás con el dt del frame. Devuelve `true` mientras el
   * coche debe seguir congelado en la parrilla (mostrando 3/2/1); en cuanto
   * aparece "¡YA!" devuelve `false` y la carrera puede arrancar.
   */
  update(deltaMs: number): boolean {
    if (this.finished) return false;

    this.elapsedMs += deltaMs;
    const step = Math.floor(this.elapsedMs / STEP_MS); // 0,1,2 => 3,2,1 ; 3 => ¡YA!

    if (step !== this.lastStep && step <= STEP_LABELS.length) {
      this.lastStep = step;
      const isGo = step === STEP_LABELS.length;
      this.text.setText(isGo ? '¡YA!' : STEP_LABELS[step]);
      this.text.setColor(isGo ? '#7cfc66' : '#ffcc00');
      // Pequeño "pop" al cambiar de número, para que se note el ritmo.
      this.text.setScale(1.5);
      this.text.scene.tweens.add({
        targets: this.text,
        scale: 1,
        duration: 260,
        ease: 'Back.easeOut',
      });
      this.onBeep(isGo);
    }

    // Congelado mientras se muestran los números (3/2/1); en "¡YA!" se suelta.
    const frozen = this.elapsedMs < STEP_LABELS.length * STEP_MS;

    if (this.elapsedMs >= STEP_LABELS.length * STEP_MS + GO_HOLD_MS) {
      this.text.setVisible(false);
      this.finished = true;
    }

    return frozen;
  }

  destroy(): void {
    this.text.destroy();
  }
}
