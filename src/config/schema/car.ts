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
  /**
   * Cuánto se pierde de capacidad de giro a alta velocidad (subviraje).
   * 0 = radio constante; mayor = el coche abre la trazada al acelerar.
   * Opcional con default en carPhysics para no romper datos antiguos.
   */
  understeer: z.number().min(0).max(3).optional(),
  gripForward: z.number().min(0).max(1),
  gripLateral: z.number().min(0).max(1),
  handbrakeGrip: z.number().min(0).max(1),
  /** Pérdida de agarre lateral al girar fuerte (0 = no derrapa, 1 = hielo). */
  corneringGripLoss: z.number().min(0).max(1).optional(),
  /** Agarre lateral mínimo girando fuerte sin freno de mano. */
  minLateralGrip: z.number().min(0).max(1).optional(),
  /** Agarre lateral mínimo con el freno de mano puesto. */
  handbrakeMinGrip: z.number().min(0).max(1).optional(),
  /** Impulso lateral máximo del contravolante rápido (fracción de la velocidad). */
  flickImpulse: z.number().min(0).max(3).optional(),
  /** Retención de velocidad por frame con el freno de mano (60 fps). */
  handbrakeForwardRetention: z.number().min(0).max(1).optional(),
  /** Velocidad con la que el morro persigue el objetivo de giro con buen agarre. */
  yawCatchUpRate: z.number().min(0).max(1).optional(),
  /** Cuánto frena esa respuesta cuando el coche ya patina (0..1). */
  yawInertiaFromSlip: z.number().min(0).max(1).optional(),
  /** Respuesta mínima del volante incluso en patinazo completo. */
  minYawCatchUpRate: z.number().min(0).max(1).optional(),
  /** Fracción de speedFactor a partir de la cual girar fuerte pierde todo el agarre extra. */
  corneringSpeedSaturation: z.number().min(0.1).max(1).optional(),
  /** Derrape extra al detectar un flick de contravolante. */
  flickGripLossBoost: z.number().min(0).max(1).optional(),
  /** Slip previo por debajo del cual un cambio de yaw cuenta como flick nuevo. */
  flickMaxPriorSlip: z.number().min(0).max(1).optional(),
  /** Fracción de potencia disponible en marcha atrás. */
  reversePowerFactor: z.number().min(0).max(1).optional(),
  /** Rapidez con la que el agarre lateral cae al girar/frenar (por frame a 60 fps). */
  gripDropRate: z.number().min(0.01).max(1).optional(),
  /** Rapidez con la que el agarre lateral vuelve al soltar el freno de mano. */
  gripRiseRate: z.number().min(0.001).max(1).optional(),
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
