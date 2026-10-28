import {
  BackupContactInfo,
  GuardianInfo,
  PatientSex,
} from '../domain/patient.entity';

export interface PatientRow {
  id_paciente: number;
  nombre_completo: string;
  documento_identidad: string;
  correo: string | null;
  telefono: string | null;
  fecha_nacimiento: string | Date;
  sexo: PatientSex | null;
}

export interface CreatePatientDTO {
  nombreCompleto: string;
  documentoIdentidad: string;
  correo?: string;
  telefono?: string;
  fechaNacimiento: string; // YYYY-MM-DD
  sexo?: PatientSex | null; // 'Femenino' | 'Masculino' | 'Indeterminado' | null (Datos incompletos)
  contactoRespaldo?: BackupContactInfo | null;
  acudiente?: GuardianInfo | null;
  autorizacionDatos?: {
    autorizado: boolean;
    medio?: 'CONSULTORIO_WEB' | 'SECCION_PUBLICA' | 'TABLET_CONSULTORIO';
    versionAvisoPrivacidad?: string;
    fechaHora?: string;
    idUsuarioRegistro?: number | null;
  };
  creadoDesdeSolicitud?: boolean;
}