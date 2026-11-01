import { z } from 'zod';

export const CaraDentalSchema = z
  .object({
    caries_activa: z.boolean().default(false),
    restauracion_resina: z.boolean().default(false),
    sellante_fosas: z.boolean().default(false),
    desgaste_faceta: z.boolean().default(false),
  })
  .refine(
    (caras) => {
      const activeCount = [
        caras.caries_activa,
        caras.restauracion_resina,
        caras.sellante_fosas,
        caras.desgaste_faceta,
      ].filter(Boolean).length;
      return activeCount <= 1;
    },
    {
      message:
        'Solo se permite un (1) hallazgo activo por superficie dental (RF-HCL-007).',
    }
  );

export const UpperToothCarasSchema = z.object({
  vestibular: CaraDentalSchema,
  palatina: CaraDentalSchema,
  mesial: CaraDentalSchema,
  distal: CaraDentalSchema,
  oclusal_incisal: CaraDentalSchema,
});

export const LowerToothCarasSchema = z.object({
  vestibular: CaraDentalSchema,
  lingual: CaraDentalSchema,
  mesial: CaraDentalSchema,
  distal: CaraDentalSchema,
  oclusal_incisal: CaraDentalSchema,
});

export const SimbolosTecnicosSchema = z.object({
  diente_extraido: z.boolean().default(false),
  extraccion_requerida: z.boolean().default(false),
  corona: z.boolean().default(false),
  implante: z.boolean().default(false),
  protesis_fija: z.boolean().default(false),
  endodoncia: z.boolean().default(false),
  puente: z.boolean().default(false),
});

export const RelacionPuenteSchema = z
  .object({
    piezas_conectadas: z.array(z.number()),
    rol_estimado: z.string(),
  })
  .nullable()
  .optional();

export const NotaClinicaSchema = z
  .object({
    zona_afectada: z.string(),
    descripcion: z.string(),
  })
  .nullable()
  .optional();

export const PiezaDentalSchema = z.object({
  codigo_fdi: z.number(),
  nombre_anatomico: z.string(),
  caras: z.union([UpperToothCarasSchema, LowerToothCarasSchema]),
  simbolos_tecnicos: SimbolosTecnicosSchema,
  relacion_puente: RelacionPuenteSchema,
  nota_clinica: NotaClinicaSchema,
});

export const CuadranteSchema = z.object({
  id_cuadrante: z.number(),
  descripcion: z.string(),
  piezas: z.record(z.string(), PiezaDentalSchema),
});

export const OdontogramaSchema = z.object({
  cuadrantes: z.object({
    cuadrante_1: CuadranteSchema,
    cuadrante_2: CuadranteSchema,
    cuadrante_3: CuadranteSchema,
    cuadrante_4: CuadranteSchema,
    cuadrante_5: CuadranteSchema.optional(),
    cuadrante_6: CuadranteSchema.optional(),
    cuadrante_7: CuadranteSchema.optional(),
    cuadrante_8: CuadranteSchema.optional(),
  }),
});

export type CaraDental = z.infer<typeof CaraDentalSchema>;
export type UpperToothCaras = z.infer<typeof UpperToothCarasSchema>;
export type LowerToothCaras = z.infer<typeof LowerToothCarasSchema>;
export type SimbolosTecnicos = z.infer<typeof SimbolosTecnicosSchema>;
export type RelacionPuente = z.infer<typeof RelacionPuenteSchema>;
export type NotaClinica = z.infer<typeof NotaClinicaSchema>;
export type PiezaDental = z.infer<typeof PiezaDentalSchema>;
export type Cuadrante = z.infer<typeof CuadranteSchema>;
export type Odontograma = z.infer<typeof OdontogramaSchema>;

const BLANK_CARA: CaraDental = {
  caries_activa: false,
  restauracion_resina: false,
  sellante_fosas: false,
  desgaste_faceta: false,
};

const BLANK_SIMBOLOS: SimbolosTecnicos = {
  diente_extraido: false,
  extraccion_requerida: false,
  corona: false,
  implante: false,
  protesis_fija: false,
  endodoncia: false,
  puente: false,
};

const QUADRANT_DEFINITIONS = [
  {
    key: 'cuadrante_1' as const,
    id: 1,
    desc: 'Maxilar Superior Derecho',
    isUpper: true,
    isTemp: false,
    teeth: [
      { fdi: 18, name: 'Tercer molar superior derecho' },
      { fdi: 17, name: 'Segundo molar superior derecho' },
      { fdi: 16, name: 'Primer molar superior derecho' },
      { fdi: 15, name: 'Segundo premolar superior derecho' },
      { fdi: 14, name: 'Primer premolar superior derecho' },
      { fdi: 13, name: 'Canino superior derecho' },
      { fdi: 12, name: 'Incisivo lateral superior derecho' },
      { fdi: 11, name: 'Incisivo central superior derecho' },
    ],
  },
  {
    key: 'cuadrante_2' as const,
    id: 2,
    desc: 'Maxilar Superior Izquierdo',
    isUpper: true,
    isTemp: false,
    teeth: [
      { fdi: 21, name: 'Incisivo central superior izquierdo' },
      { fdi: 22, name: 'Incisivo lateral superior izquierdo' },
      { fdi: 23, name: 'Canino superior izquierdo' },
      { fdi: 24, name: 'Primer premolar superior izquierdo' },
      { fdi: 25, name: 'Segundo premolar superior izquierdo' },
      { fdi: 26, name: 'Primer molar superior izquierdo' },
      { fdi: 27, name: 'Segundo molar superior izquierdo' },
      { fdi: 28, name: 'Tercer molar superior izquierdo' },
    ],
  },
  {
    key: 'cuadrante_4' as const,
    id: 4,
    desc: 'Mandíbula Inferior Derecha',
    isUpper: false,
    isTemp: false,
    teeth: [
      { fdi: 48, name: 'Tercer molar inferior derecho' },
      { fdi: 47, name: 'Segundo molar inferior derecho' },
      { fdi: 46, name: 'Primer molar inferior derecho' },
      { fdi: 45, name: 'Segundo premolar inferior derecho' },
      { fdi: 44, name: 'Primer premolar inferior derecho' },
      { fdi: 43, name: 'Canino inferior derecho' },
      { fdi: 42, name: 'Incisivo lateral inferior derecho' },
      { fdi: 41, name: 'Incisivo central inferior derecho' },
    ],
  },
  {
    key: 'cuadrante_3' as const,
    id: 3,
    desc: 'Mandíbula Inferior Izquierda',
    isUpper: false,
    isTemp: false,
    teeth: [
      { fdi: 31, name: 'Incisivo central inferior izquierdo' },
      { fdi: 32, name: 'Incisivo lateral inferior izquierdo' },
      { fdi: 33, name: 'Canino inferior izquierdo' },
      { fdi: 34, name: 'Primer premolar inferior izquierdo' },
      { fdi: 35, name: 'Segundo premolar inferior izquierdo' },
      { fdi: 36, name: 'Primer molar inferior izquierdo' },
      { fdi: 37, name: 'Segundo molar inferior izquierdo' },
      { fdi: 38, name: 'Tercer molar inferior izquierdo' },
    ],
  },
  // Temporales (menores de 18 años)
  {
    key: 'cuadrante_5' as const,
    id: 5,
    desc: 'Maxilar Superior Derecho Temporal',
    isUpper: true,
    isTemp: true,
    teeth: [
      { fdi: 55, name: 'Segundo molar temporal superior derecho' },
      { fdi: 54, name: 'Primer molar temporal superior derecho' },
      { fdi: 53, name: 'Canino temporal superior derecho' },
      { fdi: 52, name: 'Incisivo lateral temporal superior derecho' },
      { fdi: 51, name: 'Incisivo central temporal superior derecho' },
    ],
  },
  {
    key: 'cuadrante_6' as const,
    id: 6,
    desc: 'Maxilar Superior Izquierdo Temporal',
    isUpper: true,
    isTemp: true,
    teeth: [
      { fdi: 61, name: 'Incisivo central temporal superior izquierdo' },
      { fdi: 62, name: 'Incisivo lateral temporal superior izquierdo' },
      { fdi: 63, name: 'Canino temporal superior izquierdo' },
      { fdi: 64, name: 'Primer molar temporal superior izquierdo' },
      { fdi: 65, name: 'Segundo molar temporal superior izquierdo' },
    ],
  },
  {
    key: 'cuadrante_8' as const,
    id: 8,
    desc: 'Mandíbula Inferior Derecha Temporal',
    isUpper: false,
    isTemp: true,
    teeth: [
      { fdi: 85, name: 'Segundo molar temporal inferior derecho' },
      { fdi: 84, name: 'Primer molar temporal inferior derecho' },
      { fdi: 83, name: 'Canino temporal inferior derecho' },
      { fdi: 82, name: 'Incisivo lateral temporal inferior derecho' },
      { fdi: 81, name: 'Incisivo central temporal inferior derecho' },
    ],
  },
  {
    key: 'cuadrante_7' as const,
    id: 7,
    desc: 'Mandíbula Inferior Izquierda Temporal',
    isUpper: false,
    isTemp: true,
    teeth: [
      { fdi: 71, name: 'Incisivo central temporal inferior izquierdo' },
      { fdi: 72, name: 'Incisivo lateral temporal inferior izquierdo' },
      { fdi: 73, name: 'Canino temporal inferior izquierdo' },
      { fdi: 74, name: 'Primer molar temporal inferior izquierdo' },
      { fdi: 75, name: 'Segundo molar temporal inferior izquierdo' },
    ],
  },
];

/**
 * Capa 3: Factory / Builder de Odontograma inicial en blanco (RF-HCL-007)
 */
export function createInitialOdontograma(isMinor = false): Odontograma {
  const resultCuadrantes: any = {};

  for (const quadDef of QUADRANT_DEFINITIONS) {
    if (quadDef.isTemp && !isMinor) {
      continue;
    }

    const piezas: Record<string, PiezaDental> = {};
    for (const tooth of quadDef.teeth) {
      const caras = quadDef.isUpper
        ? {
            vestibular: { ...BLANK_CARA },
            palatina: { ...BLANK_CARA },
            mesial: { ...BLANK_CARA },
            distal: { ...BLANK_CARA },
            oclusal_incisal: { ...BLANK_CARA },
          }
        : {
            vestibular: { ...BLANK_CARA },
            lingual: { ...BLANK_CARA },
            mesial: { ...BLANK_CARA },
            distal: { ...BLANK_CARA },
            oclusal_incisal: { ...BLANK_CARA },
          };

      piezas[String(tooth.fdi)] = {
        codigo_fdi: tooth.fdi,
        nombre_anatomico: tooth.name,
        caras,
        simbolos_tecnicos: { ...BLANK_SIMBOLOS },
        relacion_puente: null,
        nota_clinica: null,
      };
    }

    resultCuadrantes[quadDef.key] = {
      id_cuadrante: quadDef.id,
      descripcion: quadDef.desc,
      piezas,
    };
  }

  return {
    cuadrantes: resultCuadrantes,
  };
}
