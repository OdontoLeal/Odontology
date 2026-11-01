import { z } from 'zod';

export const AntecedenteItemSchema = z
  .object({
    presenta: z.boolean(),
    observaciones: z.string().default('N/A'),
  })
  .refine(
    (data) => {
      if (data.presenta) {
        const obs = data.observaciones.trim();
        return obs.length > 0 && obs.toUpperCase() !== 'N/A';
      }
      return true;
    },
    {
      message:
        'Si presenta el antecedente, las observaciones son obligatorias y no pueden ser "N/A".',
      path: ['observaciones'],
    }
  );

export const AntecedentesClinicosSchema = z.object({
  accidentes_traumas: AntecedenteItemSchema,
  cirugias: AntecedenteItemSchema,
  patologicos: AntecedenteItemSchema,
  farmacologicos: AntecedenteItemSchema,
  inmunologicos: AntecedenteItemSchema,
  familiares: AntecedenteItemSchema,
  otros_habitos_practicas: AntecedenteItemSchema,
});

export type AntecedenteItem = z.infer<typeof AntecedenteItemSchema>;
export type AntecedentesClinicos = z.infer<typeof AntecedentesClinicosSchema>;

/**
 * Capa 3: Factory / Builder de antecedentes clínicos por defecto para inicialización
 */
export function createDefaultAntecedentesClinicos(): AntecedentesClinicos {
  return {
    accidentes_traumas: {
      presenta: false,
      observaciones: 'N/A - Niega traumas faciales o dentales previos',
    },
    cirugias: {
      presenta: false,
      observaciones: 'N/A - Niega cirugías previas',
    },
    patologicos: {
      presenta: false,
      observaciones: 'N/A - Niega enfermedades crónicas o sistémicas',
    },
    farmacologicos: {
      presenta: false,
      observaciones: 'N/A - Niega medicamentos o alergias conocidas',
    },
    inmunologicos: {
      presenta: false,
      observaciones: 'N/A - Tolerancia comprobada a látex y resinas',
    },
    familiares: {
      presenta: false,
      observaciones: 'N/A - Niega antecedentes familiares de relevancia',
    },
    otros_habitos_practicas: {
      presenta: false,
      observaciones:
        'Sin registro de hábitos orales parafuncionales o perjudiciales reportados',
    },
  };
}

/**
 * Builder para acción de UI "No aplica" (RF-HCL-005)
 */
export function createNoAplicaAntecedentesClinicos(): AntecedentesClinicos {
  return {
    accidentes_traumas: { presenta: false, observaciones: 'N/A' },
    cirugias: { presenta: false, observaciones: 'N/A' },
    patologicos: { presenta: false, observaciones: 'N/A' },
    farmacologicos: { presenta: false, observaciones: 'N/A' },
    inmunologicos: { presenta: false, observaciones: 'N/A' },
    familiares: { presenta: false, observaciones: 'N/A' },
    otros_habitos_practicas: { presenta: false, observaciones: 'N/A' },
  };
}
