# Changelog

Registro compacto por versión (ver `docs/ROADMAP.md` para el estado de alto
nivel). Entradas breves a propósito — el detalle de diseño ya vivido no se
repite aquí; si hace falta el porqué de una decisión concreta, se puede
recuperar del historial de commits.

## v0.1 — Prototipo jugable
- Vite + Phaser 3 + TypeScript; esquemas Zod para `track`/`car` (JSON con
  `schemaVersion`, principio de diseño por datos).
- Físicas arcade con derrape (`carPhysics.ts`), controles táctiles,
  circuito visible completo sin scroll.
- Menú de ajustes (⚙️) extensible: dificultad inicial + pantalla completa.
- Renderer `Phaser.CANVAS` (no WebGL): `Phaser.AUTO` dejaba el canvas en
  blanco en Chrome Android sin errores visibles.
- `errorOverlay.ts`: errores de arranque visibles en pantalla (depurar sin
  devtools en móvil).
- Dificultad recalibrada para reducir también velocidad máxima, no solo
  aceleración (el giro depende de la velocidad).

## v0.2 — Circuito y reglas
- Tilemap con superficies (asfalto/hierba) que afectan al agarre; muros
  con colisión.
- Meta y vueltas: `LapTracker` exige pasar los waypoints en orden
  (bug real corregido: contaba la vuelta al tocar el último checkpoint,
  no al cruzar meta). Cronómetro + mejor vuelta en HUD.
- Fix: radio de checkpoint 24px→40px y marcadores más grandes (no se
  activaban si no se pasaba justo por el centro del carril).
- `NextTargetIndicator`: anillo verde que señala el próximo objetivo.
- Meta a cuadros definida en datos (`waypoint.angle`/`width`), reubicada
  para ocupar el carril completo (antes flotaba sin tocar ninguna pared).
- Fase de fin de carrera + botón reinicio (bug corregido: `scene.restart()`
  reutiliza la instancia, `raceElapsedMs` no se reseteaba solo).
- Fix: un checkpoint contaba aunque se cruzara marcha atrás; ahora exige
  velocidad alineada con el sentido esperado del tramo.

## v0.3 — Estética 90s
- Pixel art generado por script (Pillow): coche, tiles de superficie/muro.
- HUD retro con marco tipo arcade e iconos por línea.
- Audio sintetizado (Python, sin bancos externos): motor con tono/volumen
  por velocidad, derrape en bucle, blips de checkpoint/meta.

## v0.4 — Pulido y feel
- Partículas de derrape (humo/polvo).
- Derrape más dramático en curva cerrada a velocidad, sin perder
  maniobrabilidad a baja velocidad/giro suave.
  - Bug real: el efecto no se notaba jugando pese a pasar los tests,
    porque los tests usaban un único paso de `dt` grande (0.2s) que no
    representa el juego real (~60 pasos/s). Corregido tras simular el
    bucle a `dt` real; añadidos tests con ese mismo patrón.
- Iteraciones de tuning por feedback en móvil (ángulo de derrape
  28°→41°→61°, luego rehecho por completo — ver siguiente punto).
- Fix: salir de pista frenaba en seco y rebotaba, causando tirones.
  Sustituido por fricción fuerte sin frenazo/rebote (`OFFTRACK_GRIP_RETENTION`).
- Fix: el coche no podía acercarse al borde de la pantalla (anillo
  exterior era muro sólido = borde literal del mapa). Abierto como arcén
  de hierba + recorte de posición (no bloquea) para que no desaparezca
  de cámara al derrapar hacia el borde.
- **Reescritura completa del modelo de giro** (dos iteraciones):
  1. Sistema "drift memory + techo de ángulo + sostenido por acelerador"
     (spec de usuario adaptada) — funcionaba en tests pero se sentía
     artificial; el contravolante no se notaba como recuperar el control.
  2. Sustituido por **inercia angular real** (`CarState.yawRate`): el
     volante marca una velocidad angular objetivo, no el ángulo directo;
     la velocidad angular real la persigue con retraso (mayor cuanto más
     patina el coche). Misma fórmula para iniciar y corregir un derrape,
     sin casos especiales. Converge solo a un derrape estable (~61° en
     curva cerrada) sin ningún techo artificial.
- Fix: freno de mano (espacio) dejaba de responder tras abrir ajustes
  porque el botón ⚙️ retenía el foco. `preventDefault` en su `mousedown`.

## v1.0 — Primera versión completa (en curso)
- Pantalla de inicio (`TitleScene`) + cuenta atrás 3·2·1·¡YA! antes de
  correr (coche congelado en parrilla hasta el "¡YA!", cronómetro
  arranca ahí). El primer gesto desbloquea el audio del navegador.
- Mejor vuelta guardada entre sesiones (`BestLaps.ts`, localStorage por
  circuito+coche; `LapTracker` acepta un valor semilla opcional).
- Sonido activable/desactivable en ajustes (`Settings.soundEnabled`,
  aplica `scene.sound.mute`, compartido por todo el juego).
- Dificultad (Fácil/Normal/Difícil) sustituida por tres sliders continuos
  — velocidad máxima, aceleración, agarre — cada uno un % del valor del
  coche activo (`carTuning.ts`). Límites acotados para que el coche siga
  cabiendo en las curvas del circuito en todo el rango. Agarre es un
  control nuevo (antes no ajustable).
  - `SettingsMenu` reescrito para construir el panel una sola vez y
    actualizar valores in-place (antes destruía/recreaba el DOM en cada
    cambio, lo que cortaba el arrastre de un slider nativo a mitad de
    gesto).
- Pendiente: circuito más variado (curvas, chicanes) y publicación en
  itch.io.
