/**
 * Muestra un error de forma visible en la propia página. En un móvil sin
 * herramientas de desarrollador, una pantalla en blanco no dice nada; esto
 * da algo que el jugador pueda leer o hacer una captura y compartir.
 */
export function showFatalError(message: string): void {
  let overlay = document.getElementById('fatal-error-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'fatal-error-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: #3a0000;
      color: #fff;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      padding: 16px;
      overflow: auto;
      white-space: pre-wrap;
      box-sizing: border-box;
    `;
    const title = document.createElement('div');
    title.textContent = '⚠️ Error al cargar el juego';
    title.style.cssText = 'font-size: 18px; font-weight: bold; margin-bottom: 12px;';
    overlay.appendChild(title);
    document.body.appendChild(overlay);
  }

  const line = document.createElement('div');
  line.textContent = message;
  line.style.marginTop = '8px';
  overlay.appendChild(line);
}
