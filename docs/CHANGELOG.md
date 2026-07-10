# Changelog

Todos los cambios notables de este proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y versionado según [SemVer](https://semver.org/lang/es/).

## [Unreleased]
### Added
- Documentación inicial: análisis técnico y de gestión (`docs/ANALISIS.md`),
  roadmap (`docs/ROADMAP.md`) y andamiaje de gestión del proyecto
  (plantillas de issues).
- Principio de **diseño orientado a datos** (requisitos A1/A2): circuitos y coches
  definidos por JSON con esquema versionado, con borradores de esquema y su impacto
  en la arquitectura, para permitir nuevos circuitos/vehículos a futuro (a mano o
  con editor) sin tocar la lógica del juego.
- Esqueleto del proyecto: Vite + Phaser 3 + TypeScript, ESLint/Prettier, Vitest.
- Esquemas de datos con Zod (`src/config/schema/track.ts`, `car.ts`) y sus
  cargadores/validadores (`TrackLoader`, `CarLoader`), con `schemaVersion` desde
  el día uno (requisitos A1/A2).
- Circuito de ejemplo `public/tracks/rally-01.json` (óvalo con isla interior,
  superficies asfalto/hierba, muros, waypoints) y coche de ejemplo
  `public/cars/rally-hatch.json`.
- Modelo de físicas arcade con derrape (`src/physics/carPhysics.ts`): aceleración,
  frenado, giro proporcional a la velocidad y descomposición de la velocidad en
  componente longitudinal/lateral con agarre configurable (incluye freno de mano);
  función pura, cubierta con tests de Vitest.
- Entidad `Car` y escenas `Boot`/`Race` de Phaser: cámara fija que encuadra el
  circuito completo, render del tilemap por datos, colisión simple con muros,
  cambio de color al derrapar.
- CI (lint + test + build) y despliegue automático a GitHub Pages vía GitHub
  Actions.
- Controles táctiles en pantalla (`src/input/TouchControls.ts`) para jugar en
  móvil/tablet sin teclado físico: botones DOM con pointer events multi-touch
  (acelerar y girar a la vez con dedos distintos), combinados con el teclado.
  Aviso de "gira el dispositivo" en vertical, ya que el circuito es panorámico
  (F3, se ve completo sin scroll) y en vertical el canvas queda muy pequeño.

### Fixed
- El juego no se veía en Chrome para Android (solo se veían los controles
  táctiles, canvas en blanco, sin errores visibles): causado por WebGL vía
  `Phaser.AUTO`. Confirmado y resuelto con el cambio a `Phaser.CANVAS` de
  más abajo.

### Changed
- Renderer de Phaser: de `Phaser.AUTO` (WebGL con fallback a Canvas) a
  `Phaser.CANVAS` explícito. El juego solo dibuja formas simples (sin
  shaders), así que no aporta nada usar WebGL y sí puede fallar en
  navegadores/GPUs móviles menos habituales — con Canvas 2D se evita esa
  categoría entera de fallos silenciosos ("no se ve el juego" sin ningún
  error visible).

### Added (debug)
- `src/debug/errorOverlay.ts`: si algo falla al arrancar (carga de datos,
  inicialización de Phaser, cualquier excepción no capturada), se muestra un
  aviso legible en la propia pantalla en vez de dejarla en blanco —
  imprescindible para depurar en un móvil sin herramientas de desarrollador.

### Added
- Menú de ajustes del jugador (`src/settings/`): botón ⚙️ que abre un panel
  con el primer ajuste, **dificultad** (Fácil/Normal/Difícil), que escala la
  potencia del motor y la velocidad máxima del coche activo. Persiste en
  `localStorage` y se aplica en caliente sin recargar. Pensado para crecer:
  añadir un ajuste nuevo es una fila más en `SettingsMenu` y una clave más
  en `GameSettings`, sin tocar el resto del juego — mismo principio que los
  datos de circuito/coche (§3.7 de `ANALISIS.md`), pero para preferencias
  del jugador, no para la definición del vehículo.
- Opción de **pantalla completa** en el menú de ajustes (`src/settings/Fullscreen.ts`,
  Fullscreen API nativa), para el caso en que la barra del navegador móvil
  recorta la vista del juego. `#app` también usa `100dvh` (con fallback a
  `100vh`) como mejora adicional sin necesidad de activar pantalla completa.

### Changed
- Recalibrada la dificultad tras seguir costando de controlar incluso en
  "Fácil": ahora también reduce la **velocidad máxima** por nivel, no solo
  la aceleración (el giro depende de la velocidad, así que bajarla también
  ayuda a tomar curvas). "Difícil" mantiene siempre los valores originales
  del coche (potencia 900, velocidad máx. 260); "Normal" (por defecto) baja
  a ~585/195; "Fácil" a ~360/130.

### Added
- **v0.2 completa**: línea de meta, conteo de vueltas y cronómetro.
  - `src/race/LapTracker.ts`: máquina de estados pura que exige pasar por
    los `waypoints` del circuito **en orden** para contar una vuelta —
    tocar la línea de meta sin haber pasado por los checkpoints no cuenta,
    evitando la trampa obvia de cortar el circuito. Cubierta con tests que
    reprodujeron y confirmaron un bug real (contaba la vuelta al tocar el
    último checkpoint en vez de al cruzar la meta).
  - `src/race/formatTime.ts`: formato mm:ss.mmm.
  - `src/race/RaceHud.ts`: HUD fijo a la cámara con vuelta actual,
    cronómetro en marcha y mejor vuelta; aviso de "¡Meta!" al completar las
    vueltas del circuito (`track.laps`).

### Fixed
- No se veía bien la meta y las vueltas no contaban: los marcadores eran
  círculos de 4px muy discretos, y el radio para activar un checkpoint
  (24px) era demasiado ajustado para lo ancho que es el circuito
  (60-80px), así que si no se pasaba justo por el centro del carril nunca
  se activaba.
  - Marcadores de meta/checkpoints más grandes y con relleno (`TrackRenderer`).
  - `src/race/NextTargetIndicator.ts`: anillo verde pulsante que señala
    siempre el próximo checkpoint al que hay que llegar — soluciona a la
    vez "no veo la meta" y "no sé por dónde ir", porque siempre hay un
    punto parpadeando indicando el objetivo actual.
  - Radio de activación de checkpoint subido de 24px a 40px (más permisivo,
    arcade y no simulación).
  - `LapTracker.nextTargetIndex` (getter público nuevo) para poder señalar
    el objetivo actual desde la escena.

### Added
- Meta clásica a cuadros blancos y negros, **definida en el JSON del
  circuito** (no en el renderer): el esquema de waypoint (`src/config/schema/track.ts`)
  gana dos campos opcionales, `angle` (dirección de carrera al cruzar la
  línea, misma convención que `spawn.angle`) y `width` (ancho en px). Con
  ambos definidos, `TrackRenderer` dibuja una franja a cuadros perpendicular
  a esa dirección en vez del círculo por defecto; sin ellos, sigue
  funcionando igual que antes (compatible con circuitos ya existentes).
  `rally-01.json` ya define su meta con `angle: 180, width: 64`.
