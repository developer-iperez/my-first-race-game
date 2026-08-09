import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Convierte los ficheros de circuito del esquema propio (schemaVersion 1,
 * rejillas surface/walls + waypoints) al formato Tiled JSON (TMJ), para no
 * tener que redibujar a mano en el editor de Tiled las pistas ya existentes.
 * Ver plans/migracion-tiled-kenney.md (Plan A) para la convención completa.
 *
 * Uso puntual: node scripts/convert-track-to-tiled.mjs
 */

const TRACK_FILES = ['public/tracks/rally-01.json', 'public/tracks/rally-02.json', 'public/tracks/rally-03.json'];

const TILESET_NAME = 'rally-tiles';
const TILESET_IMAGE = 'tileset.png';
const TILE_ORDER = ['asphalt', 'grass', 'sand', 'wall']; // local tile id 0..3 -> gid 1..4
const WALL_LOCAL_ID = TILE_ORDER.indexOf('wall');

function gidForSurface(key) {
  const localId = TILE_ORDER.indexOf(key);
  if (localId === -1) throw new Error(`Superficie desconocida en el tileset: ${key}`);
  return localId + 1; // firstgid = 1
}

function tileProperties(surfaceKey, surfaces) {
  if (surfaceKey === 'wall') {
    return [{ name: 'isWall', type: 'bool', value: true }];
  }
  const def = surfaces[surfaceKey];
  // Esta pista concreta puede no usar esta superficie (p. ej. "sand" en un
  // circuito sin arena): el gid correspondiente no aparecerá en su rejilla,
  // así que no hace falta grip/drag reales, solo la key para que sea válido.
  if (!def) {
    return [{ name: 'surfaceKey', type: 'string', value: surfaceKey }];
  }
  return [
    { name: 'surfaceKey', type: 'string', value: surfaceKey },
    { name: 'grip', type: 'float', value: def.grip },
    { name: 'drag', type: 'float', value: def.drag },
  ];
}

function convert(track) {
  const rows = track.layers.surface.length;
  const cols = track.layers.surface[0].length;
  const tileSize = track.tileSize;

  const surfaceData = [];
  const wallsData = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const isWall = track.layers.walls[row][col] === 1;
      const surfaceKey = track.layers.surface[row][col];
      surfaceData.push(isWall ? gidForSurface('wall') : gidForSurface(surfaceKey));
      wallsData.push(isWall ? WALL_LOCAL_ID + 1 : 0);
    }
  }

  // Todas las pistas comparten un único atlas (public/tiles/tileset.png), así
  // que se listan las propiedades de las 4 casillas aunque esta pista en
  // concreto no use alguna superficie (p. ej. "sand"): su gid simplemente no
  // aparece en la rejilla de datos de este mapa.
  const tiles = TILE_ORDER.map((key, id) => ({
    id,
    properties: tileProperties(key, track.surfaces),
  }));

  const objects = [];
  let nextObjectId = 1;
  objects.push({
    id: nextObjectId++,
    name: 'spawn',
    type: 'spawn',
    x: track.spawn.x,
    y: track.spawn.y,
    width: 0,
    height: 0,
    point: true,
    visible: true,
    properties: [{ name: 'angle', type: 'float', value: track.spawn.angle }],
  });
  for (const wp of track.waypoints) {
    const properties = [];
    if (wp.angle !== undefined) properties.push({ name: 'angle', type: 'float', value: wp.angle });
    if (wp.width !== undefined) properties.push({ name: 'width', type: 'float', value: wp.width });
    objects.push({
      id: nextObjectId++,
      name: wp.type,
      type: wp.type,
      x: wp.x,
      y: wp.y,
      width: 0,
      height: 0,
      point: true,
      visible: true,
      properties,
    });
  }

  return {
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.2',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    infinite: false,
    width: cols,
    height: rows,
    tilewidth: tileSize,
    tileheight: tileSize,
    nextlayerid: 4,
    nextobjectid: nextObjectId,
    properties: [
      { name: 'schemaVersion', type: 'int', value: track.schemaVersion },
      { name: 'id', type: 'string', value: track.id },
      { name: 'name', type: 'string', value: track.name },
      { name: 'laps', type: 'int', value: track.laps },
      { name: 'theme', type: 'string', value: track.theme },
    ],
    tilesets: [
      {
        firstgid: 1,
        name: TILESET_NAME,
        tilewidth: tileSize,
        tileheight: tileSize,
        tilecount: TILE_ORDER.length,
        columns: TILE_ORDER.length,
        image: TILESET_IMAGE,
        imagewidth: tileSize * TILE_ORDER.length,
        imageheight: tileSize,
        margin: 0,
        spacing: 0,
        tiles,
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
        width: cols,
        height: rows,
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
        width: cols,
        height: rows,
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
    ],
  };
}

for (const file of TRACK_FILES) {
  const track = JSON.parse(readFileSync(file, 'utf8'));
  const tmj = convert(track);
  writeFileSync(file, JSON.stringify(tmj, null, 2) + '\n');
  console.log(`Converted ${file} -> Tiled JSON`);
}
