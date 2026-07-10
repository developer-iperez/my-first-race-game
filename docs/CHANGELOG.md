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
  `rally-01.json` ya define su meta con `angle: 0, width: 64`.

### Fixed
- La meta quedaba "suelta": estaba colocada junto al spawn, en una zona
  abierta del circuito sin carril acotado por ambos lados, así que la
  franja a cuadros no tocaba ninguna pared y flotaba en medio del asfalto.
  Reubicada en la recta superior (entre el muro exterior y la isla, un
  tramo de 64px de ancho real), donde la línea ahora toca la pared arriba
  y la isla abajo — ocupa el carril completo. `spawn` se movió con ella
  (antes en la esquina inferior izquierda, ahora en la propia línea de
  meta) y los 4 checkpoints de las esquinas se reordenaron para formar un
  circuito coherente que termina siempre cruzando la meta en último lugar.

### Added
- Fase de fin de carrera: al completar las vueltas del circuito, el coche
  se congela (deja de procesar física e entrada, incluso si llevaba
  velocidad) y en el HUD aparece un botón "Volver a empezar" junto al
  aviso de meta. Al pulsarlo, `RaceScene.restart()` reinicia la escena por
  completo (`scene.restart()`): coche, cronómetro, vueltas y objetivo
  vuelven a su estado inicial.
  - Verificado end-to-end forzando el fin de carrera vía la propia API del
    `LapTracker` (conducir un circuito entero por script no es fiable) y
    comprobando la posición del coche en frames sucesivos: se detectó y
    corrigió un bug real — `scene.restart()` reutiliza la misma instancia
    de `RaceScene`, así que `raceElapsedMs` (un contador de clase, no
    reconstruido en cada `create()`) se quedaba con el valor de la carrera
    anterior en vez de arrancar en 0.

### Fixed
- Un checkpoint contaba aunque el coche lo cruzara marcha atrás o
  recorriendo el circuito en sentido contrario: la detección solo miraba
  la distancia al waypoint, sin comprobar la dirección de cruce.
  `LapTracker` calcula ahora el sentido esperado de cada tramo (el vector
  desde el waypoint anterior hasta el actual, sin necesidad de definirlo a
  mano en el JSON) y rechaza el cruce si la velocidad del coche va
  claramente en dirección opuesta; a velocidad casi nula (coche coasteando)
  no se exige dirección, para no ser excesivamente estricto. `update()`
  recibe ahora también `vx, vy` del coche. 4 tests nuevos cubren marcha
  atrás rechazada, aceptación al corregir el sentido, tolerancia a baja
  velocidad y que dar toda la vuelta al revés no cuenta como vuelta válida.

### Added
- **v0.3 completa: pixel art real**, generado por script (`Pillow`) en vez
  de los rectángulos de color plano de v0.1-v0.2:
  - `public/cars/rally-hatch.png`: coche 24×12 (mismo tamaño que
    `physics.length/width`), morro apuntando a +x, con cabina, morro y
    piloto trasero como acentos de color.
  - `public/tiles/{asphalt,grass,sand,wall}.png`: tiles de 16×16 con
    textura de grano/motas; el muro es una franja roja-blanca clásica de
    circuito de carreras.
  - `Car`: ahora usa `scene.add.image('car-sprite')` con `setDisplaySize`
    (se redimensiona solo si cambia `physics.length/width`) y
    `setTint`/`clearTint` para el efecto de derrape, en vez de
    Graphics + swap de color de relleno.
  - `TrackRenderer`: cada celda del tilemap se pinta con la imagen de su
    superficie (o la de muro si `walls[fila][col] === 1`); los marcadores
    de meta/checkpoints se dibujan por encima con Graphics, sin cambios.
- **HUD retro**: `RaceHud` gana un marco pixelado estilo marcador arcade
  (panel oscuro + borde de 2px, ajustado en cada `update()` al tamaño real
  del texto) en vez del `backgroundColor` plano de Phaser Text. Cada línea
  lleva un icono (🏁 vuelta, ⏱ cronómetro, 🏆 mejor vuelta) para
  diferenciarlas de un vistazo. El panel de "¡META!" usa borde rojo y el
  botón de reinicio pasa a `► VOLVER A EMPEZAR ◄`, más en línea con un
  marcador de máquina recreativa.
- **Audio**, sintetizado con un script Python (`wave`/`struct`, sin
  dependencias ni bancos de sonido externos) — `public/audio/{engine,skid,
  checkpoint,finish}.wav`:
  - Motor en bucle desde que empieza la carrera; volumen y tono
    (`setRate`) escalan con `speed / car.maxSpeed` cada frame, así que
    suena distinto acelerando a fondo que al ralentí.
  - Derrape en bucle mientras `car.isSkidding` es `true` (nuevo getter en
    `Car`, reutiliza la misma función pura que ya se usaba para el tinte
    visual), se para en cuanto deja de derrapar.
  - Blip de checkpoint cada vez que `LapTracker.nextTargetIndex` cambia
    (cualquier checkpoint, incluida la propia meta) y fanfarria de meta
    (que además corta los bucles de motor/derrape) al completar la
    carrera.
  - `src/race/RaceAudio.ts` centraliza la gestión; se destruye en el
    `SHUTDOWN` de la escena para que un reinicio (`scene.restart()`) no
    deje el motor de la carrera anterior sonando en bucle superpuesto con
    el nuevo.
  - Verificado en Chromium: sin errores de consola conduciendo, y
    comprobado por API directa que el motor responde a la velocidad y que
    el derrape se enciende/apaga exactamente una vez por transición (no
    se reinicia en cada frame mientras dura).

### Added
- **Derrape más espectacular en curvas** (`src/physics/carPhysics.ts`),
  manteniendo la maniobrabilidad:
  - Girar fuerte a velocidad alta resta agarre lateral por sí solo
    (`corneringGripLoss`, proporcional a `|steer| * velocidad/maxSpeed`),
    sin necesitar el freno de mano para lucirse; girar suave o a baja
    velocidad apenas se nota, así que aparcar/maniobrar con precisión
    sigue intacto.
  - El giro del coche ahora depende de la velocidad **total** (no solo de
    la componente hacia delante), así que aunque esté derrapando de lado
    conserva autoridad de dirección y se puede contravolantear para
    corregir el derrape en vez de perder el control.
  - `src/race/SkidParticles.ts`: partículas de humo/polvo (`public/tiles/particle-dust.png`,
    generado por script) tras el coche mientras derrapa, reutilizando el
    mismo `car.isSkidding` que ya disparaba el sonido y el tinte.

### Fixed
- El derrape "espectacular" no se notaba nada jugando de verdad (ni el
  coche se veía derrapar mucho, ni saltaban las partículas), pese a que
  los tests unitarios lo confirmaban. Causa: esos tests daban un único
  paso de físicas con `dt` grande (0.2s) para exagerar la diferencia y
  que fuera fácil de comprobar, pero la partida real avanza en pasos
  pequeños (~1/60s) muchas veces por segundo — con el decaimiento
  exponencial de agarre por frame, la velocidad lateral se cancelaba casi
  tan rápido como se generaba, y en régimen estacionario a 60fps la
  proporción lateral se quedaba muy por debajo del umbral de `isSkidding`
  (~0.05 de ratio conseguido, frente al 0.35 necesario). Se detectó
  simulando la físicas en bucle con `dt` pequeño (como hace `RaceScene`
  de verdad) en vez de con un salto grande, y se corrigió subiendo
  `CORNERING_GRIP_LOSS` a un valor que sí cruza el umbral en ese régimen
  (0.4 → 0.85), revalidado con el mismo tipo de simulación. Se añadieron
  3 tests nuevos que reproducen el bucle a `dt` real de 60fps (en vez de
  un solo salto grande) para que esta clase de regresión no vuelva a
  colarse silenciosamente.

### Changed
- Feedback tras probar el derrape en el móvil: seguía sintiéndose "soso".
  El ratio lateral en régimen estacionario ya estaba tocando el suelo de
  agarre (`MIN_LATERAL_GRIP`, 0.08) en curva cerrada a velocidad, así que
  subir más `CORNERING_GRIP_LOSS` no tenía ya ningún efecto — bajado el
  suelo a 0.05, lo que sube el ángulo de derrape en curva cerrada de
  ~28° a ~41° (validado por simulación); el giro suave y las maniobras a
  baja velocidad no lo tocan (el suelo solo se alcanza con mucho volante
  y mucha velocidad a la vez), así que la maniobrabilidad se mantiene.

### Fixed
- Feedback: "el coche va a veces a tirones" y "el área de fuera de la
  carretera no debería parar en seco". Ambos venían de lo mismo: al
  tocar un muro, `RaceScene` revertía la posición al frame anterior *y*
  invertía la velocidad (rebote), un frenazo brusco que además, al
  rozar un muro varias veces seguidas (más fácil ahora que el coche
  desliza más), producía un parpadeo de ida-y-vuelta en la posición
  (los tirones). Sustituido por fricción fuerte sin frenazo ni rebote:
  al pisar zona de muro/fuera de mapa, la posición sigue avanzando con
  normalidad y solo se aplica un decaimiento agresivo a la velocidad
  (`OFFTRACK_GRIP_RETENTION` en `RaceScene.ts`, misma matemática de
  "retención por frame" que ya usaba el modelo de físicas, ahora
  exportada como `frameRateIndependentDecay`), así que cuesta mucho
  mantener velocidad fuera de pista pero el coche no se queda clavado
  ni rebota — es fácil corregir el rumbo y volver al trazado. Verificado
  en directo forzando el coche sobre un tile de muro y comprobando que
  la posición avanza frame a frame sin saltos mientras la velocidad cae
  de golpe (de 195 a ~16 en unos 320ms).
