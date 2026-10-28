// src/modules/clinical-records/infrastructure/clinical-record.model.ts

export interface OdontogramFindingDTO {
  piezaFDI: number; // Ej: 11 a 48 (permanentes) o 51 a 85 (temporales)
  superficie: 'vestibular' | 'palatina' | 'lingual' | 'mesial' | 'distal' | 'oclusal_incisal';
  hallazgo: string;
  color: string;
}

export interface OdontogramSurfaceFlagsDTO {
  caries_activa: boolean;
  restauracion_resina: boolean;
  sellante_fosas: boolean;
  desgaste_faceta: boolean;
}

export interface UpperToothSurfacesDTO {
  vestibular: OdontogramSurfaceFlagsDTO;
  palatina: OdontogramSurfaceFlagsDTO;
  mesial: OdontogramSurfaceFlagsDTO;
  distal: OdontogramSurfaceFlagsDTO;
  oclusal_incisal: OdontogramSurfaceFlagsDTO;
}

export interface LowerToothSurfacesDTO {
  vestibular: OdontogramSurfaceFlagsDTO;
  lingual: OdontogramSurfaceFlagsDTO;
  mesial: OdontogramSurfaceFlagsDTO;
  distal: OdontogramSurfaceFlagsDTO;
  oclusal_incisal: OdontogramSurfaceFlagsDTO;
}

export type ToothSurfacesDTO = UpperToothSurfacesDTO | LowerToothSurfacesDTO;

export interface OdontogramTechnicalSymbolsDTO {
  diente_extraido: boolean;
  extraccion_requerida: boolean;
  corona: boolean;
  implante: boolean;
  protesis_fija: boolean;
  endodoncia: boolean;
  puente: boolean;
}

export interface OdontogramBridgeRelationDTO {
  piezas_conectadas: number[];
  rol_estimado: 'pilar_distal' | 'pontico_intermedio' | 'pilar_mesial' | string;
}

export interface OdontogramClinicalNoteDTO {
  zona_afectada: string;
  descripcion: string;
}

export interface OdontogramToothDTO {
  codigo_fdi: number;
  nombre_anatomico: string;
  caras: ToothSurfacesDTO;
  simbolos_tecnicos: OdontogramTechnicalSymbolsDTO;
  relacion_puente?: OdontogramBridgeRelationDTO;
  nota_clinica: OdontogramClinicalNoteDTO | null;
}

export interface OdontogramQuadrantDTO {
  id_cuadrante: number;
  descripcion: string;
  piezas: Record<string, OdontogramToothDTO>;
}

export type QuadrantKey =
  | 'cuadrante_1'
  | 'cuadrante_2'
  | 'cuadrante_3'
  | 'cuadrante_4'
  | 'cuadrante_5'
  | 'cuadrante_6'
  | 'cuadrante_7'
  | 'cuadrante_8';

export interface OdontogramDataDTO {
  cuadrantes: Partial<Record<QuadrantKey, OdontogramQuadrantDTO>> & {
    cuadrante_1: OdontogramQuadrantDTO;
    cuadrante_2: OdontogramQuadrantDTO;
    cuadrante_4: OdontogramQuadrantDTO;
    cuadrante_3: OdontogramQuadrantDTO;
  };
}

export interface AntecedenteItemDTO {
  presenta: boolean;
  observaciones: string;
}

export interface AntecedentesClinicosDTO {
  accidentes_traumas: AntecedenteItemDTO;
  cirugias: AntecedenteItemDTO;
  patologicos: AntecedenteItemDTO;
  farmacologicos: AntecedenteItemDTO;
  inmunologicos: AntecedenteItemDTO;
  familiares: AntecedenteItemDTO;
  otros_habitos_practicas: AntecedenteItemDTO;
}

export interface HabitoHigieneItemDTO {
  aplica: boolean;
  frecuencia_cantidad: string;
  observaciones: string;
}

export interface HabitosHigieneDTO {
  bebe_alcohol: HabitoHigieneItemDTO;
  fuma_tabaco_vapeo: HabitoHigieneItemDTO;
  mastica_chicle_golosinas: HabitoHigieneItemDTO;
  cepillado_dental: HabitoHigieneItemDTO;
  uso_seda_dental: HabitoHigieneItemDTO;
  chequeos_odontologicos_periodicos: HabitoHigieneItemDTO;
}

export interface EstomatognaticoItemDTO {
  presenta_anormalidades: boolean;
  observaciones: string;
}

export interface ExamenEstomatognaticoDTO {
  labios: EstomatognaticoItemDTO;
  lengua: EstomatognaticoItemDTO;
  carrillos_mucosa_yugal: EstomatognaticoItemDTO;
  amigdalas: EstomatognaticoItemDTO;
  paladar_duro: EstomatognaticoItemDTO;
  frenillos: EstomatognaticoItemDTO;
  mucosa_masticadora: EstomatognaticoItemDTO;
  encia: EstomatognaticoItemDTO;
}

export interface PrescripcionItemDTO {
  medicamento_principio_activo: string;
  dosis_concentracion: string;
  frecuencia_via: string;
  duracion_tratamiento: string;
}

export interface IncapacidadMedicaDTO {
  requiere_incapacidad: boolean;
  fecha_inicio: string;
  fecha_culminacion: string;
  diagnostico_justificacion: string;
}

export interface RemisionMedicaDTO {
  requiere_remision: boolean;
  especialidad_destino: string;
  prioridad_atencion: string;
  motivo_resumen_clinico: string;
}

export interface PlanManejoDTO {
  conducta?: string;
  prescripcion_farmacologica: PrescripcionItemDTO[];
  incapacidad_medica: IncapacidadMedicaDTO;
  remision_medica: RemisionMedicaDTO;
  documentos?: any[];
}

export const DEFAULT_ANTECEDENTES_CLINICOS: AntecedentesClinicosDTO = {
  accidentes_traumas: { presenta: false, observaciones: 'N/A - Niega traumas faciales o dentales previos' },
  cirugias: { presenta: false, observaciones: 'N/A - Niega cirugías previas' },
  patologicos: { presenta: false, observaciones: 'N/A - Niega enfermedades crónicas o sistémicas' },
  farmacologicos: { presenta: false, observaciones: 'N/A - Niega medicamentos o alergias conocidas' },
  inmunologicos: { presenta: false, observaciones: 'N/A - Tolerancia comprobada a látex y resinas' },
  familiares: { presenta: false, observaciones: 'N/A - Niega antecedentes familiares de relevancia' },
  otros_habitos_practicas: { presenta: false, observaciones: 'Sin registro de hábitos orales parafuncionales o perjudiciales reportados' },
};

export const DEFAULT_HABITOS_HIGIENE: HabitosHigieneDTO = {
  bebe_alcohol: { aplica: false, frecuencia_cantidad: 'No consume', observaciones: 'No refiere consumo habitual de bebidas alcohólicas' },
  fuma_tabaco_vapeo: { aplica: false, frecuencia_cantidad: 'No fuma', observaciones: 'No refiere tabaquismo ni cigarrillo electrónico' },
  mastica_chicle_golosinas: { aplica: false, frecuencia_cantidad: 'Ocasional', observaciones: 'Consumo ocasional' },
  cepillado_dental: { aplica: true, frecuencia_cantidad: '3 veces o más al día', observaciones: 'Cepillo cerdas suaves manual. Técnica correcta' },
  uso_seda_dental: { aplica: true, frecuencia_cantidad: '1 vez al día (nocturno)', observaciones: 'Seda encerada en la noche sin sangrado habitual' },
  chequeos_odontologicos_periodicos: { aplica: true, frecuencia_cantidad: 'Cada 6 meses', observaciones: 'Asiste a controles semestrales periódicos' },
};

export const DEFAULT_EXAMEN_ESTOMATOGNATICO: ExamenEstomatognaticoDTO = {
  labios: { presenta_anormalidades: false, observaciones: 'N/A - Hidratados, normocoloreados y sin lesiones ni queilitis comisural.' },
  lengua: { presenta_anormalidades: false, observaciones: 'N/A - Lengua normoglosa, papilas íntegras, movilidad conservada sin alteraciones.' },
  carrillos_mucosa_yugal: { presenta_anormalidades: false, observaciones: 'N/A - Mucosa yugal rosada, húmeda y flexible, sin mordeduras ni queratosis.' },
  amigdalas: { presenta_anormalidades: false, observaciones: 'N/A - Grado I simétricas, sin exudado, hiperemia ni compromiso infeccioso.' },
  paladar_duro: { presenta_anormalidades: false, observaciones: 'N/A - Bóveda palatina normal, mucosa queratinizada sana, sin torus ni fisuras.' },
  frenillos: { presenta_anormalidades: false, observaciones: 'N/A - Inserciones normoposicionadas sin tracción gingival ni limitación lingual.' },
  mucosa_masticadora: { presenta_anormalidades: false, observaciones: 'N/A - Rebordes íntegros, espesor de queratinización adecuado sin zonas dolorosas.' },
  encia: { presenta_anormalidades: false, observaciones: 'N/A - Encía rosa coral, consistencia firme, textura en cáscara de naranja, sin sangrado espontáneo.' },
};

export const DEFAULT_PLAN_MANEJO: PlanManejoDTO = {
  conducta: '',
  prescripcion_farmacologica: [],
  incapacidad_medica: {
    requiere_incapacidad: false,
    fecha_inicio: '',
    fecha_culminacion: '',
    diagnostico_justificacion: '',
  },
  remision_medica: {
    requiere_remision: false,
    especialidad_destino: '',
    prioridad_atencion: 'Ordinaria / Consulta Externa',
    motivo_resumen_clinico: '',
  },
  documentos: [],
};

export interface ClinicalEvolutionPayload {
  tipoRegistro:
    | 'APERTURA_CONSULTA'
    | 'EVOLUCION_ODONTOGRAMA'
    | 'NOTA_ACLARATORIA'
    | 'DOCUMENTO_CLINICO';
  motivoConsulta?: string;
  enfermedadActual?: string;
  antecedentes?: Record<string, { aplica: boolean; observacion?: string }>;
  antecedentesClinicos?: AntecedentesClinicosDTO | any;
  habitosHigiene?: HabitosHigieneDTO | any;
  examenEstomatognatico?: ExamenEstomatognaticoDTO | any;
  examenFisicoObservaciones?: string;
  procedimientoRealizado?: string;
  notaEvolucion?: string;
  diagnostico?: string;
  diagnosticoGenerado?: string;
  accionesARealizar?: string;
  observaciones?: string;
  hallazgosObservaciones?: string;
  planManejo?: PlanManejoDTO | any;
  odontograma?: OdontogramDataDTO;
  diligenciadoPor: {
    idUsuario: number;
    nombreUsuario: string;
    idProfesionalResponsable: number;
    fechaHoraISO: string;
  };
}

export interface CreateEvolutionEntryDTO {
  idPaciente: number;
  idCita: number;
  motivoConsulta?: string;
  enfermedadActual?: string;
  antecedentesClinicos?: AntecedentesClinicosDTO | any;
  habitosHigiene?: HabitosHigieneDTO | any;
  examenEstomatognatico?: ExamenEstomatognaticoDTO | any;
  examenFisicoObservaciones?: string;
  odontograma?: OdontogramDataDTO;
  procedimientoRealizado?: string;
  diagnosticoGenerado?: string;
  accionesARealizar?: string;
  hallazgosObservaciones?: string;
  planManejo?: PlanManejoDTO | any;
  fecha?: Date | string;
  payload?: ClinicalEvolutionPayload;
}
