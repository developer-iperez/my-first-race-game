/**
 * Envoltorio fino sobre la Fullscreen API nativa del navegador. No depende
 * de Phaser a propósito: el menú de ajustes es DOM aparte del juego (mismo
 * enfoque que TouchControls), así que pide pantalla completa sobre
 * document.documentElement directamente.
 */

interface VendorDocument extends Document {
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
}

interface VendorElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
}

export function isFullscreenSupported(): boolean {
  const doc = document as VendorDocument;
  return Boolean(document.fullscreenEnabled || doc.webkitFullscreenElement !== undefined);
}

export function isFullscreenActive(): boolean {
  const doc = document as VendorDocument;
  return Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
}

export async function toggleFullscreen(): Promise<void> {
  const doc = document as VendorDocument;
  const root = document.documentElement as VendorElement;

  if (isFullscreenActive()) {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
    return;
  }

  if (root.requestFullscreen) await root.requestFullscreen();
  else if (root.webkitRequestFullscreen) await root.webkitRequestFullscreen();
}
