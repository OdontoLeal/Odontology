import { z } from 'zod';

export const ExamenEstomatognaticoItemSchema = z
  .object({
    presenta_anormalidades: z.boolean(),
    observaciones: z.string().default('N/A'),
  })
  .refine(
    (data) => {
      if (data.presenta_anormalidades) {
        const obs = data.observaciones.trim();
        return obs.length > 0 && obs.toUpperCase() !== 'N/A';
      }
      return true;
    },
    {
      message:
        'Si presenta anormalidades, las observaciones son obligatorias y no pueden ser "N/A".',
      path: ['observaciones'],
    }
  );

export const ExamenEstomatognaticoSchema = z.object({
  labios: ExamenEstomatognaticoItemSchema,
  lengua: ExamenEstomatognaticoItemSchema,
  carrillos_mucosa_yugal: ExamenEstomatognaticoItemSchema,
  amigdalas: ExamenEstomatognaticoItemSchema,
  paladar_duro: ExamenEstomatognaticoItemSchema,
  frenillos: ExamenEstomatognaticoItemSchema,
  mucosa_masticadora: ExamenEstomatognaticoItemSchema,
  encia: ExamenEstomatognaticoItemSchema,
});

export type ExamenEstomatognaticoItem = z.infer<
  typeof ExamenEstomatognaticoItemSchema
>;
export type ExamenEstomatognatico = z.infer<
  typeof ExamenEstomatognaticoSchema
>;

/**
 * Capa 3: Factory / Builder de examen estomatognático por defecto
 */
export function createDefaultExamenEstomatognatico(): ExamenEstomatognatico {
  return {
    labios: {
      presenta_anormalidades: false,
      observaciones:
        'N/A - Hidratados, normocoloreados y sin lesiones ni queilitis comisural.',
    },
    lengua: {
      presenta_anormalidades: false,
      observaciones:
        'N/A - Lengua normoglosa, papilas íntegras, movilidad conservada sin alteraciones.',
    },
    carrillos_mucosa_yugal: {
      presenta_anormalidades: false,
      observaciones:
        'N/A - Mucosa yugal rosada, húmeda y flexible, sin mordeduras ni queratosis.',
    },
    amigdalas: {
      presenta_anormalidades: false,
      observaciones:
        'N/A - Grado I simétricas, sin exudado, hiperemia ni compromiso infeccioso.',
    },
    paladar_duro: {
      presenta_anormalidades: false,
      observaciones:
        'N/A - Bóveda palatina normal, mucosa queratinizada sana, sin torus ni fisuras.',
    },
    frenillos: {
      presenta_anormalidades: false,
      observaciones:
        'N/A - Inserciones normoposicionadas sin tracción gingival ni limitación lingual.',
    },
    mucosa_masticadora: {
      presenta_anormalidades: false,
      observaciones:
        'N/A - Rebordes íntegros, espesor de queratinización adecuado sin zonas dolorosas.',
    },
    encia: {
      presenta_anormalidades: false,
      observaciones:
        'N/A - Encía rosa coral, consistencia firme, textura en cáscara de naranja, sin sangrado espontáneo.',
    },
  };
}
