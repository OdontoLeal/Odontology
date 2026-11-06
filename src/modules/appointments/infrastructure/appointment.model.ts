import type { AppointmentState } from '../domain/appointment.entity';

/** Estados válidos de la ERS v1.3 (sin los nombres antiguos "Completada" ni "No asistió"). */
export type EstadoCita = AppointmentState;

export interface TimeSlotRow {
  inicio: string;
  final: string;
  estado: boolean;
  ocupacion: boolean;
  id_profesional?: number;
}

export interface MonthlyDaySummary {
  fecha: string;
  dia: number;
  totalCitas: number;
  totalSolicitadas?: number;
  totalBloques: number;
  sinBloques: boolean;
}

export interface CreateSolicitudCitaDTO {
  nombreSolicitante: string;
  documentoSolicitante: string;
  correoSolicitante: string;
  telefonoSolicitante?: string;
  fechaNacimiento?: string;
  sexo?: string;
  bloqueSolicitado: string;
  descripcion?: string;
  /** Casilla de aceptación de la plantilla vigente de autorización (RQNF-SEG-005). */
  autorizacionDatos?: boolean;
  /** Versión de la plantilla que vio el solicitante (si la envía la página pública). */
  versionPlantillaAutorizacion?: number;
}

export interface CreateCitaDTO {
  titulo: string;
  descripcion?: string;
  idPaciente: number;
  idUsuarioProfesional: number;
  idUsuarioGestor: number;
  /** Correo del usuario que agenda (registro de auditoría). */
  actorGestor?: string;
  bloques: string[];
}
