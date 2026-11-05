// src/modules/clinical-records/infrastructure/clinical-record.model.ts

import {
  createDefaultAntecedentesClinicos,
  createDefaultHabitosHigiene,
  createDefaultExamenEstomatognatico,
  createDefaultPlanManejo,
  createInitialOdontograma,
} from '../../../schemas';

export {
  createDefaultAntecedentesClinicos,
  createDefaultHabitosHigiene,
  createDefaultExamenEstomatognatico,
  createDefaultPlanManejo,
  createInitialOdontograma,
};

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
  /** Nombre de la especialidad cuando se elige "Otra" (RF-DOC-003). */
  otra_especialidad_nombre?: string | null;
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

export const DEFAULT_ANTECEDENTES_CLINICOS: AntecedentesClinicosDTO =
  createDefaultAntecedentesClinicos();

export const DEFAULT_HABITOS_HIGIENE: HabitosHigieneDTO =
  createDefaultHabitosHigiene();

export const DEFAULT_EXAMEN_ESTOMATOGNATICO: ExamenEstomatognaticoDTO =
  createDefaultExamenEstomatognatico();

export const DEFAULT_PLAN_MANEJO: PlanManejoDTO =
  createDefaultPlanManejo();

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
    firmaBase64?: string | null;
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
  /** Usuario de la sesión que diligencia (Regla de Negocio 9). Obligatorio para escribir. */
  actor?: ClinicalWriteActor;
  /** Nota de evolución a registrar en `nota_evolucion` (RF-HCL-009). */
  nota?: { texto: string; procedimientoRealizado?: string | null };
}

/**
 * Quién escribe en la historia clínica (Regla de Negocio 4):
 * - el profesional responsable de la cita crea y edita la apertura mientras la cita está En consulta;
 * - la auxiliar (con la cita En consulta) solo registra notas y actualiza el odontograma.
 */
export interface ClinicalWriteActor {
  idUsuario: number;
  nombreUsuario: string;
  correo: string;
  esProfesionalResponsable: boolean;
}

/** Nota de evolución o nota aclaratoria con su autor (tabla `nota_evolucion`). */
export interface NotaEvolucionRow {
  idNota: number;
  tipo: 'EVOLUCION' | 'NOTA_ACLARATORIA';
  procedimientoRealizado: string | null;
  texto: string;
  fecha: string;
  diligenciadoPor: { idUsuario: number; nombreUsuario: string };
}
