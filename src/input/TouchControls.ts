export interface TouchInputState {
  throttleUp: boolean;
  throttleDown: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
}

/**
 * Controles táctiles en pantalla para jugar sin teclado físico (móvil/tablet).
 * Botones DOM superpuestos al canvas, no gestionados por Phaser: los pointer
 * events nativos dan multi-touch real (acelerar y girar con dedos distintos
 * a la vez), cosa que el input de un único puntero de Phaser no da gratis.
 */
export class TouchControls {
  readonly state: TouchInputState = {
    throttleUp: false,
    throttleDown: false,
    left: false,
    right: false,
    handbrake: false,
  };

  private readonly root: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'touch-controls';
    this.root.innerHTML = `
      <div class="touch-controls__cluster touch-controls__cluster--steer">
        <button type="button" class="touch-btn" data-action="left" aria-label="Girar izquierda">◀</button>
        <button type="button" class="touch-btn" data-action="right" aria-label="Girar derecha">▶</button>
      </div>
      <button type="button" class="touch-btn touch-btn--handbrake" data-action="handbrake" aria-label="Freno de mano">✋</button>
      <div class="touch-controls__cluster touch-controls__cluster--pedals">
        <button type="button" class="touch-btn" data-action="throttleUp" aria-label="Acelerar">▲</button>
        <button type="button" class="touch-btn" data-action="throttleDown" aria-label="Frenar">▼</button>
      </div>
    `;
    parent.appendChild(this.root);

    this.root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
      const action = button.dataset.action as keyof TouchInputState;

      const press = (event: PointerEvent): void => {
        event.preventDefault();
        this.state[action] = true;
        button.classList.add('is-active');
      };
      const release = (event: PointerEvent): void => {
        event.preventDefault();
        this.state[action] = false;
        button.classList.remove('is-active');
      };

      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('pointerleave', release);
      // Evita el menú contextual de "mantener pulsado" en móvil.
      button.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  destroy(): void {
    this.root.remove();
  }
}
