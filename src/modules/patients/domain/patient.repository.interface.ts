// src/modules/patients/domain/patient.repository.interface.ts
import { Patient } from './patient.entity';

/** Usuario que ejecuta la operación (se guarda en el registro de auditoría). */
export interface PatientAuditActor {
  idUsuario: number;
  actor: string;
}

export interface CreatedPatientResult {
  patient: ReturnType<Patient['toPrimitives']>;
  historiaClinicaBase: {
    id_historia: number;
    fecha_creacion: Date | string;
  };
}

export interface PatientSearchItem {
  idPaciente: number;
  nombreCompleto: string;
  documentoIdentidad: string;
  correo: string | null;
  telefono: string | null;
  fechaNacimiento: string;
  sexo: string | null;
  datosIncompletos: boolean;
}

export interface PatientAppointmentSummary {
  idCita: number;
  titulo: string;
  fechaHoraInicio?: string | null;
  estado: string;
  profesional: string;
  agendadoPor?: string | null;
}

export interface PatientProfileRecord {
  idPaciente: number;
  nombreCompleto: string;
  documentoIdentidad: string;
  correo: string | null;
  telefono: string | null;
  fechaNacimiento: string;
  edad: number;
  esMenorDeEdad: boolean;
  sexo: string | null;
  datosIncompletos: boolean;
  idHistoria: number | null;
  historialCitas: PatientAppointmentSummary[];
}

/** Prueba de una autorización de tratamiento de datos (RQNF-SEG-005, RQNF-SEG-007). */
export interface HolderAuthorizationRecord {
  tipo: 'CONSENTIMIENTO_FIRMADO' | 'ACEPTACION_SOLICITUD';
  plantilla: string;
  versionPlantilla: number | null;
  fechaHora: string;
  firmadoPorAcudiente?: boolean;
  diligenciadoPor?: string | null;
}

export interface HolderDataRecord {
  documentoConsultado: string;
  calidades: {
    comoPaciente: {
      idPaciente: number;
      nombreCompleto: string;
      documentoIdentidad: string;
      correo: string | null;
      telefono: string | null;
      fechaNacimiento: string;
      sexo: string | null;
    } | null;
    comoSolicitante: Array<{
      idSolicitud: number;
      nombreSolicitante: string;
      documentoSolicitante: string;
      correoSolicitante: string;
      telefonoSolicitante: string | null;
      bloqueSolicitado: string;
      descripcion: string | null;
      estadoSolicitud: string;
    }>;
  };
  autorizaciones: HolderAuthorizationRecord[];
  citasRegistradas: Array<{
    idCita: number;
    titulo: string;
    estado: string;
    profesional: string;
    fechaHora?: string | null;
  }>;
}

export interface IPatientRepository {
  createPatient(patient: Patient, actor?: PatientAuditActor): Promise<CreatedPatientResult>;
  updatePatient(
    idPaciente: number,
    patient: Patient,
    auditMeta?: {
      idUsuarioActor?: number;
      actor?: string;
      valorAnterior?: Record<string, unknown>;
    }
  ): Promise<ReturnType<Patient['toPrimitives']> | null>;
  findById(idPaciente: number): Promise<Patient | null>;
  findByDocument(documentoIdentidad: string): Promise<Patient | null>;
  searchPatients(query?: string): Promise<PatientSearchItem[]>;
  getPatientProfileByIdOrDoc(identifier: {
    idPaciente?: number;
    documento?: string;
  }): Promise<PatientProfileRecord | null>;
  getHolderDataByDocument(documentoIdentidad: string): Promise<HolderDataRecord | null>;
  /** Indica si el paciente tiene una cita En consulta (acceso de ROL-AUX, Regla de Negocio 4). */
  hasActiveConsultation?(idPaciente: number): Promise<boolean>;
}
