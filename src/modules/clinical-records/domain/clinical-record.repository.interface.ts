import {
  ClinicalEvolutionPayload,
  CreateEvolutionEntryDTO,
  OdontogramDataDTO,
} from '../infrastructure/clinical-record.model';

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
}

export interface IClinicalRecordRepository {
  createEvolutionEntry(dto: CreateEvolutionEntryDTO): Promise<EvolutionRecordRow>;
  updateEvolutionEntrySameDay(
    idEvolucion: number,
    nuevoPayload: ClinicalEvolutionPayload | Partial<EvolutionRecordRow>
  ): Promise<EvolutionRecordRow>;
  getClinicalHistoryByPatient(idPaciente: number): Promise<ClinicalHistoryRow[]>;
  findEvolutionByCitaId(idCita: number): Promise<EvolutionRecordRow | null>;
}
