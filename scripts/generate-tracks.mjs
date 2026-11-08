import { writeFileSync } from 'node:fs';

/**
 * Genera los tres circuitos iniciales del rediseño S2.2 a partir de un mapa
 * de caracteres compacto. Es una herramienta de contenido, no lógica de
 * juego: la fuente de verdad una vez generados es el TMJ, que se puede abrir
 * y editar en Tiled.
 *
 * Uso: node scripts/generate-tracks.mjs
 *
 * Leyenda:
 *   # muro   . asfalto   , hierba   ~ arena
 */

const WIDTH = 24;
const HEIGHT = 14;
const TILE = 32;

const TILE_IDS = { '.': 1, ',': 2, '~': 3, '#': 4 };

function blankGrid() {
  return Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => '.'));
}

function border(grid) {
  for (let col = 0; col < WIDTH; col++) {
    grid[0][col] = '#';
    grid[HEIGHT - 1][col] = '#';
  }
  for (let row = 0; row < HEIGHT; row++) {
    grid[row][0] = '#';
    grid[row][WIDTH - 1] = '#';
  }
}

function rect(grid, col0, row0, col1, row1, char) {
  for (let row = row0; row <= row1; row++) {
    for (let col = col0; col <= col1; col++) {
      grid[row][col] = char;
    }
  }
}

function trackBosqueBravo() {
  const grid = blankGrid();
  border(grid);

  // Isla central con protuberancias arriba/abajo: obliga a abrir la trazada.
  rect(grid, 7, 5, 16, 8, '#');
  rect(grid, 11, 4, 12, 4, '#');
  rect(grid, 11, 9, 12, 9, '#');

  // Chicanes exteriores.
  rect(grid, 4, 1, 5, 1, '#');
  rect(grid, 18, 12, 19, 12, '#');

  // Zonas de arena que rompen el agarre.
  rect(grid, 17, 1, 20, 2, '~');
  rect(grid, 3, 11, 6, 12, '~');

  return {
    id: 'rally-01',
    name: 'Bosque Bravo',
    theme: 'forest',
    laps: 5,
    medals: { goldMs: 100000, silverMs: 120000, bronzeMs: 150000 },
    grid,
    spawn: { x: 368, y: 80, angle: 0 },
    waypoints: [
      { type: 'start_finish', x: 400, y: 80, angle: 0, width: 96 },
      { type: 'checkpoint', x: 640, y: 96, angle: 0, width: 128 },
      { type: 'checkpoint', x: 640, y: 352, angle: 90, width: 160 },
      { type: 'checkpoint', x: 144, y: 352, angle: 180, width: 128 },
      { type: 'checkpoint', x: 144, y: 96, angle: 270, width: 160 },
    ],
    decor: [
      { type: 'tree', x: 304, y: 208 },
      { type: 'tree', x: 464, y: 240 },
      { type: 'bush', x: 272, y: 240 },
      { type: 'bush', x: 496, y: 208 },
      { type: 'tree', x: 80, y: 16 },
      { type: 'bush', x: 208, y: 16 },
      { type: 'tree', x: 688, y: 16 },
      { type: 'rock', x: 80, y: 432 },
      { type: 'tree', x: 688, y: 432 },
    ],
  };
}

function trackDunaVeloz() {
  const grid = blankGrid();
  border(grid);

  // Gran infield de arena; el centro tiene una isla de muro para que no se
  // pueda cortar en línea recta sin penalización.
  rect(grid, 6, 5, 17, 8, '~');
  rect(grid, 10, 6, 13, 7, '#');

  // Arenas en las salidas de las curvas.
  rect(grid, 18, 1, 22, 2, '~');
  rect(grid, 1, 11, 5, 12, '~');

  return {
    id: 'rally-02',
    name: 'Duna Veloz',
    theme: 'desert',
    laps: 5,
    medals: { goldMs: 90000, silverMs: 110000, bronzeMs: 140000 },
    grid,
    spawn: { x: 368, y: 80, angle: 0 },
    waypoints: [
      { type: 'start_finish', x: 400, y: 80, angle: 0, width: 96 },
      { type: 'checkpoint', x: 640, y: 96, angle: 0, width: 128 },
      { type: 'checkpoint', x: 640, y: 352, angle: 90, width: 160 },
      { type: 'checkpoint', x: 144, y: 352, angle: 180, width: 128 },
      { type: 'checkpoint', x: 144, y: 96, angle: 270, width: 160 },
    ],
    decor: [
      { type: 'rock', x: 336, y: 208 },
      { type: 'rock', x: 400, y: 208 },
      { type: 'bush', x: 368, y: 240 },
      { type: 'rock', x: 432, y: 240 },
      { type: 'rock', x: 80, y: 16 },
      { type: 'rock', x: 688, y: 16 },
      { type: 'rock', x: 80, y: 432 },
      { type: 'rock', x: 688, y: 432 },
    ],
  };
}

function trackSerpiente() {
  const grid = blankGrid();
  border(grid);

  // Isla central pequeña y chicanes alternadas: carril de 3 tiles en los
  // puntos más cerrados, pensado para frenar y colocar el coche.
  rect(grid, 8, 5, 15, 8, '#');
  rect(grid, 4, 1, 5, 1, '#');
  rect(grid, 18, 1, 19, 1, '#');
  rect(grid, 11, 4, 12, 4, '#');
  rect(grid, 5, 9, 6, 9, '#');
  rect(grid, 17, 9, 18, 9, '#');
  rect(grid, 11, 12, 12, 12, '#');

  // Tramo de arena en la lane izquierda.
  rect(grid, 1, 5, 3, 8, '~');

  return {
    id: 'rally-03',
    name: 'Serpiente',
    theme: 'canyon',
    laps: 5,
    medals: { goldMs: 105000, silverMs: 125000, bronzeMs: 155000 },
    grid,
    spawn: { x: 368, y: 80, angle: 0 },
    waypoints: [
      { type: 'start_finish', x: 400, y: 80, angle: 0, width: 96 },
      { type: 'checkpoint', x: 640, y: 96, angle: 0, width: 128 },
      { type: 'checkpoint', x: 640, y: 352, angle: 90, width: 128 },
      { type: 'checkpoint', x: 144, y: 352, angle: 180, width: 128 },
      { type: 'checkpoint', x: 144, y: 96, angle: 270, width: 128 },
    ],
    decor: [
      { type: 'rock', x: 336, y: 208 },
      { type: 'rock', x: 432, y: 240 },
      { type: 'bush', x: 304, y: 240 },
      { type: 'bush', x: 464, y: 208 },
      { type: 'rock', x: 80, y: 16 },
      { type: 'rock', x: 688, y: 16 },
      { type: 'rock', x: 80, y: 432 },
      { type: 'rock', x: 688, y: 432 },
    ],
  };
}

function tileProperties() {
  return [
    {
      id: 0,
      properties: [
        { name: 'surfaceKey', type: 'string', value: 'asphalt' },
        { name: 'grip', type: 'float', value: 1 },
        { name: 'drag', type: 'float', value: 1 },
      ],
    },
    {
      id: 1,
      properties: [
        { name: 'surfaceKey', type: 'string', value: 'grass' },
        { name: 'grip', type: 'float', value: 0.6 },
        { name: 'drag', type: 'float', value: 1.06 },
      ],
    },
    {
      id: 2,
      properties: [
        { name: 'surfaceKey', type: 'string', value: 'sand' },
        { name: 'grip', type: 'float', value: 0.75 },
        { name: 'drag', type: 'float', value: 1.12 },
      ],
    },
    {
      id: 3,
      properties: [{ name: 'isWall', type: 'bool', value: true }],
    },
  ];
}

function buildMap(definition) {
  const surfaceData = [];
  const wallsData = [];

  for (let row = 0; row < HEIGHT; row++) {
    for (let col = 0; col < WIDTH; col++) {
      const char = definition.grid[row][col];
      const gid = TILE_IDS[char];
      if (!gid) throw new Error(`Tile desconocido "${char}" en ${definition.id}`);
      surfaceData.push(gid);
      wallsData.push(char === '#' ? 4 : 0);
    }
  }

  const objects = [
    {
      id: 1,
      name: 'spawn',
      type: 'spawn',
      x: definition.spawn.x,
      y: definition.spawn.y,
      width: 0,
      height: 0,
      point: true,
      visible: true,
      properties: [{ name: 'angle', type: 'float', value: definition.spawn.angle }],
    },
    ...definition.waypoints.map((waypoint, index) => ({
      id: index + 2,
      name: waypoint.type === 'start_finish' ? 'start_finish' : 'checkpoint',
      type: waypoint.type,
      x: waypoint.x,
      y: waypoint.y,
      width: 0,
      height: 0,
      point: true,
      visible: true,
      properties: [
        { name: 'angle', type: 'float', value: waypoint.angle },
        { name: 'width', type: 'float', value: waypoint.width },
      ],
    })),
  ];

  return {
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.2',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    infinite: false,
    width: WIDTH,
    height: HEIGHT,
    tilewidth: TILE,
    tileheight: TILE,
    nextlayerid: 5,
    nextobjectid: objects.length + 1,
    properties: [
      { name: 'schemaVersion', type: 'int', value: 1 },
      { name: 'id', type: 'string', value: definition.id },
      { name: 'name', type: 'string', value: definition.name },
      { name: 'laps', type: 'int', value: definition.laps },
      { name: 'theme', type: 'string', value: definition.theme },
      { name: 'goldMs', type: 'int', value: definition.medals.goldMs },
      { name: 'silverMs', type: 'int', value: definition.medals.silverMs },
      { name: 'bronzeMs', type: 'int', value: definition.medals.bronzeMs },
    ],
    tilesets: [
      {
        firstgid: 1,
        name: 'rally-tiles',
        tilewidth: TILE,
        tileheight: TILE,
        tilecount: 4,
        columns: 4,
        image: 'tileset.png',
        imagewidth: 128,
        imageheight: 32,
        margin: 0,
        spacing: 0,
        tiles: tileProperties(),
      },
    ],
    layers: [
      {
        id: 1,
        name: 'surface',
        type: 'tilelayer',
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        width: WIDTH,
        height: HEIGHT,
        data: surfaceData,
      },
      {
        id: 2,
        name: 'walls',
        type: 'tilelayer',
        opacity: 1,
        visible: false,
        x: 0,
        y: 0,
        width: WIDTH,
        height: HEIGHT,
        data: wallsData,
      },
      {
        id: 3,
        name: 'waypoints',
        type: 'objectgroup',
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        draworder: 'topdown',
        objects,
      },
      {
        id: 4,
        name: 'decor',
        type: 'objectgroup',
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        draworder: 'topdown',
        objects: (definition.decor ?? []).map((decor, index) => ({
          id: 100 + index,
          name: decor.type,
          type: decor.type,
          x: decor.x,
          y: decor.y,
          width: 0,
          height: 0,
          point: true,
          visible: true,
        })),
      },
    ],
  };
}

const tracks = [trackBosqueBravo(), trackDunaVeloz(), trackSerpiente()];

for (const definition of tracks) {
  const map = buildMap(definition);
  const path = new URL(`../public/tracks/${definition.id}.json`, import.meta.url);
  writeFileSync(path, `${JSON.stringify(map, null, 2)}\n`);
  console.log(`generado ${definition.id} — ${definition.name} (${definition.laps} vueltas)`);
}
