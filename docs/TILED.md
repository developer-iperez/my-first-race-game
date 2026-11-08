# Convenciones de Tiled — Rally 90s

> Cómo está montado un circuito en Tiled y qué debe cumplir para que el juego
> lo cargue sin errores.

## Mapa

- Tamaño actual: **24×14 tiles** de **32×32 px** (768×448 px).
- Orientación ortogonal, `infinite: false`.
- Propiedades de mapa obligatorias:
  - `schemaVersion` (int, 1)
  - `id` (string)
  - `name` (string)
  - `laps` (int)
  - `theme` (string: `forest`, `desert`, `canyon`...)
- Tileset: `rally-tiles`, imagen `tileset.png`, 4 tiles (asfalto, hierba,
  arena, muro).

## Capas

| Capa | Tipo | Visible | Uso |
|---|---|---|---|
| `surface` | tile layer | Sí | Superficie visual y física: asfalto, hierba, arena, muro |
| `walls` | tile layer | No | Colisión: cualquier tile no vacío es muro |
| `waypoints` | object layer | Sí | Spawn, meta y checkpoints |

### Capa `surface`

Los tiles deben llevar sus propiedades de superficie en el tileset:

| Tile | `surfaceKey` | `grip` | `drag` | Notas |
|---|---|---:|---:|---|
| Asfalto | `asphalt` | 1,00 | 1,00 | Trazada |
| Hierba | `grass` | 0,60 | 1,06 | Arcén / fuera de pista |
| Arena | `sand` | 0,75 | 1,12 | Dunas / castigo |
| Muro | — | — | — | Solo `isWall: true`; visual de muro |

El `TiledMapAdapter` lanza un error si una superficie transitable no define
`grip` y `drag`. No dejes una superficie a medias.

### Capa `walls`

- `0` = libre.
- Cualquier gid no vacío = muro (se usa el tile de muro, gid 4).
- No se renderiza; la colisión la resuelve `carCollision.ts`.
- El perímetro exterior debe estar cerrado para que el coche no se salga.

### Capa `waypoints`

Objetos punto:

| `type` | Nombre | Propiedades |
|---|---|---|
| `spawn` | `spawn` | `angle` (grados) |
| `start_finish` | `start_finish` | `angle`, `width` |
| `checkpoint` | `checkpoint` | `angle`, `width` |

- `angle` = sentido de carrera al cruzar la puerta:
  - `0` = +x (este)
  - `90` = +y (sur)
  - `180` = -x (oeste)
  - `270` = -y (norte)
- `width` = anchura de la puerta en píxeles, centrada en el objeto.
- La meta se dibuja como línea a cuadros perpendicular a `angle`.
- Los checkpoints se recorren **en orden**; la meta es el primer waypoint.
- No coloques una puerta sobre un tile de muro ni en el vértice de una
  chicane.

## Reglas de diseño

- Muro exterior de 1 tile en todo el perímetro.
- Carril mínimo: 3 tiles (96 px) en zonas técnicas; 4–6 tiles en rectas.
- Una zona de arena no es un muro: debe ser transitable, solo más lenta.
- Evita pasillos de 1–2 tiles: el coche mide 48×24 px y el giro mínimo ronda
  68 px.
- Deja la línea de meta en una recta con ancho suficiente para todo el carril.

## Validación

```bash
npm run validate
```

Comprueba:

- capas `surface`, `walls` y `waypoints`;
- dimensiones de las rejillas;
- spawn dentro del mapa, sobre superficie transitable y fuera de muro;
- una sola meta, checkpoints suficientes, todos fuera de muro;
- geometría de la meta (`angle`, `width`);
- longitud de vuelta razonable;
- `laps` y `theme`;
- que todas las superficies transitables definan `grip`/`drag`.

## Herramientas

- `scripts/generate-tracks.mjs`: generación inicial de los tres TMJ a partir
  de mapas de caracteres. No es la fuente de verdad; después se edita en
  Tiled.
- `scripts/convert-track-to-tiled.mjs`: conversión histórica del formato
  anterior; ya no se usa para las pistas nuevas.
