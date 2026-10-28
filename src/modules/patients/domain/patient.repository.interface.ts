import { Patient } from './patient.entity';

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
  sexo: string | null;
  datosIncompletos: boolean;
  idHistoria: number | null;
  acudiente?: {
    nombreCompleto: string;
    documentoIdentidad: string;
    parentesco: string;
    telefono: string;
  } | null;
  contactoRespaldo?: {
    nombreCompleto: string;
    telefono: string;
    parentesco?: string;
  } | null;
  autorizacionDatos?: {
    autorizado: boolean;
    fechaHora: string;
    medio: string;
    versionAvisoPrivacidad: string;
    idUsuarioRegistro?: number | null;
    firmadoPorAcudiente?: boolean;
  } | null;
  historialCitas: PatientAppointmentSummary[];
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
      contactoRespaldo?: {
        nombreCompleto: string;
        telefono: string;
        parentesco?: string;
      } | null;
    } | null;
    comoAcudiente: Array<{
      nombreAcudiente: string;
      documentoAcudiente: string;
      telefonoAcudiente: string;
      nombreMenorRepresentado: string;
      parentescoConMenor: string;
    }>;
    comoSolicitante: Array<{
      idSolicitud: number;
      nombreSolicitante: string;
      documentoSolicitante: string;
      correoSolicitante: string;
      bloqueSolicitado: string;
      descripcion: string | null;
      estadoSolicitud: string;
    }>;
  };
  autorizaciones: Array<{
    fechaHora: string;
    medio: string;
    versionAvisoPrivacidad: string;
    calidad: 'PACIENTE' | 'ACUDIENTE' | 'SOLICITANTE';
  }>;
  citasRegistradas: Array<{
    idCita: number;
    titulo: string;
    estado: string;
    profesional: string;
    fechaHora?: string | null;
  }>;
}

export interface IPatientRepository {
  createPatient(patient: Patient): Promise<CreatedPatientResult>;
  updatePatient(
    idPaciente: number,
    patient: Patient,
    auditMeta?: {
      idUsuarioActor?: number;
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
  getHolderDataByDocument(
    documentoIdentidad: string
  ): Promise<HolderDataRecord | null>;
}