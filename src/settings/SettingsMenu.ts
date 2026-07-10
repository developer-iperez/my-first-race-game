import { Settings, type GameSettings } from './Settings';
import { DIFFICULTY_LEVELS, DIFFICULTY_PRESETS } from './difficulty';

/**
 * Menú de ajustes del jugador: un botón (⚙️) que abre un panel modal.
 * Pensado para crecer — añadir un ajuste nuevo es añadir una fila en
 * render() y una clave en GameSettings, sin tocar nada más del juego.
 */
export class SettingsMenu {
  private readonly button: HTMLButtonElement;
  private readonly overlay: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly unsubscribe: () => void;
  private _isOpen = false;

  constructor(parent: HTMLElement) {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'settings-btn';
    this.button.setAttribute('aria-label', 'Ajustes');
    this.button.textContent = '⚙️';
    this.button.addEventListener('click', () => this.open());

    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-overlay';
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) this.close();
    });

    this.panel = document.createElement('div');
    this.panel.className = 'settings-panel';
    this.overlay.appendChild(this.panel);

    parent.appendChild(this.button);
    parent.appendChild(this.overlay);

    this.render();
    this.unsubscribe = Settings.onChange(() => this.render());
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  open(): void {
    this._isOpen = true;
    this.overlay.classList.add('is-open');
  }

  close(): void {
    this._isOpen = false;
    this.overlay.classList.remove('is-open');
  }

  destroy(): void {
    this.unsubscribe();
    this.button.remove();
    this.overlay.remove();
  }

  private render(): void {
    const settings = Settings.get();
    this.panel.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'settings-panel__header';
    const title = document.createElement('h2');
    title.textContent = 'Ajustes';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'settings-close';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.close());
    header.append(title, closeBtn);
    this.panel.appendChild(header);

    this.panel.appendChild(this.buildDifficultyRow(settings));

    // Futuros ajustes: añadir aquí más filas con this.panel.appendChild(...).
  }

  private buildDifficultyRow(settings: GameSettings): HTMLElement {
    const row = document.createElement('div');
    row.className = 'settings-row';

    const label = document.createElement('div');
    label.className = 'settings-row__label';
    label.textContent = 'Dificultad (aceleración)';
    row.appendChild(label);

    const options = document.createElement('div');
    options.className = 'settings-row__options';
    for (const level of DIFFICULTY_LEVELS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = DIFFICULTY_PRESETS[level].label;
      btn.className =
        'settings-option' + (settings.difficulty === level ? ' is-selected' : '');
      btn.addEventListener('click', () => Settings.update({ difficulty: level }));
      options.appendChild(btn);
    }
    row.appendChild(options);

    return row;
  }
}
