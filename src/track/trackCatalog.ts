/**
 * Lista de circuitos disponibles para elegir en el título. Fuente única de
 * verdad: `BootScene` la usa para precargar todos los circuitos, y
 * `TitleScene` para construir el selector. Añadir un circuito nuevo es
 * crear el JSON en `public/tracks/` y una entrada más aquí.
 */
export interface TrackCatalogEntry {
  key: string;
  path: string;
  label: string;
}

export const TRACK_CATALOG: TrackCatalogEntry[] = [
  { key: 'track:rally-01', path: 'tracks/rally-01.json', label: 'Bosque Bravo' },
  { key: 'track:rally-02', path: 'tracks/rally-02.json', label: 'Duna Veloz' },
];
