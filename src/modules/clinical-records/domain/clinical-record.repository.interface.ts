import {
  ClinicalEvolutionPayload,
  ClinicalWriteActor,
  CreateEvolutionEntryDTO,
  NotaEvolucionRow,
  OdontogramDataDTO,
} from '../infrastructure/clinical-record.model';

/** Datos de la cita que determinan quién puede escribir en la historia. */
export interface AppointmentClinicalContext {
  idCita: number;
  idPaciente: number;
  idProfesional: number;
  nombreProfesional: string;
  estado: string;
}

export interface EvolutionRecordRow {
  idEvolucion: number;
  idHistoria: number;
  fecha: Date | string;
  idCita: number;
  motivoConsulta: string;
  enfermedadActual?: string | null;
  antecedentesClinicos?: any;
  habitosHigiene?: any;
  examenEstomatognatico?: any;
  examenFisicoObservaciones?: string | null;
  odontograma?: OdontogramDataDTO | null;
  procedimientoRealizado?: string | null;
  diagnosticoGenerado?: string | null;
  accionesARealizar?: string | null;
  hallazgosObservaciones?: string | null;
  planManejo?: any;
  evolucion: ClinicalEvolutionPayload;
  diligenciadoPor?: any;
  estadoCita?: string | null;
  notas?: NotaEvolucionRow[];
  valorAnterior?: any;
  valorNuevo?: any;
}

export interface ClinicalHistoryRow {
  idHistoria: number;
  idPaciente: number;
  fechaAperturaExpediente: Date | string;
  idEvolucion: number | null;
  fechaRegistro: Date | string | null;
  idCita: number | null;
  estadoCita: string | null;
  profesionalResponsable: string | null;
  motivoConsulta?: string | null;
  enfermedadActual?: string | null;
  antecedentesClinicos?: any;
  habitosHigiene?: any;
  examenEstomatognatico?: any;
  examenFisicoObservaciones?: string | null;
  odontograma?: OdontogramDataDTO | null;
  procedimientoRealizado?: string | null;
  diagnosticoGenerado?: string | null;
  accionesARealizar?: string | null;
  hallazgosObservaciones?: string | null;
  planManejo?: any;
  evolucion: ClinicalEvolutionPayload | null;
  notas?: NotaEvolucionRow[];
}

export interface IClinicalRecordRepository {
  createEvolutionEntry(dto: CreateEvolutionEntryDTO): Promise<EvolutionRecordRow>;
  /** RF-HCL-006: solo mientras la cita está En consulta; guarda valor anterior y nuevo. */
  updateEvolutionEntry(
    idEvolucion: number,
    nuevoPayload: ClinicalEvolutionPayload | Partial<EvolutionRecordRow>,
    actor?: ClinicalWriteActor
  ): Promise<EvolutionRecordRow>;
  getClinicalHistoryByPatient(idPaciente: number): Promise<ClinicalHistoryRow[]>;
  findEvolutionByCitaId(idCita: number): Promise<EvolutionRecordRow | null>;
  getAppointmentContext?(idCita: number): Promise<AppointmentClinicalContext | null>;
  addClarificationNote?(idEvolucion: number, texto: string, actor: ClinicalWriteActor): Promise<NotaEvolucionRow>;
  getNoShowsByPatient?(idPaciente: number): Promise<
    Array<{ idCita: number; fechaHora: string; profesionalResponsable: string; observacion?: string }>
  >;
}
