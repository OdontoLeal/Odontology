import { z } from 'zod';

export const HabitoHigieneItemSchema = z
  .object({
    aplica: z.boolean(),
    frecuencia_cantidad: z.string().default(''),
    observaciones: z.string().default(''),
  })
  .refine(
    (data) => {
      if (data.aplica) {
        return (
          data.frecuencia_cantidad.trim().length > 0 &&
          data.observaciones.trim().length > 0
        );
      }
      return true;
    },
    {
      message:
        'Si el hábito aplica, la frecuencia/cantidad y las observaciones no pueden estar vacías.',
      path: ['frecuencia_cantidad'],
    }
  );

export const HabitosHigieneSchema = z.object({
  bebe_alcohol: HabitoHigieneItemSchema,
  fuma_tabaco_vapeo: HabitoHigieneItemSchema,
  mastica_chicle_golosinas: HabitoHigieneItemSchema,
  cepillado_dental: HabitoHigieneItemSchema,
  uso_seda_dental: HabitoHigieneItemSchema,
  chequeos_odontologicos_periodicos: HabitoHigieneItemSchema,
});

export type HabitoHigieneItem = z.infer<typeof HabitoHigieneItemSchema>;
export type HabitosHigiene = z.infer<typeof HabitosHigieneSchema>;

/**
 * Capa 3: Factory / Builder de hábitos de higiene por defecto
 */
export function createDefaultHabitosHigiene(): HabitosHigiene {
  return {
    bebe_alcohol: {
      aplica: false,
      frecuencia_cantidad: 'No consume',
      observaciones: 'No refiere consumo habitual de bebidas alcohólicas',
    },
    fuma_tabaco_vapeo: {
      aplica: false,
      frecuencia_cantidad: 'No fuma',
      observaciones: 'No refiere tabaquismo ni cigarrillo electrónico',
    },
    mastica_chicle_golosinas: {
      aplica: false,
      frecuencia_cantidad: 'Ocasional',
      observaciones: 'Consumo ocasional',
    },
    cepillado_dental: {
      aplica: true,
      frecuencia_cantidad: '3 veces o más al día',
      observaciones: 'Cepillo cerdas suaves manual. Técnica correcta',
    },
    uso_seda_dental: {
      aplica: true,
      frecuencia_cantidad: '1 vez al día (nocturno)',
      observaciones: 'Seda encerada en la noche sin sangrado habitual',
    },
    chequeos_odontologicos_periodicos: {
      aplica: true,
      frecuencia_cantidad: 'Cada 6 meses',
      observaciones: 'Asiste a controles semestrales periódicos',
    },
  };
}
