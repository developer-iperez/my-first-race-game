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

### Changed
- Segunda ronda de feedback: "el derrape ya está un poco mejor, pero
  debería tener más ángulo, como si hiciera drift" y "el coche nunca
  puede salir de los límites de la pantalla".
  - **Derrape**: el suelo de agarre lateral anterior (0.05) en realidad
    ya no era el límite real — con `CORNERING_GRIP_LOSS` en 0.85, el
    valor de agarre efectivo en curva cerrada a velocidad se quedaba
    fijo en 0.05 (`gripLateral` 0.9 menos 0.85) *antes* de que el suelo
    llegara a aplicarse, así que bajarlo más no cambiaba nada. Subido
    `CORNERING_GRIP_LOSS` a 0.95 y bajado `MIN_LATERAL_GRIP` a 0.02 (para
    que el suelo sí sea ahora el límite real y no al revés) — el ángulo
    de derrape en curva cerrada a velocidad sube de ~41° a ~61°
    (validado por simulación a `dt` real de 60fps). El giro suave
    (`steer` < ~0.9) y las maniobras a baja velocidad casi no lo notan,
    así que sigue sin afectar a la maniobrabilidad de precisión.
  - **Límite de pantalla**: el anillo exterior del circuito
    (`public/tracks/rally-01.json`) estaba marcado como muro sólido
    (además de ser, literalmente, el borde de todo el mapa — el circuito
    ocupa el lienzo entero, 384×224px, sin margen), así que el coche
    topaba con la fricción fuerte de "fuera de pista" justo al llegar al
    borde de la zona asfaltada, sin apenas espacio para deslizar. Abierto
    ese anillo exterior (ya no cuenta como muro, se queda como hierba
    normal, agarre 0.6) para que sea un arcén real donde el coche puede
    seguir circulando casi a velocidad normal antes de llegar al borde
    literal de la pantalla; la isla central sigue siendo muro (es un
    obstáculo del trazado, no el borde del mapa). Al abrir ese margen,
    apareció un problema nuevo: al derrapar con fuerza hacia el borde el
    coche podía salirse del área visible de la cámara (fija, sin scroll,
    F3) y "perderse" de pantalla. Añadido un recorte de posición a los
    límites del circuito en `RaceScene.update()` (no es un muro: no
    frena ni rebota, solo evita que la posición se salga del encuadre),
    así que el coche puede llegar a pegarse al borde a toda velocidad y
    deslizar a lo largo de él sin desaparecer nunca de la pantalla.
    Verificado en directo: lanzando el coche a tope hacia el borde,
    cruza el arcén de hierba sin apenas perder velocidad, y solo al
    tocar el límite literal empieza a frenar con fuerza mientras se
    queda visible, pegado al borde.

### Changed
- Reescrito el modelo de derrape sobre una especificación funcional que
  el usuario aportó ("Arcade-Drift Dynamics": física asistida, no
  simulación de neumáticos), adaptando las partes que tienen sentido en
  un modelo 2D de punto-masa sin ruedas ni suspensión:
  - **Derrape sostenido con el acelerador (Slip Ratio)**: `CarState`
    gana un campo opcional `driftIntensity`, una "memoria" de derrape
    suavizada frame a frame (sube rápido al pedir un derrape, baja
    despacio al soltar) en vez de recalcularse de golpe cada frame con
    el input instantáneo. Una vez dentro de un derrape
    (`driftIntensity` por encima de `DRIFT_THRESHOLD`), mantener el
    acelerador pisado resta agarre lateral extra y sostiene el
    derrape — soltar el gas lo apaga en unos pocos frames. Girar fuerte
    sin acelerador ya no basta por sí solo para mantener un derrape
    largo (antes sí): ahora hace falta gestionar el gas, como pide la
    especificación ("Mantenimiento: acelerador constante").
  - **Techo de ángulo de deriva (estabilización)**: al implementar el
    sostenido con el acelerador apareció un trompo real — mantener el
    volante a fondo más de un segundo hacía que el morro girase sin
    parar (0°→270°+) en vez de mantener un ángulo estable, justo lo que
    la especificación pide evitar. Añadido un límite: seguir girando
    hacia el mismo lado del derrape pierde autoridad de giro a medida
    que el ángulo entre el morro y la velocidad real se acerca a un
    máximo (`MAX_SLIP_ANGLE`), así el sistema converge solo a un ángulo
    de derrape estable (validado por simulación: mantiene ~65-70° de
    deslizamiento en línea recta, sostenido, sin variar, en vez de dar
    vueltas). Contravolantear (girar hacia el lado contrario) nunca
    pierde autoridad — la salida/corrección del derrape sigue siendo
    siempre instantánea y completa.
  - **Impulso de giro extra con el acelerador (torque vectoring
    adaptado)**: dentro de un derrape, mantener el acelerador pisado da
    un empujón de giro extra en la misma dirección en la que ya se está
    girando (sujeto al mismo techo), para poder "abrir" el ángulo de
    derrape con el gas.
  - **No implementado**: la parte de la especificación sobre
    suspensión/transferencia de peso (compresión de muelles, carga
    vertical por rueda) no tiene equivalente en este modelo 2D de vista
    cenital sin ruedas ni eje Z — se ha omitido en vez de simular algo
    ficticio sin sentido físico en este juego.
  - Cambio de comportamiento a tener en cuenta: antes, girar a fondo
    solo (sin acelerador) ya daba un derrape dramático; ahora ese mismo
    volante sin gas apenas desliza y pierde bastante velocidad —
    sostener un derrape largo es ahora una habilidad deliberada
    (gestionar el acelerador), no un efecto automático de girar fuerte.
  - 6 tests nuevos (`tests/carPhysics.test.ts`) simulando el bucle a
    `dt` real de 60fps: derrape sostenido estable sin trompo, el ratio
    de deslizamiento no crece sin límite mientras se sostiene, soltar el
    acelerador apaga el derrape en pocos frames, girar sin acelerador
    desliza menos que con acelerador, el contravolante nunca pierde
    autoridad, y el freno de mano solo (sin acelerador) sigue bastando
    para iniciar un derrape.

### Changed
- Feedback tras probar el sistema anterior: "el derrape se nota raro,
  muy artificial" y "no hay posibilidad de contravolante". Tenía razón
  el segundo aviso a medias — el contravolante SÍ funcionaba a nivel de
  números (verificado por simulación) — pero el motivo de fondo era más
  profundo: el modelo entero (memoria de derrape con dos velocidades de
  entrada/salida, techo de ángulo con lógica de "¿este volante ensancha
  o corrige el derrape?", impulso de giro extra por acelerador, todo
  apilado) recalculaba el ángulo del coche de cero cada frame a partir
  del input del momento — no había ninguna cantidad que representara
  "el coche ya está girando" que hubiera que frenar y revertir. Sin esa
  inercia, contravolantear técnicamente cambiaba el ángulo, pero no se
  sentía como "coger" un coche que ya está patinando, sino como un
  interruptor — de ahí lo de "artificial".
  - **Reescrito el giro sobre inercia angular real**: `CarState` cambia
    `driftIntensity` por `yawRate` (velocidad angular actual, rad/s). El
    volante ya no fija el ángulo del coche: marca una velocidad angular
    *objetivo* (misma fórmula de siempre, proporcional a velocidad total
    y sentido de la marcha), y la velocidad angular real se acerca a ese
    objetivo con un retraso — pequeño con buen agarre (conducción normal
    casi instantánea), mayor cuanto más esté patinando ya el coche
    (`YAW_INERTIA_FROM_SLIP`). Es la MISMA fórmula para iniciar un
    derrape que para contravolantear y salir de él: no hay ningún caso
    especial ni comparación de signos — solo inercia continua. El
    contravolante ahora se ve en los números como lo que es: la
    velocidad angular pasa de +3.2 a -3.2 rad/s a lo largo de varios
    frames en vez de saltar de golpe, y el coche responde en
    consecuencia (verificado en directo con capturas de pantalla y en
    simulación).
  - **Eliminado** todo el sistema anterior (memoria de derrape con
    entrada/salida asimétrica, techo de ángulo de deriva basado en
    "ensancha vs corrige", derrape sostenido específicamente por
    acelerador, impulso de giro extra tipo torque vectoring): era la
    combinación de estas piezas, cada una "funcionando" por separado, lo
    que hacía que el conjunto se sintiera impredecible. El modelo nuevo
    es más simple (un único parámetro de inercia) y, sin ningún techo
    artificial, converge solo a un derrape sostenido estable en
    simulación (mismo test que antes, ahora validando la propiedad
    emergente en vez de un límite impuesto a mano).
  - Recalibrados `CORNERING_GRIP_LOSS` (0.9) y `MIN_LATERAL_GRIP` (0.03)
    para el nuevo modelo: en curva cerrada sostenida a velocidad,
    converge en simulación a un ángulo de derrape estable de ~61°.
  - Tests reescritos para reflejar el nuevo modelo (misma cobertura de
    intención: derrape sostenido y estable sin trompo, maniobrabilidad a
    baja velocidad/giro suave intacta, freno de mano solo sigue
    bastando para iniciar un derrape) más tests nuevos específicos de
    inercia angular: el contravolante revierte el sentido de giro de
    forma gradual (no en un frame) pero sí lo revierte sosteniéndolo
    unos frames, y el agarre normal responde al volante casi al
    instante (para no perder la sensación arcade "directa" fuera de un
    derrape).

### Changed
- Recalibrada la dificultad para que el juego sea manejable en los tres
  niveles (feedback: en normal el derrape se notaba pero iba demasiado
  rápido, en difícil era ingobernable, en fácil no se notaba el derrape).
  La clave: en este circuito, tan pequeño que se ve entero de una vez, el
  radio de giro mínimo del coche es proporcional a su velocidad máxima
  (radio ≈ maxSpeed / turnRate), así que a tope el coche no cabe en las
  curvas. Bajados los topes de velocidad de cada nivel para apretar el
  radio de giro: "Difícil" pasa de radio ~81px (mayor que el ancho del
  carril, ingobernable) a ~59px (tomable con pericia); "Normal" a ~49px
  (el derrape se sigue notando en curva pero se controla); "Fácil" a
  ~34px (lento y suave para aprender). Verificado en directo midiendo la
  velocidad punta y el radio de giro real en cada nivel.
- La marcha atrás acelera más despacio que hacia delante
  (`REVERSE_POWER_FACTOR` en `carPhysics.ts`). Antes, pisar "atrás" usaba
  siempre `brakingPower` (1200, incluso mayor que el motor), así que el
  coche aceleraba en reversa más rápido que hacia delante. Ahora se
  distingue: pisar atrás YENDO hacia delante sigue siendo frenar (fuerte);
  parado o ya retrocediendo es marcha atrás, con una fracción de la
  potencia del motor. Verificado: hacia delante alcanza el tope en ~0.5s,
  en reversa va notablemente más lenta.

### Fixed
- El freno de mano (barra espaciadora) dejaba de funcionar con teclado
  tras abrir los ajustes: al pulsar el botón ⚙️, este se quedaba con el
  foco del teclado, así que la siguiente pulsación de espacio volvía a
  "clicarlo" y reabría los ajustes (que pausan el juego) en vez de
  frenar. Ahora el botón de ajustes no retiene el foco al pulsarlo
  (`preventDefault` en su `mousedown`), así que el foco se queda en el
  body y la barra espaciadora siempre llega al juego. Verificado en
  directo reproduciendo la secuencia abrir/cerrar ajustes y comprobando
  que el espacio activa el freno de mano sin reabrir el menú.

### Added
- **Pantalla de inicio + cuenta atrás de salida 3·2·1·¡YA!** (primer paso
  hacia v1.0).
  - `src/scenes/TitleScene.ts`: nueva escena entre `Boot` y `Race`. Muestra
    el título ("RALLY 90s"), el coche sobre una parrilla a cuadros y "pulsa
    para empezar" (arranca con cualquier tecla, toque o clic). Incluye el
    botón de ajustes (⚙️) para **elegir la dificultad antes de correr**, con
    la dificultad actual mostrada en pantalla y actualizada en vivo. El
    primer gesto que inicia la carrera sirve además para **desbloquear el
    audio** del navegador (que lo bloquea hasta la primera interacción), así
    que el motor ya suena desde el arranque en vez de quedar mudo hasta el
    primer toque.
  - `src/race/RaceCountdown.ts`: al empezar la carrera, el coche queda
    congelado en la parrilla mientras se muestra "3 · 2 · 1" (con un pitido
    por número, reutilizando el blip de checkpoint) y arranca en el "¡YA!"
    (pitido más grave). Durante la cuenta atrás no se procesa entrada ni
    física y el cronómetro no corre (empieza en el "¡YA!"), pero el
    indicador del próximo objetivo ya se ve para saber hacia dónde salir. Se
    recrea en cada `create()`, así que "Volver a empezar" también repite la
    cuenta atrás. Lógica de tiempos pura (solo depende del dt acumulado),
    independiente del framerate.
  - Flujo de escenas: `Boot` → `Title` → `Race` (antes `Boot` → `Race`
    directo).
  - Verificado en directo: la pantalla de inicio se muestra al cargar,
    empezar lleva a la carrera con la cuenta atrás, el coche está congelado
    mientras se muestran 3/2/1 (aunque se mantenga el acelerador) y se
    suelta en el "¡YA!"; abrir los ajustes en el título no dispara el
    arranque por error, y la dificultad elegida allí se aplica en la carrera.

### Added
- **Mejor vuelta guardada entre sesiones** (siguiente paso hacia v1.0).
  - `src/race/BestLaps.ts`: módulo de persistencia en `localStorage`
    (mismo patrón que `Settings.ts`), una marca por combinación
    circuito+coche — es progreso del jugador, no parte de la definición
    del vehículo/trazado (§3.7 de `ANALISIS.md`). `reportLap()` solo
    sobrescribe el guardado si el tiempo nuevo lo mejora (o no había
    ninguno), así que es seguro llamarlo cada vez que se completa una
    vuelta sin comprobarlo antes.
  - `LapTracker` gana un cuarto parámetro opcional, `initialBestLapMs`,
    para sembrar `bestLapMs` desde el arranque en vez de empezar siempre
    en `null` — sigue siendo una clase pura (sin `localStorage` dentro),
    es `RaceScene` quien lee/escribe `BestLaps` y se lo pasa. Así el
    marcador "🏆 mejor vuelta" (ya existente en el HUD desde v0.2) muestra
    el récord de siempre desde el primer frame de la carrera, y sigue
    funcionando igual en los tests existentes de `LapTracker` (parámetro
    opcional, comportamiento anterior intacto sin él).
  - Verificado en directo de punta a punta: completar una vuelta guarda
    el tiempo en `localStorage`; recargando la página entera (sesión
    nueva) el récord aparece ya sembrado en el HUD antes de completar
    ninguna vuelta; y una vuelta más lenta que el récord guardado no lo
    sobrescribe.

### Added
- Opción de **sonido** en el menú de ajustes (⚙️): activar/desactivar
  todo el audio del juego con un botón, junto a dificultad y pantalla
  completa. `soundEnabled` en `Settings` (persiste en `localStorage`,
  igual que el resto de ajustes). Se aplica silenciando el gestor de
  sonido de Phaser (`scene.sound.mute`), que es una única instancia
  compartida por todo el juego — TitleScene y RaceScene lo sincronizan
  cada una al crearse y al cambiar el ajuste, así que funciona esté el
  jugador donde esté cuando lo toque.
  - Verificado en directo: activar/desactivar desde ajustes cambia
    `sound.mute` al momento y persiste en `localStorage`; comprobado
    también que una recarga completa de página respeta el ajuste
    guardado en cuanto el navegador desbloquea el audio (política de
    autoplay: el `AudioContext` empieza `suspended` hasta la primera
    interacción real del jugador, igual que ya pasaba con el motor antes
    de este cambio — no hay audio posible antes de esa interacción de
    todos modos, así que no afecta a la experiencia real).

### Changed
- Sustituidos los niveles de "Dificultad" (Fácil/Normal/Difícil) por tres
  sliders continuos en el menú de ajustes: **velocidad máxima**,
  **aceleración** y **agarre** (curva/derrape) — cada uno una fracción
  del propio valor del coche activo (`src/settings/carTuning.ts`, mismo
  principio de "coche definido por datos" que ya seguía la dificultad).
  - Límites pensados para que el coche siga cabiendo en las curvas de
    este circuito en todo el rango del slider (el radio de giro mínimo
    es proporcional a la velocidad máxima, ver el rebalanceo de
    dificultad más arriba): velocidad máxima 30%–85%, aceleración
    30%–100%. El agarre es un ajuste nuevo (antes no existía ningún
    control sobre él): 55%–110% del agarre lateral del coche, con 100%
    por defecto (agarre igual al de siempre, sin cambios). Los valores
    por defecto de velocidad/aceleración (60%/60%) reproducen la
    sensación de la antigua dificultad "Normal".
  - `Settings`/`GameSettings` cambia `difficulty: Difficulty` por los
    tres factores directamente (`speedFactor`, `accelFactor`,
    `gripFactor`), persistidos igual que el resto de ajustes.
  - `SettingsMenu` se reescribe para construir el panel **una sola vez**
    en vez de destruirlo y reconstruirlo en cada cambio de ajuste (como
    hacía antes): con sliders nativos (`<input type="range">`), volver a
    montar el DOM a mitad de un arrastre corta el gesto del navegador.
    Ahora los cambios se reflejan actualizando el valor/texto de los
    controles ya existentes, sin recrear ningún nodo — verificado en
    directo simulando una secuencia de eventos `input` (como un
    arrastre real) y comprobando que el nodo del slider es el mismo
    antes y después.
  - Verificado en directo de punta a punta: valores y límites de cada
    slider al abrir ajustes; arrastrar un slider actualiza la física del
    coche en plena carrera (`car.maxSpeed` cambia al momento); el ajuste
    de sonido (ronda anterior) sigue funcionando igual tras la
    reescritura del menú.
  - `tests/difficulty.test.ts` eliminado (probaba `applyDifficultyToPhysics`,
    que ya no existe); sustituido por `tests/carTuning.test.ts`, con
    cobertura equivalente más una comprobación de que el extremo superior
    de velocidad máxima mantiene un radio de giro tomable en este circuito.
