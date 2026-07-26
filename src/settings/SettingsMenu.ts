import { Settings, type GameSettings } from './Settings';
import { CAR_TUNING_BOUNDS, type CarTuning } from './carTuning';
import { isFullscreenActive, isFullscreenSupported, toggleFullscreen } from './Fullscreen';

function formatTuningValue(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Menú de ajustes del jugador: un botón (⚙️) que abre un panel modal.
 * Pensado para crecer — añadir un ajuste nuevo es una fila más en
 * buildPanel() y una clave en GameSettings, sin tocar nada más del juego.
 *
 * El panel se construye UNA sola vez (no se destruye/recrea en cada
 * cambio): los sliders son elementos <input type="range"> nativos, y
 * sustituir su nodo del DOM a mitad de un arrastre (como hacía la versión
 * anterior, con un `render()` que volvía a montar todo el panel en cada
 * `Settings.onChange`) corta el gesto de arrastre del navegador. En su
 * lugar, `refresh()` solo actualiza el valor/texto de los controles ya
 * existentes.
 */
export class SettingsMenu {
  private readonly button: HTMLButtonElement;
  private readonly overlay: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly unsubscribe: () => void;
  private readonly onFullscreenChange = (): void => this.refresh();
  private _isOpen = false;

  private readonly sliderInputs = {} as Record<keyof CarTuning, HTMLInputElement>;
  private readonly sliderValueTexts = {} as Record<keyof CarTuning, HTMLSpanElement>;
  private soundButton?: HTMLButtonElement;
  private fullscreenButton?: HTMLButtonElement;
  private telemetryButton?: HTMLButtonElement;
  private readonly onExitToMenu?: () => void;

  /**
   * onExitToMenu: si se pasa, añade un botón "Volver al menú" al panel (solo
   * tiene sentido durante una carrera, para poder cambiar de circuito — en
   * TitleScene no se pasa, porque ya es el menú).
   */
  constructor(parent: HTMLElement, onExitToMenu?: () => void) {
    this.onExitToMenu = onExitToMenu;
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'settings-btn';
    this.button.setAttribute('aria-label', 'Ajustes');
    this.button.textContent = '⚙️';
    this.button.addEventListener('click', () => this.open());
    // Evitar que el botón se quede con el foco del teclado al pulsarlo: si lo
    // retiene, la barra espaciadora (freno de mano) volvería a "clicarlo" y
    // abriría los ajustes en vez de frenar. Con preventDefault en mousedown
    // el clic sigue funcionando pero el foco se queda en el body y el
    // espacio siempre llega al juego.
    this.button.addEventListener('mousedown', (event) => event.preventDefault());

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

    this.buildPanel();
    this.refresh();
    this.unsubscribe = Settings.onChange(() => this.refresh());
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', this.onFullscreenChange);
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
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', this.onFullscreenChange);
    this.button.remove();
    this.overlay.remove();
  }

  private buildPanel(): void {
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

    for (const key of Object.keys(CAR_TUNING_BOUNDS) as (keyof CarTuning)[]) {
      this.panel.appendChild(this.buildTuningSliderRow(key));
    }
    this.panel.appendChild(this.buildSoundRow());
    if (isFullscreenSupported()) {
      this.panel.appendChild(this.buildFullscreenRow());
    }
    this.panel.appendChild(this.buildTelemetryRow());
    if (this.onExitToMenu) {
      this.panel.appendChild(this.buildExitToMenuRow());
    }

    // Futuros ajustes: añadir aquí más filas con this.panel.appendChild(...),
    // y su actualización correspondiente en refresh().
  }

  /** Vuelve a reflejar el estado actual en los controles ya construidos, sin recrear ningún nodo del DOM. */
  private refresh(): void {
    const settings = Settings.get();

    for (const key of Object.keys(CAR_TUNING_BOUNDS) as (keyof CarTuning)[]) {
      this.sliderInputs[key].value = String(settings[key]);
      this.sliderValueTexts[key].textContent = formatTuningValue(settings[key]);
    }

    if (this.soundButton) {
      this.soundButton.textContent = settings.soundEnabled ? 'Sonido activado 🔊' : 'Sonido desactivado 🔇';
    }
    if (this.fullscreenButton) {
      this.fullscreenButton.textContent = isFullscreenActive() ? 'Salir de pantalla completa' : 'Pantalla completa';
    }
    if (this.telemetryButton) {
      this.telemetryButton.textContent = settings.debugTelemetryEnabled
        ? 'Telemetría conducción: ON 📊'
        : 'Telemetría conducción: off';
    }
  }

  private buildSoundRow(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'settings-row';

    const label = document.createElement('div');
    label.className = 'settings-row__label';
    label.textContent = 'Sonido';
    row.appendChild(label);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'settings-option settings-option--wide';
    btn.addEventListener('click', () => Settings.update({ soundEnabled: !Settings.get().soundEnabled }));
    row.appendChild(btn);
    this.soundButton = btn;

    return row;
  }

  /** Muestra/oculta el HUD de telemetría de conducción (velocidad, % derrape, agarre...). */
  private buildTelemetryRow(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'settings-row';

    const label = document.createElement('div');
    label.className = 'settings-row__label';
    label.textContent = 'Telemetría';
    row.appendChild(label);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'settings-option settings-option--wide';
    btn.addEventListener('click', () =>
      Settings.update({ debugTelemetryEnabled: !Settings.get().debugTelemetryEnabled }),
    );
    row.appendChild(btn);
    this.telemetryButton = btn;

    return row;
  }

  private buildFullscreenRow(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'settings-row';

    const label = document.createElement('div');
    label.className = 'settings-row__label';
    label.textContent = 'Pantalla';
    row.appendChild(label);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'settings-option settings-option--wide';
    btn.addEventListener('click', () => {
      toggleFullscreen().catch(() => {
        // Algunos navegadores (p. ej. Safari en iPhone) no soportan la
        // Fullscreen API en elementos genéricos; no hay nada más que hacer.
      });
    });
    row.appendChild(btn);
    this.fullscreenButton = btn;

    return row;
  }

  /** Botón para abandonar la carrera en curso y volver a la pantalla de título (elegir otro circuito). */
  private buildExitToMenuRow(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'settings-row';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'settings-option settings-option--wide';
    btn.textContent = '🏁 Volver al menú (elegir circuito)';
    btn.addEventListener('click', () => {
      this.close();
      this.onExitToMenu?.();
    });
    row.appendChild(btn);

    return row;
  }

  /** Un slider de conducción (velocidad máxima / aceleración / agarre), leyendo sus límites de CAR_TUNING_BOUNDS. */
  private buildTuningSliderRow(key: keyof CarTuning): HTMLElement {
    const bounds = CAR_TUNING_BOUNDS[key];

    const row = document.createElement('div');
    row.className = 'settings-row';

    const label = document.createElement('div');
    label.className = 'settings-row__label settings-row__label--slider';
    const labelText = document.createElement('span');
    labelText.textContent = bounds.label;
    const valueText = document.createElement('span');
    valueText.className = 'settings-row__value';
    label.append(labelText, valueText);
    row.appendChild(label);
    this.sliderValueTexts[key] = valueText;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'settings-slider';
    slider.min = String(bounds.min);
    slider.max = String(bounds.max);
    slider.step = String(bounds.step);
    // 'input' (no 'change'): se aplica en caliente mientras se arrastra, igual
    // que el resto de ajustes reactivos del juego. refresh() ya se encarga de
    // reflejar el valor final tras el Settings.update() que dispara esto.
    slider.addEventListener('input', () => {
      Settings.update({ [key]: Number(slider.value) } as Partial<GameSettings>);
    });
    row.appendChild(slider);
    this.sliderInputs[key] = slider;

    return row;
  }
}
