import { z } from 'zod';

export const ESPECIALIDADES_CATALOGO = [
  'Endodoncia Microscópica',
  'Periodoncia e Implantología',
  'Ortodoncia y Ortopedia Maxilar',
  'Cirugía Oral y Maxilofacial',
  'Rehabilitación Oral y Prótesis',
  'Odontopediatría',
  'Otra',
] as const;

export const PrescripcionItemSchema = z.object({
  medicamento_principio_activo: z
    .string()
    .min(1, 'El principio activo o medicamento es obligatorio.'),
  dosis_concentracion: z
    .string()
    .min(1, 'La dosis o concentración es obligatoria.'),
  frecuencia_via: z
    .string()
    .min(1, 'La frecuencia y vía de administración son obligatorias.'),
  duracion_tratamiento: z
    .string()
    .min(1, 'La duración del tratamiento es obligatoria.'),
  indicaciones_adicionales: z.string().optional(),
});

export const IncapacidadMedicaSchema = z
  .object({
    requiere_incapacidad: z.boolean(),
    dias_incapacidad: z
      .number()
      .int()
      .min(1, 'La incapacidad mínima es de 1 día.')
      .max(30, 'La incapacidad máxima es de 30 días.')
      .optional(),
    fecha_inicio: z.string().default(''),
    fecha_culminacion: z.string().default(''),
    diagnostico_justificacion: z.string().default(''),
  })
  .refine(
    (data) => {
      if (data.requiere_incapacidad) {
        return (
          data.fecha_inicio.trim().length > 0 &&
          data.fecha_culminacion.trim().length > 0 &&
          data.diagnostico_justificacion.trim().length > 0
        );
      }
      return true;
    },
    {
      message:
        'Si requiere incapacidad, la fecha de inicio, culminación y el diagnóstico/justificación son obligatorios.',
      path: ['diagnostico_justificacion'],
    }
  );

export const RemisionMedicaSchema = z
  .object({
    requiere_remision: z.boolean(),
    especialidad_destino: z.string().default(''),
    otra_especialidad_nombre: z.string().nullable().optional(),
    prioridad_atencion: z
      .string()
      .default('Ordinaria / Consulta Externa'),
    motivo_resumen_clinico: z.string().default(''),
  })
  .refine(
    (data) => {
      if (data.requiere_remision) {
        if (!data.especialidad_destino || data.especialidad_destino.trim().length === 0) {
          return false;
        }
        if (data.especialidad_destino === 'Otra') {
          return (
            Boolean(data.otra_especialidad_nombre) &&
            data.otra_especialidad_nombre!.trim().length > 0
          );
        }
      }
      return true;
    },
    {
      message:
        'Si requiere remisión, debe seleccionar la especialidad de destino (o especificar el nombre si eligió "Otra").',
      path: ['especialidad_destino'],
    }
  )
  .refine(
    (data) => {
      if (data.requiere_remision) {
        const destino = (data.especialidad_destino === 'Otra'
          ? data.otra_especialidad_nombre
          : data.especialidad_destino) || '';
        // RF-DOC-003: Prohibido incluir nombre de doctor individual en destino
        if (/^(dr\.|dra\.|dr\b|dra\b|doctor\b|doctora\b)/i.test(destino.trim())) {
          return false;
        }
      }
      return true;
    },
    {
      message:
        'La remisión debe realizarse a una especialidad, no a un profesional médico individual (RF-DOC-003).',
      path: ['especialidad_destino'],
    }
  )
  .refine(
    (data) => {
      if (data.requiere_remision) {
        return data.motivo_resumen_clinico.trim().length > 0;
      }
      return true;
    },
    {
      message:
        'El motivo y resumen clínico de la remisión es obligatorio.',
      path: ['motivo_resumen_clinico'],
    }
  );

export const PlanManejoSchema = z.object({
  conducta: z.string().optional(),
  prescripcion_farmacologica: z.array(PrescripcionItemSchema).default([]),
  incapacidad_medica: IncapacidadMedicaSchema,
  remision_medica: RemisionMedicaSchema,
  documentos: z.array(z.any()).optional().default([]),
});

export type PrescripcionItem = z.infer<typeof PrescripcionItemSchema>;
export type IncapacidadMedica = z.infer<typeof IncapacidadMedicaSchema>;
export type RemisionMedica = z.infer<typeof RemisionMedicaSchema>;
export type PlanManejo = z.infer<typeof PlanManejoSchema>;

/**
 * Capa 3: Factory / Builder de Plan de Manejo por defecto
 */
export function createDefaultPlanManejo(): PlanManejo {
  return {
    conducta: '',
    prescripcion_farmacologica: [],
    incapacidad_medica: {
      requiere_incapacidad: false,
      dias_incapacidad: undefined,
      fecha_inicio: '',
      fecha_culminacion: '',
      diagnostico_justificacion: '',
    },
    remision_medica: {
      requiere_remision: false,
      especialidad_destino: '',
      otra_especialidad_nombre: null,
      prioridad_atencion: 'Ordinaria / Consulta Externa',
      motivo_resumen_clinico: '',
    },
    documentos: [],
  };
}
