export type RaceMedal = 'gold' | 'silver' | 'bronze';

export interface MedalTimes {
  goldMs: number;
  silverMs: number;
  bronzeMs: number;
}

/**
 * Medalla por tiempo total de carrera. Los tiempos vienen de los datos del
 * circuito (map properties de Tiled) y deben estar ordenados de menor a
 * mayor; si no hay datos, no hay medalla.
 */
export function getMedal(totalTimeMs: number, medals: MedalTimes | undefined): RaceMedal | null {
  if (!medals) return null;
  if (totalTimeMs <= medals.goldMs) return 'gold';
  if (totalTimeMs <= medals.silverMs) return 'silver';
  if (totalTimeMs <= medals.bronzeMs) return 'bronze';
  return null;
}

export function formatMedal(medal: RaceMedal | null): string {
  switch (medal) {
    case 'gold':
      return 'ORO';
    case 'silver':
      return 'PLATA';
    case 'bronze':
      return 'BRONCE';
    default:
      return 'SIN MEDALLA';
  }
}
