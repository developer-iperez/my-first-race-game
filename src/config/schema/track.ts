import { z } from 'zod';

/**
 * Esquema de datos de un circuito. La lógica del juego solo conoce este
 * esquema, nunca un circuito concreto: añadir un circuito nuevo es crear un
 * fichero JSON en public/tracks/ que lo cumpla (a mano o con un editor).
 */

const SurfaceSchema = z.object({
  grip: z.number().positive(),
  drag: z.number().positive(),
});

const WaypointSchema = z.object({
  x: z.number(),
  y: z.number(),
  type: z.enum(['start_finish', 'checkpoint']),
});

export const TrackSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  size: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  tileSize: z.number().positive(),
  surfaces: z.record(z.string(), SurfaceSchema),
  layers: z.object({
    surface: z.array(z.array(z.string())),
    walls: z.array(z.array(z.number().int().min(0).max(1))),
  }),
  spawn: z.object({
    x: z.number(),
    y: z.number(),
    angle: z.number(),
  }),
  waypoints: z.array(WaypointSchema).min(1),
  laps: z.number().int().positive(),
  theme: z.string().min(1),
});

export type TrackDefinition = z.infer<typeof TrackSchema>;
export type SurfaceDefinition = z.infer<typeof SurfaceSchema>;
export type Waypoint = z.infer<typeof WaypointSchema>;

/**
 * Valida y castea un objeto arbitrario (p. ej. salido de un fetch a JSON) a
 * TrackDefinition. Lanza con un mensaje legible si el fichero no cumple el
 * esquema, para que un circuito mal escrito a mano falle pronto y claro.
 */
export function parseTrack(data: unknown): TrackDefinition {
  const result = TrackSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Circuito inválido: ${result.error.message}`);
  }
  return result.data;
}
