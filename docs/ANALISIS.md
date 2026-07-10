# Análisis técnico y de gestión — Juego de rallies 2D

> Documento de análisis inicial. Objetivo: decidir **tecnología**, **modelo de
> gestión del proyecto desde el propio repositorio** y **dónde ejecutar/publicar**
> un juego de rallies 2D sencillo, arcade y con estética de los 90.
>
> Fecha: 2026-07-10 · Estado: propuesta para revisión

---

## 1. Resumen ejecutivo (conclusiones primero)

Para un proyecto "de juguete" donde priman **jugabilidad y diversión**, con
**físicas simples**, **mapa del circuito visible por completo** y **estética
noventera**, la recomendación es:

| Decisión | Recomendación | Alternativa razonable |
|---|---|---|
| Plataforma | **Web (HTML5 Canvas)** | Escritorio con Godot |
| Motor / framework | **Phaser 3 + TypeScript** | Kaplay (más simple) / Vanilla Canvas (más didáctico) |
| Build tooling | **Vite** | Parcel |
| Físicas | **Modelo arcade propio** (aceleración, fricción, agarre lateral para derrapar) | Motor Arcade de Phaser para colisiones |
| Circuitos y coches | **Definidos por datos (JSON)**, no hardcodeados; editor visual a futuro | Editor externo (p. ej. Tiled) que exporte JSON |
| Gestión del proyecto | **GitHub Issues + Labels + Projects (tablero) + Milestones** y documentos vivos en `docs/` (`ROADMAP.md`, `CHANGELOG.md`) | Solo ficheros markdown si no se quiere depender de GitHub |
| Ejecución en desarrollo | **`vite dev` en local** | — |
| Publicación / hosting | **GitHub Pages** (vía GitHub Actions) | **itch.io** para distribución con comunidad gamer |

**Por qué la web:** cero instalación para quien juega, se comparte con un enlace,
se despliega gratis desde el mismo repositorio y el ecosistema 2D es maduro. Es
la vía con menor fricción entre "escribo código" y "un amigo lo prueba en el móvil".

**Por qué Phaser 3 + TypeScript:** cubre lo que necesitas de fábrica (bucle de
juego, sprites, tilemaps para el circuito, entrada de teclado/táctil, escenas,
audio) sin imponer un motor de físicas realista que no quieres. TypeScript da
seguridad de tipos, que en un juego con mucho estado mutable (posición, ángulo,
velocidad) evita bugs tontos y hace el refactor barato.

---

## 2. Requisitos extraídos del enunciado

Traduzco tu descripción a requisitos concretos para poder decidir con criterio.

**Funcionales (v1):**
- F1. Dado un circuito, el coche puede **acelerar**, **frenar** y **girar**.
- F2. El coche puede **derrapar** en curvas (comportamiento visible y divertido, no realista).
- F3. El **mapa del circuito se ve completo** en pantalla (cámara fija, sin scroll).
- F4. Físicas **simples**.
- F5. Un circuito jugable de principio a fin.

**Arquitectónicos (deben cumplirse desde la v1 aunque su UI llegue después):**
- A1. Los **circuitos** se definen por **datos** (JSON), no en código. La v1 puede
  traer un único circuito, pero cargado desde su fichero de datos, de modo que
  añadir otro sea crear un JSON nuevo (a mano o, en el futuro, con un editor).
- A2. Los **coches/vehículos** siguen el mismo principio: su configuración
  (peso, potencia, agarre, longitud, apariencia…) se define por **datos**, para
  poder añadir vehículos nuevos sin tocar la lógica del juego.

**No funcionales:**
- NF1. **Estética 90s** (pixel art, paleta limitada, vista cenital tipo *Micro Machines* / *Super Cars* / *Ivan "Ironman" Stewart's Super Off Road*).
- NF2. Prioridad absoluta: **jugabilidad y diversión** por encima de fidelidad.
- NF3. Proyecto "de juguete": bajo coste, fácil de ejecutar y compartir.
- NF4. El repositorio debe reflejar **estado, tareas pendientes y bugs**.

**Fuera de alcance de la v1 (anotado para no perderlo):** IA de rivales, multijugador,
daños al coche, scroll de cámara, guardado de tiempos online, **editor visual** de
circuitos/coches y **selector** de múltiples circuitos/vehículos. Ojo: la v1 solo
trae *un* circuito y *un* coche, pero ya **cargados desde datos (JSON)** — ver A1/A2.

---

## 3. ¿Qué tecnología usar?

### 3.1 Elección de plataforma: Web vs Escritorio vs Nativo

| Criterio | Web (Canvas) | Escritorio (Godot/Löve) | Nativo (Unity/otros) |
|---|---|---|---|
| Fricción para el jugador | **Nula** (un enlace) | Media (descargar binario) | Media/alta |
| Coste de publicación | **Gratis** (Pages) | Gratis (itch.io) | Gratis/variable |
| Curva para 2D simple | Baja | Baja | Media |
| Estética retro | Excelente | Excelente | Buena |
| Compartir en móvil | **Inmediato** | Requiere export | Requiere export |
| Peso del runtime | Ligero | Ligero | Pesado |

**Conclusión:** Web. Para un juego de juguete, la capacidad de mandar un enlace y
que se juegue al instante (PC y móvil) es el factor decisivo.

### 3.2 Elección de motor/framework dentro de la Web

- **Phaser 3** — Framework 2D completo y maduro. Trae escenas, sprites, tilemaps,
  input, audio y físicas arcade. **Recomendado**: es el equilibrio ideal entre
  "no reinventar la rueda" y "no cargar con un motor pesado".
- **Kaplay (antes Kaboom.js)** — Muy sencillo y divertido, API mínima. Buena
  alternativa si se prioriza rapidez de prototipado sobre control.
- **PixiJS** — Solo renderizado (muy rápido). Habría que añadir a mano el bucle de
  juego, input y físicas. Más trabajo del necesario aquí.
- **Vanilla Canvas 2D (sin framework)** — Máximo control y aprendizaje, cero
  dependencias. Viable porque el alcance es pequeño, pero implica escribir el bucle,
  la carga de assets y la gestión de escenas uno mismo.
- **Godot (export a HTML5)** — Excelente motor, editor visual, exporta a web y a
  escritorio. Alternativa fuerte si en el futuro se quiere crecer; a cambio, se sale
  del flujo "todo código en el repo".

**Conclusión:** **Phaser 3 + TypeScript + Vite**. Si el objetivo fuese
*aprender las tripas* de un juego desde cero, Vanilla Canvas sería la opción
didáctica; para *tener algo divertido pronto y mantenible*, Phaser gana.

### 3.3 Stack propuesto (concreto)

```
Lenguaje:      TypeScript
Motor:         Phaser 3
Bundler/dev:   Vite
Calidad:       ESLint + Prettier
Tests:         Vitest (para la lógica de físicas/utilidades, no para el render)
CI/CD:         GitHub Actions -> deploy a GitHub Pages
Assets:        Pixel art (Aseprite o similar) + audio chiptune/sfx libres
```

Estructura de carpetas sugerida:

```
/
├─ docs/                 # Análisis, roadmap, changelog, decisiones
├─ public/               # Assets estáticos (sprites, tiles, audio)
├─ src/
│  ├─ main.ts            # Arranque de Phaser
│  ├─ scenes/            # Boot, Menu, Race, GameOver
│  ├─ entities/          # Car, Track...
│  ├─ physics/           # Modelo de coche (aceleración, derrape)
│  └─ config/            # Constantes de tuning (grip, aceleración...)
├─ tests/
├─ .github/
│  ├─ ISSUE_TEMPLATE/
│  └─ workflows/         # CI + deploy
├─ index.html
├─ package.json
└─ vite.config.ts
```

### 3.4 Modelo de físicas simple con derrape (el corazón de la diversión)

El derrape divertido **no** necesita un motor de físicas realista (Pacejka,
neumáticos, etc.). Un modelo arcade de "agarre lateral" es suficiente y más
controlable. Idea:

- El coche tiene una **posición**, un **ángulo** (hacia dónde mira) y una
  **velocidad** (vector).
- **Acelerar/frenar** aplica fuerza a lo largo del morro del coche.
- **Girar** cambia el ángulo del coche (proporcional a la velocidad: parado no gira).
- El truco del derrape: descomponer la velocidad en dos componentes —**hacia
  delante** (rueda que agarra bien) y **lateral** (deslizamiento). Se aplica más
  rozamiento a la componente hacia delante y **menos** a la lateral.
  - Mucho agarre lateral → el coche "va sobre raíles" (no derrapa).
  - Poco agarre lateral → el coche desliza en las curvas → **derrape**.
- Se puede reducir el agarre lateral al frenar o con una tecla de "freno de mano"
  para provocar el derrape a voluntad. Ahí está la chispa arcade.

```
// Pseudocódigo del paso de simulación (por frame)
adelante   = vector_desde_angulo(coche.angulo)
vel_ad     = proyeccion(coche.vel, adelante)        // componente longitudinal
vel_lat    = coche.vel - vel_ad                     // componente lateral (derrape)

vel_ad    *= FRICCION_ADELANTE                      // ~0.98 (drag, no es agarre)
// AGARRE_LATERAL: mayor = más agarre = menos derrape. Se aplica como
// retención = (1 - agarre): a más agarre, más se frena en cada frame la
// componente lateral (menos deslizamiento).
vel_lat   *= (1 - AGARRE_LATERAL)                    // 0.9 = agarra, 0.5 = derrapa
if (freno_de_mano) AGARRE_LATERAL_efectivo bajo     // desliza más

coche.vel = vel_ad + vel_lat + acel*adelante
coche.pos += coche.vel * dt
```

Todas esas constantes (`FRICCION_ADELANTE`, `AGARRE_LATERAL`, aceleración, giro
máximo) van en `src/config/` para poder **tunear la sensación jugando**, que es
donde se gana la diversión. Este bloque es el candidato ideal para tests con Vitest.

### 3.5 El circuito y "verlo completo"

- **Cámara fija** que encuadra todo el circuito (F3). En Phaser, una escena con la
  cámara ajustada al tamaño del mapa; sin `startFollow`.
- Representación del circuito: un **tilemap** (rejilla de tiles: asfalto, hierba,
  arena, muro) es lo más noventero y práctico. La superficie del tile puede
  **modificar el agarre** (hierba = resbala/frena, asfalto = agarre normal),
  reforzando la jugabilidad casi gratis.
- Colisiones simples: el coche rebota o frena al tocar los muros/bordes.
- Meta y vueltas: líneas de sector para cronometrar vueltas (contador de tiempo,
  mejor vuelta) — barato de añadir y muy adictivo.

### 3.6 Estética de los 90

- **Pixel art** con paleta reducida (16–32 colores), vista **cenital** (top-down).
- Resolución interna baja (p. ej. 320×240 o 384×216) **escalada con nearest-neighbor**
  para el look pixelado nítido. Phaser lo soporta con `pixelArt: true` y `zoom`.
- Referencias visuales/jugables: *Micro Machines*, *Super Cars II*, *Super Off Road*,
  *Death Rally*.
- Audio chiptune/8-bit y efectos cortos (motor, derrape, checkpoint). Usar assets
  con licencia libre (OpenGameArt, Kenney) hasta tener arte propio.

### 3.7 Diseño orientado a datos: circuitos y coches definidos por JSON (requisitos A1, A2)

Requisito clave: que **circuitos y vehículos sean genéricos y definidos por datos**,
no incrustados en el código. Así, añadir un circuito o un coche nuevo es **crear/editar
un fichero**, primero a mano en JSON y, en el futuro, con un **editor visual**. Este
principio se adopta **desde la v1** (aunque haya un solo circuito y un solo coche),
porque condiciona la arquitectura y es carísimo de retro-encajar más tarde.

**Regla de oro:** la lógica del juego (render, físicas, reglas) **no conoce** ningún
circuito ni coche concreto; solo sabe **interpretar el esquema de datos**. Los
circuitos y coches viven como **assets** (`public/tracks/*.json`,
`public/cars/*.json`), no como código.

Beneficios:
- Nuevos circuitos/coches **sin recompilar la lógica** ni arriesgar regresiones.
- **Modding** trivial: cualquiera puede aportar un JSON.
- El **editor visual** futuro solo tiene que producir el mismo JSON → desacoplado del juego.
- Los datos son **testeables y validables** (esquema) de forma independiente.

**Contrato de datos (versión y validación).** Cada fichero lleva un campo
`schemaVersion`. Al cargar, se **valida contra un esquema** (p. ej. JSON Schema con
Zod/Ajv) para dar errores claros si un circuito hecho a mano está mal formado. El
esquema es el punto de acoplamiento estable entre juego, ficheros a mano y editor.

**Esquema de circuito (borrador ilustrativo).** Conviene separar la *geometría
jugable* (independiente de gráficos) de la *presentación*:

```jsonc
// public/tracks/rally-01.json
{
  "schemaVersion": 1,
  "id": "rally-01",
  "name": "Bosque Bravo",
  "size": { "width": 384, "height": 216 },   // el mapa cabe entero en pantalla (F3)
  "tileSize": 16,
  "surfaces": {                                // catálogo de superficies -> agarre
    "asphalt": { "grip": 1.0,  "drag": 1.00 },
    "grass":   { "grip": 0.6,  "drag": 1.06 },
    "sand":    { "grip": 0.75, "drag": 1.10 }
  },
  "layers": {
    "surface": [[0,0,1,1, "..."]],            // rejilla de índices de superficie (tilemap)
    "walls":   [[0,1,0, "..."]]               // colisión
  },
  "spawn":   { "x": 120, "y": 180, "angle": 0 },
  "waypoints": [                               // centro de pista: meta, checkpoints, dirección
    // angle/width (opcionales, solo start_finish): dibuja la meta como una
    // línea a cuadros perpendicular a la dirección de carrera, en vez de
    // un simple punto.
    { "x": 120, "y": 180, "type": "start_finish", "angle": 90, "width": 64 },
    { "x": 300, "y": 60,  "type": "checkpoint" }
  ],
  "laps": 3,
  "theme": "forest"                            // pista de estilo para tileset/paleta
}
```

> Nota práctica: el editor de mapas **Tiled** exporta JSON de tilemaps y encaja de
> forma natural con esto; puede ser el "editor a futuro" sin construir nada, y su
> salida se adapta a nuestro esquema con un pequeño importador.

**Esquema de coche/vehículo (borrador ilustrativo).** Recoge exactamente los ejes
que mencionas —peso, potencia, longitud, apariencia— traducidos a parámetros del
modelo arcade de la sección 3.4:

```jsonc
// public/cars/rally-hatch.json
{
  "schemaVersion": 1,
  "id": "rally-hatch",
  "name": "Rally Hatch",
  "physics": {
    "mass": 1.0,            // "peso": afecta a inercia/aceleración efectiva
    "enginePower": 900,     // "potencia": fuerza de aceleración
    "brakingPower": 1200,
    "maxSpeed": 260,
    "turnRate": 3.2,        // rad/s de giro a velocidad de referencia
    "gripForward": 0.98,    // fricción longitudinal (sección 3.4)
    "gripLateral": 0.90,    // agarre lateral: mayor = menos derrape
    "handbrakeGrip": 0.60,  // agarre lateral con freno de mano: menor que gripLateral = más derrape
    "length": 24,           // "longitud": batalla; afecta al radio de giro/feel
    "width": 12
  },
  "appearance": {           // "apariencia": desacoplada de la física
    "sprite": "cars/rally-hatch.png",
    "wheelbaseOffset": 6,
    "skidColor": "#333333"
  }
}
```

**Impacto en la arquitectura (carpetas ya previstas en 3.3):**
- `src/config/schema/` — definición y validación de esquemas (`track.ts`, `car.ts`).
- `src/entities/Car.ts` — se construye **a partir de** un `CarConfig` cargado, sin
  constantes propias; los números viven en el JSON.
- `src/track/TrackLoader.ts` — carga y valida un `TrackDefinition` y monta el tilemap,
  colisiones y waypoints desde datos.
- `public/tracks/`, `public/cars/` — los ficheros de datos como assets.

**Alcance por versiones (evita sobre-ingeniería):**
- **v1:** un circuito y un coche, **pero cargados desde su JSON** con esquema
  `schemaVersion: 1` y validación básica. Nada de editor todavía.
- **Futuro:** varios ficheros + selector de coche/circuito; luego **editor** (propio
  o vía Tiled) que produce el mismo JSON. Como el juego ya lee datos, no hay que
  reescribir la lógica.

> Coste de adoptarlo ya: **bajo** (definir dos esquemas y un cargador). Coste de
> añadirlo después: **alto** (reescribir entidades y circuito). Por eso es A1/A2,
> requisito desde el día uno aunque su interfaz de usuario llegue mucho más tarde.

---

## 4. ¿Cómo gestionar la evolución del proyecto desde el repositorio?

Objetivo (NF4): que **desde el propio repo** se vea el **estado**, las **tareas
pendientes** y los **bugs**. Propuesta pragmática y de bajo mantenimiento, en dos
capas que se complementan:

### 4.1 Capa "viva y automática": GitHub nativo

- **Issues** = unidad de trabajo. Cada tarea o bug es un issue.
- **Labels** para clasificar y filtrar:
  - Tipo: `feature`, `bug`, `chore`, `docs`, `idea`.
  - Prioridad: `prio:alta`, `prio:media`, `prio:baja`.
  - Área: `area:fisicas`, `area:render`, `area:circuito`, `area:audio`, `area:ci`.
  - Estado especial: `good-first-task`, `blocked`.
- **Milestones** = versiones (`v0.1 Prototipo jugable`, `v0.2 Cronómetro y vueltas`,
  `v1.0`). Agrupan issues y dan una barra de progreso automática.
- **GitHub Projects (tablero Kanban)**: columnas `Backlog → To Do → In Progress →
  Done`. Es la "foto" del estado en un vistazo. Los issues entran/salen del tablero.
- **Plantillas de issue** (`.github/ISSUE_TEMPLATE/`) para que reportar un bug o
  pedir una feature sea rápido y estructurado (incluidas en este repo).
- **Pull Requests + revisión**: aunque trabajes en solitario, hacer PRs contra
  `main` deja un historial legible y permite que la CI valide antes de fusionar.

### 4.2 Capa "documental y versionada": ficheros en `docs/`

Complementa a GitHub y garantiza constancia **dentro del repo** (útil aunque un día
migres de plataforma):

- **`docs/ANALISIS.md`** (este documento): el porqué de las decisiones.
- **`docs/ROADMAP.md`**: hitos y fases, enlazando a milestones. Estado de alto nivel.
- **`docs/CHANGELOG.md`**: qué cambió en cada versión (formato *Keep a Changelog*).
- **`docs/decisiones/`** (opcional, ADRs ligeros): registro de decisiones técnicas
  importantes (una por fichero) cuando cambie algo estructural.

> **Fuente única de verdad:** las tareas y bugs **vivos** viven en **Issues**
> (no dupliques listas en markdown que se quedan obsoletas). Los documentos de
> `docs/` guardan lo **estable**: rumbo, decisiones e historial de versiones.

### 4.3 Convenciones que mantienen el orden

- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`…
  Hace el historial legible y permite generar el changelog casi solo.
- **Ramas**: `feature/…`, `fix/…`, `docs/…`. `main` siempre desplegable.
- **Cerrar issues desde el commit/PR**: `fix: corrige derrape infinito (closes #12)`.
- **Versionado semántico** relajado: `0.x` mientras se prototipa, `1.0` al primer
  circuito completo y divertido.
- **Definición de "hecho"**: compila, pasa lint/tests, se ha probado jugando, y el
  CHANGELOG/roadmap reflejan el cambio si procede.

### 4.4 Automatización mínima (GitHub Actions)

- **CI** en cada PR: `install → lint → test → build`. Si algo falla, no se fusiona.
- **Deploy** al hacer merge en `main`: build de Vite → publicar en GitHub Pages.

Con esto, el estado del proyecto es autoevidente: el **tablero** dice qué se está
haciendo, los **milestones** el progreso hacia cada versión, los **issues con label
`bug`** los fallos abiertos, y el **CHANGELOG** lo ya entregado.

---

## 5. ¿Dónde ejecutarlo? (proyecto de juguete)

### 5.1 En desarrollo (tu máquina)

- **`vite dev`**: servidor local con recarga en caliente. Es todo lo que necesitas
  para iterar el tuning de físicas al instante.

### 5.2 Para compartir y "que se juegue"

| Opción | Coste | Esfuerzo | Ideal para |
|---|---|---|---|
| **GitHub Pages** | Gratis | Bajo (Actions) | **Recomendado**: vive junto al repo, deploy automático |
| **itch.io** | Gratis | Bajo (subir zip/HTML) | Distribución con **comunidad gamer**, página de juego con carátula |
| Netlify / Vercel | Gratis (hobby) | Bajo | Previews por PR, dominios cómodos |
| Cloudflare Pages | Gratis | Bajo | Alternativa rápida a lo anterior |

**Conclusión:** **GitHub Pages** como destino principal (cero fricción, todo en el
mismo sitio que el código) y, cuando haya algo presentable, **subirlo también a
itch.io** para darle una "carátula" retro y compartirlo con jugadores. No hace falta
servidor propio ni base de datos: es un juego 100% cliente.

---

## 6. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Las físicas "no sienten bien" (poco divertidas) | Alto (es el núcleo) | Constantes de tuning aisladas en `config/`; prototipar y jugar pronto; iterar |
| Sobre-ingeniería del alcance | Medio | Congelar v1 al mínimo jugable; ideas nuevas van a Issues, no al código |
| Rendimiento en móvil | Bajo/Medio | Resolución interna baja + pixel art ligero; Canvas/WebGL de Phaser sobra |
| Assets con licencia dudosa | Medio (legal) | Usar solo assets libres (Kenney, OpenGameArt) o propios; anotar créditos |
| Perder el hilo del estado | Medio | Tablero + milestones + CHANGELOG desde el día 1 |
| Esquema de datos que se queda corto (circuitos/coches) | Medio | `schemaVersion` desde v1 + validación; empezar minimalista y ampliar con versión de esquema |

---

## 7. Plan por fases (propuesta de roadmap)

- **v0.1 — Prototipo jugable (el "juego" mínimo):** un coche que acelera, frena, gira
  y **derrapa** sobre un circuito visible completo. Sin arte final. Objetivo: que
  *conducir sea divertido*. **El coche y el circuito ya se cargan desde JSON con
  esquema** (A1/A2), aunque solo haya uno de cada.
- **v0.2 — Circuito y reglas:** tilemap (cargado por datos) con superficies
  (asfalto/hierba), muros con colisión, meta, **cronómetro y mejor vuelta**.
- **v0.3 — Estética 90s:** pixel art del coche y el circuito, HUD retro, audio.
- **v0.4 — Pulido y feel:** partículas de derrape, sonido de motor, tuning fino.
- **v1.0 — Primera versión completa:** un circuito redondo y divertido, publicado en
  GitHub Pages (y itch.io).

Cada fase = un **milestone** en GitHub con sus issues.

---

## 8. Conclusiones

1. **Tecnología:** juego **web** con **Phaser 3 + TypeScript + Vite**. Máxima
   diversión/mantenibilidad por unidad de esfuerzo, y cero fricción para jugar.
2. **Físicas:** modelo **arcade propio** con agarre longitudinal vs lateral para
   lograr el derrape; constantes tuneables aisladas. Nada de simulación realista.
3. **Estética:** pixel art cenital, resolución interna baja escalada, paleta
   reducida, audio chiptune. Referencias: *Micro Machines*, *Super Cars*.
4. **Gestión desde el repo:** **Issues + Labels + Projects + Milestones** para lo
   vivo (tareas y bugs), y **`docs/` (ROADMAP, CHANGELOG, ADRs)** para lo estable.
   **CI/CD con Actions** para validar y desplegar. Fuente única de verdad: Issues.
5. **Ejecución:** `vite dev` en local; publicación en **GitHub Pages** (principal) e
   **itch.io** (distribución). Sin backend: juego 100% cliente, coste cero.
6. **Genérico por datos (A1/A2):** circuitos y coches se definen en **JSON con
   esquema versionado**, no en código. La lógica solo interpreta el esquema; añadir
   un circuito o vehículo = crear un fichero (a mano o, a futuro, con editor/Tiled).
   Se adopta **desde la v1** porque es barato ahora y caro de retro-encajar después.

**Siguiente paso recomendado:** montar el esqueleto del proyecto (Vite + Phaser +
TS), crear el milestone `v0.1` y su primer issue ("coche que acelera/frena/gira/derrapa
sobre un rectángulo"), y empezar a *jugar* con las constantes de físicas cuanto antes.
La diversión se descubre jugando, no diseñando en el papel.
