# Migración a Tiled + Phaser.Tilemaps, y a assets Kenney.nl

## Contexto

El proyecto renderiza hoy las pistas pintando cada tile a mano
(`scene.add.image` por celda en `TrackRenderer.ts`) a partir de un JSON
propio (`public/tracks/*.json`, validado con Zod en `src/config/schema/track.ts`),
y usa arte generado por script (Pillow) a 16×16 px con una resolución interna
de canvas deliberadamente baja (384×224, `pixelArt: true`, `src/main.ts:18-27`)
para lograr la estética "90s pixel art".

El usuario pide dos migraciones:
1. **Tiled + Phaser.Tilemaps** para diseñar/renderizar pistas.
2. **Kenney.nl** para el arte (coche + tiles), asumiendo el usuario que esto
   implica subir la resolución interna del juego (tileSize y canvas) en vez
   de downscalear el arte de Kenney a 16px — decisión ya tomada por el
   usuario tras plantear el desajuste de estilos.

Ambas son viables. Cada una se diseña para tocar el mínimo código posible
fuera de su área: la migración a Tiled **preserva intacta** la API de
`TrackQuery.ts` (y sus tests en `tests/trackQuery.test.ts`) y el esquema Zod
existente (y `tests/schema.test.ts`), porque `carPhysics.ts`/`TrackQuery.ts`
son físicas puras testeadas sin Phaser — un valor explícito del proyecto
(ver CLAUDE.md) que no interesa sacrificar por cambiar el renderer.

Se recomienda hacer primero **Plan B (Kenney + reescalado)** y después
**Plan A (Tiled)**, porque Plan A necesita saber qué ficheros de imagen va a
referenciar el tileset — así se evita rehacer esa parte dos veces. Son
independientes y cada una es revertible por separado.

---

## Plan B — Migrar a assets Kenney.nl (con reescalado ×2)

### Decisión de escala
Kenney no ofrece pixel-art de 16px; sus packs de coches/carreteras vienen a
mayor resolución con estilo "flat/vector limpio". En vez de downscalear
(perdiendo nitidez), se sube la resolución interna del juego: **tileSize
16→32px, canvas 384×224→768×448**. Esto es coherente: la técnica actual
("resolución interna baja escalada con nearest-neighbor", comentario en
`src/main.ts:10-11`) es precisamente lo que da el look "pixel art chunky";
al doblar la resolución interna se abandona ese look a propósito en favor de
un estilo más detallado que encaja con Kenney. Factor de escala = **2×**,
ajustable si al inspeccionar el pack elegido conviene otro múltiplo.

### 1. Elegir y descargar el pack
El usuario descarga manualmente un pack CC0 de Kenney (p. ej. Racing
Pack/Racing Kit, vista cenital) y lo coloca en una carpeta de staging
(`/tmp/.../kenney-raw/` o similar) — no hay forma de que Claude descargue el
zip por su cuenta en este entorno. Una vez ahí, se inspecciona el contenido
real (nombres de fichero, resolución nativa) antes de mapear qué imagen
sustituye a cada asset actual; los nombres exactos de Kenney no se fijan de
antemano en este plan porque varían entre packs.

### 2. Sustituir los ficheros de arte
Mapeo 1:1 con lo que ya carga `BootScene.ts:25-30`:
- `public/cars/rally-hatch.png` ← sprite de coche cenital de Kenney,
  recortado/escalado a las nuevas dimensiones del coche (ver físicas abajo).
  **Comprobar orientación**: `Car.ts:38-40` asume que el sprite mira hacia
  ángulo 0 = +x; si el sprite de Kenney mira hacia arriba (+y), rotarlo 90°
  al exportar, no parchear el código.
- `public/tiles/asphalt.png`, `grass.png`, `sand.png`, `wall.png` ← tiles
  cenitales equivalentes de Kenney, exportados a 32×32.
- `public/tiles/particle-dust.png` — mantener o sustituir por un asset a
  juego; es secundario, no bloquea el resto.
- Añadir `docs/ASSETS_CREDITS.md` con crédito a Kenney (CC0 no lo exige,
  pero Kenney lo pide como cortesía) y enlace a la licencia del pack.

### 3. Reescalar ×2 los ficheros de datos existentes
Aplicar el factor 2× **solo a los campos espaciales/dependientes de
velocidad-distancia**, dejando intactos los parámetros adimensionales:

**`src/main.ts`** (líneas 18-19 y 26-27): `width`/`height` 384×224 →
768×448, tanto en `config` como en `config.scale`.

**`public/tracks/rally-0{1,2,3}.json`** (esquema en
`src/config/schema/track.ts`): `tileSize` ×2, `size.width`/`size.height`
×2, `spawn.x`/`spawn.y` ×2 (no `spawn.angle`), cada `waypoints[].x`/`.y` ×2
y `waypoints[].width` ×2 (no `.angle`). Las rejillas `layers.surface` y
`layers.walls` **no cambian de forma** (mismo nº de filas/columnas): al
doblar `tileSize` cada celda ya ocupa el doble de píxeles, así que el mapa
crece solo. `surfaces.*.grip`/`.drag` no cambian (son ratios).

**`public/cars/rally-hatch.json`** (esquema en `src/config/schema/car.ts`):
`physics.length` ×2, `physics.width` ×2, `physics.enginePower` ×2,
`physics.brakingPower` ×2, `physics.maxSpeed` ×2, `appearance.wheelbaseOffset`
×2. **Sin cambios**: `mass`, `turnRate` (angular, no espacial), `gripForward`,
`gripLateral`, `handbrakeGrip` (ratios 0..1). Razonamiento: en
`carPhysics.ts:257` `acceleration = (throttle * power) / mass`; doblar
`power` sin tocar `mass` dobla la aceleración en px/s² al mismo ritmo que
`maxSpeed` y las distancias del mapa, preservando el *feel* (mismo tiempo
en segundos para acelerar a fondo, mismo nº de "coche-anchos" para
completar un giro).

Nada más necesita cambios de código: `LapTracker`'s radio de activación de
waypoint ya se deriva en runtime como `track.tileSize * 2.5`
(`RaceScene.ts:99`), así que escala solo automáticamente.

### 4. Caveat menor
Los mejores tiempos guardados en `BestLaps` (localStorage, por
`trackKey+carKey`) quedan de antes del reescalado. Si el reescalado se hace
bien no deberían cambiar sustancialmente (mismas proporciones tiempo/espacio),
pero conviene vaciar el localStorage del navegador de pruebas al verificar,
para no comparar contra una marca que ya no es representativa.

### Verificación (Plan B)
- `tsc -b && npm run lint && npm run test && npm run build` para confirmar
  que el reescalado no rompe validación Zod ni tests existentes
  (`tests/schema.test.ts` seguirá pasando: solo cambian valores, no forma).
- Verificación en navegador real (regla de CLAUDE.md: cambios visuales no
  los cubre Vitest): cargar cada una de las 3 pistas, comprobar que el coche
  se ve proporcionado al mapa, que no se sale del canvas al arrancar, que
  el HUD/menús (CSS, no ligado a tileSize) siguen bien posicionados sobre
  el nuevo canvas 768×448, y que el *feel* de conducción (aceleración,
  derrape) se percibe igual que antes del reescalado.

---

## Plan A — Migrar pistas a Tiled + Phaser.Tilemaps

### Diseño: Tiled solo cambia autoría + render, no el contrato de físicas
`TrackQuery.ts` (usado en `RaceScene.ts:206-212` para grip/drag/muros) y su
tipo `TrackDefinition` (Zod, `src/config/schema/track.ts`) **se mantienen
sin cambios**. En vez de que la física consulte un `Phaser.Tilemaps.Tilemap`
directamente, se añade un adaptador que, al cargar el `.tmj` exportado por
Tiled, reconstruye el mismo objeto plano `TrackDefinition` de siempre
(rejillas `surface`/`walls`, `surfaces`, `spawn`, `waypoints`, `laps`,
`theme`) y lo valida con el `parseTrack` **ya existente**. Así
`tests/trackQuery.test.ts` y `tests/schema.test.ts` no necesitan tocarse.

### Convención en el fichero Tiled (.tmj)
- **Tile layer "surface"** (visible): un tile por celda, textura = la
  superficie (asfalto/hierba/arena) o el muro si es zona de colisión —
  igual que hoy, un único layer visual.
- **Tile layer "walls"** (lógico, no se renderiza): presencia de tile =
  muro, vacío = libre.
- **Tileset**: tileset de tipo "image collection" en Tiled, referenciando
  las mismas imágenes ya cargadas en `BootScene.ts` (o las nuevas de Plan
  B) — cada tile define propiedades custom `surfaceKey` (string), `grip`
  (float), `drag` (float) en el editor de Tiled (Tileset → propiedades por
  tile). Ahorra tener que empaquetar un atlas nuevo.
- **Object layer "waypoints"**: un objeto punto por waypoint. Un objeto de
  tipo/clase `spawn` con propiedad custom `angle` (grados); objetos de tipo
  `start_finish`/`checkpoint` con propiedades opcionales `angle`/`width`
  para el tipo `start_finish` (igual semántica que hoy en
  `TrackRenderer.ts:59-84`, sin tocar esa función de dibujo).
- **Map Properties** (Tiled → Map → Map Properties): `id`, `name`, `laps`,
  `theme`, `schemaVersion` — los campos de `TrackDefinition` que no son ni
  tile ni objeto.
- `tileSize` sale de `tilewidth`/`tileheight` del mapa (deben ser iguales);
  `size.width/height` sale de `map.widthInPixels`/`heightInPixels`.

### Ficheros a tocar
- **`src/scenes/BootScene.ts`**: `this.load.json(track.key, track.path)`
  (línea 18, vía `TrackLoader.enqueue`) pasa a
  `this.load.tilemapTiledJSON(...)` — cambio interno de `TrackLoader`, no
  hace falta tocar `BootScene.ts` directamente si `TrackLoader.enqueue`
  sigue teniendo la misma firma.
- **`src/track/TrackLoader.ts`**: `enqueue` usa
  `scene.load.tilemapTiledJSON(key, url)`; `get` construye
  `scene.make.tilemap({ key })`, llama al nuevo adaptador para obtener el
  objeto plano, lo valida con `parseTrack` (sin cambios), y devuelve
  `{ track, map }` en vez de solo `track`.
- **Nuevo `src/track/TiledMapAdapter.ts`**: función que recorre el
  `Phaser.Tilemaps.Tilemap` (layers "surface"/"walls", object layer
  "waypoints", map properties) y arma el objeto plano equivalente al JSON
  actual, para pasarlo a `parseTrack`.
- **`src/track/TrackRenderer.ts`**: sustituir el bucle manual de
  `scene.add.image` (líneas 22-33) por `map.addTilesetImage(...)` +
  `map.createLayer('surface', tileset, 0, 0)`; el layer "walls" no se
  renderiza (solo se lee su data desde el adaptador). El dibujo de
  checkpoints/meta (líneas 36-84) no cambia: sigue leyendo
  `track.waypoints`.
- **`src/scenes/RaceScene.ts`**: `this.track = TrackLoader.get(...)` pasa a
  desestructurar `{ track, map }`; `renderTrack(this, this.track)` (línea
  72) pasa a `renderTrack(this, map, this.track)`. El resto de
  `RaceScene.ts` (líneas 206-238, `getSurfaceGripAt`/`isWallAt`/etc.) **no
  cambia**, porque sigue operando sobre `this.track` con la misma forma de
  siempre.
- **`public/tracks/rally-0{1,2,3}.json`**: sustituidos por los `.tmj`
  exportados de Tiled (mismos nombres de fichero/rutas, así que
  `trackCatalog.ts` no cambia).
- **Nuevo script puntual `scripts/convert-track-to-tiled.mjs`**: convierte
  programáticamente los 3 JSON actuales a `.tmj` válido (mismas rejillas,
  mismos waypoints, propiedades por tile con `grip`/`drag`/`surfaceKey`),
  para no tener que re-dibujar las 3 pistas a mano en el editor de Tiled.
  A partir de ahí, cualquier pista **nueva** se autoría directamente en la
  app de Tiled (el usuario necesita instalarla:
  https://www.mapeditor.org, gratis).

### Riesgo a verificar en implementación (no bloqueante para el plan)
El comportamiento exacto de Phaser con tilesets tipo "image collection" (un
tile = una imagen suelta, en vez de un atlas único) tiene algunas
particularidades de API que conviene confirmar contra la documentación de
Phaser al implementarlo; si resulta más simple, la alternativa es empaquetar
las imágenes de tile en un único atlas antes de definir el tileset en
Tiled — no cambia nada del resto del plan.

### Verificación (Plan A)
- `tsc -b && npm run lint && npm run test && npm run build`: como
  `TrackQuery`/`TrackDefinition`/`parseTrack` no cambian de contrato,
  `tests/trackQuery.test.ts` y `tests/schema.test.ts` deben seguir pasando
  sin modificarlos — es la señal de que el adaptador está produciendo datos
  equivalentes a los de antes.
- Verificación en navegador real para las 3 pistas: el layout se ve igual
  que antes (mismas curvas/muros), grip en hierba/asfalto se siente igual,
  checkpoints/meta se activan en los mismos puntos, y no hay huecos/tiles
  mal alineados por el cambio de renderer.
