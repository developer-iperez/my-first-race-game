import Phaser from 'phaser';

/**
 * Sonido de carrera, sintetizado (sin bancos de audio externos, ver
 * public/audio/): motor en bucle (tono y volumen según velocidad),
 * derrape en bucle mientras se derrapa, y un efecto puntual para
 * checkpoint/meta.
 */
export class RaceAudio {
  private readonly engine: Phaser.Sound.WebAudioSound;
  private readonly skid: Phaser.Sound.WebAudioSound;
  private readonly checkpoint: Phaser.Sound.WebAudioSound;
  private readonly finish: Phaser.Sound.WebAudioSound;
  private wasSkidding = false;

  constructor(scene: Phaser.Scene) {
    this.engine = scene.sound.add('sfx-engine') as Phaser.Sound.WebAudioSound;
    this.skid = scene.sound.add('sfx-skid') as Phaser.Sound.WebAudioSound;
    this.checkpoint = scene.sound.add('sfx-checkpoint') as Phaser.Sound.WebAudioSound;
    this.finish = scene.sound.add('sfx-finish') as Phaser.Sound.WebAudioSound;

    this.engine.play({ loop: true, volume: 0.1 });
  }

  /** Cada frame: ajusta el motor a la velocidad actual y enciende/apaga el derrape. */
  update(speed: number, maxSpeed: number, skidding: boolean): void {
    const normalized = Phaser.Math.Clamp(maxSpeed > 0 ? speed / maxSpeed : 0, 0, 1);
    this.engine.setVolume(0.1 + normalized * 0.3);
    this.engine.setRate(0.7 + normalized * 1.1);

    if (skidding && !this.wasSkidding) {
      this.skid.play({ loop: true, volume: 0.45 });
    } else if (!skidding && this.wasSkidding) {
      this.skid.stop();
    }
    this.wasSkidding = skidding;
  }

  playCheckpoint(): void {
    this.checkpoint.play({ volume: 0.6 });
  }

  /** Fanfarria de meta; corta los bucles de motor/derrape (el coche se congela). */
  playFinish(): void {
    this.finish.play({ volume: 0.7 });
    this.stopLoops();
  }

  stopLoops(): void {
    this.engine.stop();
    if (this.wasSkidding) {
      this.skid.stop();
      this.wasSkidding = false;
    }
  }

  destroy(): void {
    this.engine.destroy();
    this.skid.destroy();
    this.checkpoint.destroy();
    this.finish.destroy();
  }
}
