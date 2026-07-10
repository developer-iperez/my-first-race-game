import { z } from 'zod';

/**
 * Esquema de datos de un coche. Todos los parámetros de la sensación de
 * conducción (peso, potencia, agarre, longitud...) viven aquí, no en el
 * código: un vehículo nuevo es un fichero JSON en public/cars/ que cumpla
 * este esquema.
 */

const CarPhysicsSchema = z.object({
  mass: z.number().positive(),
  enginePower: z.number().positive(),
  brakingPower: z.number().positive(),
  maxSpeed: z.number().positive(),
  turnRate: z.number().positive(),
  gripForward: z.number().min(0).max(1),
  gripLateral: z.number().min(0).max(1),
  handbrakeGrip: z.number().min(0).max(1),
  length: z.number().positive(),
  width: z.number().positive(),
});

const CarAppearanceSchema = z.object({
  sprite: z.string().min(1),
  wheelbaseOffset: z.number(),
  skidColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const CarSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  physics: CarPhysicsSchema,
  appearance: CarAppearanceSchema,
});

export type CarDefinition = z.infer<typeof CarSchema>;
export type CarPhysicsConfig = z.infer<typeof CarPhysicsSchema>;
export type CarAppearance = z.infer<typeof CarAppearanceSchema>;

export function parseCar(data: unknown): CarDefinition {
  const result = CarSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Coche inválido: ${result.error.message}`);
  }
  return result.data;
}
