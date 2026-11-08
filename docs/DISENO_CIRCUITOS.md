# Diseño de circuitos — S2.1

> Documento de diseño del rediseño de pistas (Sprint 2).
> Implementación: `public/tracks/rally-0{1,2,3}.json`, generados inicialmente
> por `scripts/generate-tracks.mjs` y editables después en Tiled.

## Restricciones del juego actual

- Vista cenital fija; el circuito completo debe caber en el canvas interno
  de 768×448 (F3).
- Mapa de 24×14 tiles de 32 px = 768×448 px.
- Coche de 48×24 px; radio de giro de ~68 px a baja velocidad y ~143 px a
  velocidad alta.
- Físicas de derrape: las curvas cerradas obligan a frenar o derrapar; no
  están pensadas para tomarse a velocidad máxima.

Estas restricciones hacen que una vuelta de 30–45 s no quepa con comodidad en
un único mapa de 768×448 sin que el coche vaya casi parado. Para esta fase se
prioriza **una vuelta de 15–25 s y 5 vueltas por carrera** (~1,5–2 min). Una
etapa de 2–3 min requeriría mapas más grandes y cámara con scroll/zoom, que
queda fuera de F3 y se evaluará en S3.4.

## Identidad de las pistas

| Circuito | Tema | Carácter | Vueltas | Elementos |
|---|---|---|---:|---|
| Bosque Bravo | `forest` | Técnico, mixto | 5 | Isla central irregular, chicanes exteriores, arena en salidas de curva |
| Duna Veloz | `desert` | Rápido, amplio | 5 | Infield de arena, isla central pequeña, arenas en curvas |
| Serpiente | `canyon` | Ratonero, con muros | 5 | Chicanes alternadas, carril de 3 tiles en los puntos cerrados, tramo de arena |

Medallas de tiempo total orientativas (se ajustan tras playtesting):

| Circuito | Oro | Plata | Bronce |
|---|---:|---:|---:|
| Bosque Bravo | 100 s | 120 s | 150 s |
| Duna Veloz | 90 s | 110 s | 140 s |
| Serpiente | 105 s | 125 s | 155 s |

## Reglas de trazado

- Muro exterior de 1 tile en todo el perímetro.
- Anchura mínima de carril: **3 tiles (96 px)** en chicanes; 4–6 tiles en el
  resto.
- Las curvas cerradas se señalan con un muro o una zona de arena, no con un
  cambio invisible de agarre.
- Los checkpoints se colocan en rectas o salidas de curva, nunca dentro de un
  muro ni en el vértice de una chicane.
- La meta se coloca en una recta, con ancho suficiente para cubrir el carril.
- Las zonas de arena se usan como castigo de trazada: frenan y reducen agarre,
  pero no son muros.

## Bosque Bravo

Isla central de 10×4 tiles con protuberancias arriba y abajo; chicanes
exteriores en la parte superior e inferior; arena en la salida de la curva
superior derecha e inferior izquierda. La idea es un trazado de bosque con
curvas que se encadenan y obligan a colocar el coche.

```
########################
#...##...........~~~~..#
#................~~~~..#
#......................#
#..........##..........#
#......##########......#
#......##########......#
#......##########......#
#......##########......#
#..........##..........#
#......................#
#..~~~~................#
#..~~~~...........##...#
########################
```

## Duna Veloz

Anillo ancho alrededor de un gran infield de arena, con una isla de muro en
el centro para que el corte directo no sea gratis. Arenas en las salidas de
las curvas superior derecha e inferior izquierda. Es la pista de los derrapes
largos y las velocidades altas.

```
########################
#.................~~~~~#
#.................~~~~~#
#......................#
#......................#
#.....~~~~~~~~~~~~.....#
#.....~~~~####~~~~.....#
#.....~~~~####~~~~.....#
#.....~~~~~~~~~~~~.....#
#......................#
#......................#
#~~~~~.................#
#~~~~~.................#
########################
```

## Serpiente

Isla central pequeña y chicanes alternadas arriba y abajo: en los puntos más
cerrados el carril baja a 3 tiles. La lane izquierda tiene un tramo de arena.
Es la pista técnica: hay que frenar, colocar el coche y salir con tracción.

```
########################
#...##............##...#
#......................#
#......................#
#..........##..........#
#~~~....########.......#
#~~~....########.......#
#~~~....########.......#
#~~~....########.......#
#....##..........##....#
#......................#
#......................#
#..........##..........#
########################
```

## Waypoints y puertas

Las tres pistas comparten la misma secuencia de puertas (la forma de anillo),
pero cada una tiene su propia anchura y sus propios muros:

| Puerta | Posición | Ángulo | Anchura |
|---|---:|---:|---:|
| `start_finish` | (400, 80) | 0° | 128 px |
| checkpoint 1 | (640, 96) | 0° | 128–160 px |
| checkpoint 2 | (640, 352) | 90° | 128–160 px |
| checkpoint 3 | (144, 320) | 180° | 128–160 px |
| checkpoint 4 | (144, 96) | 270° | 128–160 px |

Ángulo = sentido de carrera al cruzar la puerta (0 = +x, 90 = +y). En S2.3
`LapTracker` usará la anchura y el ángulo como una puerta real, no como un
círculo de radio 80 px.

## Superficies

| Superficie | Grip | Drag | Uso |
|---|---:|---:|---|
| Asfalto | 1,00 | 1,00 | Trazada principal |
| Hierba | 0,60 | 1,06 | Fuera de pista / arcenes |
| Arena | 0,75 | 1,12 | Dunas, salidas de curva, atajos con castigo |

## Generación y edición

- `scripts/generate-tracks.mjs` genera los tres TMJ iniciales a partir de
  mapas de caracteres. Es una herramienta puntual: **la fuente de verdad es
  el TMJ**.
- A partir de aquí, las pistas se editan en Tiled. Ver
  [`TILED.md`](./TILED.md).
- `npm run validate` comprueba superficies, spawn, waypoints, meta y longitud.
