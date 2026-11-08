import { describe, expect, it } from 'vitest';
import rally01 from '../public/tracks/rally-01.json';
import rally02 from '../public/tracks/rally-02.json';
import rally03 from '../public/tracks/rally-03.json';

interface TiledProperty {
  name: string;
  value: unknown;
}

interface TiledTile {
  id: number;
  properties?: TiledProperty[];
}

interface TiledLayer {
  name: string;
  type: string;
  width?: number;
  height?: number;
  data?: number[];
  objects?: TiledObject[];
}

interface TiledObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  properties?: TiledProperty[];
}

interface TiledTrack {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  properties: TiledProperty[];
  tilesets: { firstgid: number; tiles?: TiledTile[] }[];
  layers: TiledLayer[];
}

const tracks: Record<string, TiledTrack> = {
  'rally-01': rally01 as unknown as TiledTrack,
  'rally-02': rally02 as unknown as TiledTrack,
  'rally-03': rally03 as unknown as TiledTrack,
};

function mapProperty(track: TiledTrack, name: string): unknown {
  return track.properties.find((property) => property.name === name)?.value;
}

function layer(track: TiledTrack, name: string): TiledLayer {
  const found = track.layers.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Falta la capa ${name}`);
  return found;
}

function surfaceKeyAt(track: TiledTrack, x: number, y: number): string | undefined {
  const surface = layer(track, 'surface');
  const col = Math.floor(x / track.tilewidth);
  const row = Math.floor(y / track.tileheight);
  if (col < 0 || row < 0 || col >= track.width || row >= track.height) return undefined;

  const gid = surface.data?.[row * track.width + col];
  if (gid === undefined || gid === 0) return undefined;

  for (const tileset of track.tilesets) {
    const localId = gid - tileset.firstgid;
    const tile = tileset.tiles?.find((candidate) => candidate.id === localId);
    if (tile) {
      return tile.properties?.find((property) => property.name === 'surfaceKey')?.value as
        | string
        | undefined;
    }
  }
  return undefined;
}

function isWallAt(track: TiledTrack, x: number, y: number): boolean {
  const walls = layer(track, 'walls');
  const col = Math.floor(x / track.tilewidth);
  const row = Math.floor(y / track.tileheight);
  if (col < 0 || row < 0 || col >= track.width || row >= track.height) return true;
  return walls.data?.[row * track.width + col] !== 0;
}

function waypoints(track: TiledTrack): TiledObject[] {
  return (layer(track, 'waypoints').objects ?? []).filter((object) => object.type !== 'spawn');
}

function lapLengthPx(track: TiledTrack): number {
  const points = waypoints(track);
  let length = 0;
  for (let i = 0; i < points.length; i++) {
    const from = points[i];
    const to = points[(i + 1) % points.length];
    length += Math.hypot(to.x - from.x, to.y - from.y);
  }
  return length;
}

describe.each(Object.entries(tracks))('%s — estructura de contenido', (_name, track) => {
  it('tiene las capas y dimensiones esperadas', () => {
    expect(layer(track, 'surface').data).toHaveLength(track.width * track.height);
    expect(layer(track, 'walls').data).toHaveLength(track.width * track.height);
    expect(track.width).toBeGreaterThan(0);
    expect(track.height).toBeGreaterThan(0);
  });

  it('tiene spawn dentro del mapa y sobre una superficie transitable', () => {
    const spawn = (layer(track, 'waypoints').objects ?? []).find((object) => object.type === 'spawn');
    expect(spawn).toBeDefined();
    expect(spawn!.x).toBeGreaterThanOrEqual(0);
    expect(spawn!.y).toBeGreaterThanOrEqual(0);
    expect(spawn!.x).toBeLessThan(track.width * track.tilewidth);
    expect(spawn!.y).toBeLessThan(track.height * track.tileheight);
    expect(surfaceKeyAt(track, spawn!.x, spawn!.y)).toBeDefined();
    expect(isWallAt(track, spawn!.x, spawn!.y)).toBe(false);
  });

  it('tiene una sola meta y todos los waypoints dentro del mapa y fuera de muros', () => {
    const points = waypoints(track);
    expect(points.filter((point) => point.type === 'start_finish')).toHaveLength(1);
    expect(points.filter((point) => point.type === 'checkpoint').length).toBeGreaterThanOrEqual(2);

    for (const point of points) {
      expect(surfaceKeyAt(track, point.x, point.y)).toBeDefined();
      expect(isWallAt(track, point.x, point.y)).toBe(false);
    }
  });

  it('define la geometría de la meta y una vuelta con longitud razonable', () => {
    const startFinish = waypoints(track).find((point) => point.type === 'start_finish');
    const width = startFinish?.properties?.find((property) => property.name === 'width')?.value;
    const angle = startFinish?.properties?.find((property) => property.name === 'angle')?.value;

    expect(typeof width).toBe('number');
    expect(Number(width)).toBeGreaterThan(0);
    expect(typeof angle).toBe('number');

    const length = lapLengthPx(track);
    expect(length).toBeGreaterThan(500);
    expect(length).toBeLessThan(10000);
  });

  it('declara vueltas y un tema válidos', () => {
    expect(Number(mapProperty(track, 'laps'))).toBeGreaterThanOrEqual(1);
    expect(typeof mapProperty(track, 'theme')).toBe('string');
  });

  it('si define medallas, están ordenadas de oro a bronce', () => {
    const gold = Number(mapProperty(track, 'goldMs'));
    const silver = Number(mapProperty(track, 'silverMs'));
    const bronze = Number(mapProperty(track, 'bronzeMs'));

    expect(gold).toBeGreaterThan(0);
    expect(silver).toBeGreaterThan(gold);
    expect(bronze).toBeGreaterThan(silver);
  });
});
