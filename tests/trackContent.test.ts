import { describe, expect, it } from 'vitest';
import rally01 from '../public/tracks/rally-01.json';
import rally02 from '../public/tracks/rally-02.json';
import rally03 from '../public/tracks/rally-03.json';

interface TiledTileProperty {
  name: string;
  value: unknown;
}

interface TiledTile {
  id: number;
  properties?: TiledTileProperty[];
}

interface TiledTrack {
  tilesets: { tiles?: TiledTile[] }[];
}

const tracks: Record<string, TiledTrack> = {
  'rally-01.json': rally01 as unknown as TiledTrack,
  'rally-02.json': rally02 as unknown as TiledTrack,
  'rally-03.json': rally03 as unknown as TiledTrack,
};

describe('contenido de circuitos', () => {
  it('incluye los 3 circuitos del catálogo', () => {
    expect(Object.keys(tracks)).toEqual(['rally-01.json', 'rally-02.json', 'rally-03.json']);
  });

  it.each(Object.entries(tracks))(
    '%s define grip y drag en todas las superficies transitables',
    (file, track) => {
      const tiles = track.tilesets.flatMap((tileset) => tileset.tiles ?? []);

      for (const tile of tiles) {
        const properties = Object.fromEntries((tile.properties ?? []).map((p) => [p.name, p.value]));
        if (properties.surfaceKey === undefined || properties.isWall === true) continue;

        expect(properties.surfaceKey).not.toBe('wall');
        expect(typeof properties.grip, `grip de ${String(properties.surfaceKey)} en ${file}`).toBe(
          'number',
        );
        expect(typeof properties.drag, `drag de ${String(properties.surfaceKey)} en ${file}`).toBe(
          'number',
        );
      }
    },
  );
});
