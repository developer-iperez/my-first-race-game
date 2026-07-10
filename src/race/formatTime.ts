/** Formatea milisegundos como mm:ss.mmm, el formato clásico de vuelta de rally/carreras. */
export function formatLapTime(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return '--:--.---';

  const totalMs = Math.floor(ms);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;

  return `${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
}

function pad(value: number, length: number): string {
  return value.toString().padStart(length, '0');
}
