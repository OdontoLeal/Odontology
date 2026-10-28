// src/modules/appointments/domain/appointment.repository.interface.ts
import {
  AppointmentEntity,
  AppointmentHistoryChange,
  AppointmentState,
  DentalServiceType,
  ReminderDeliveryState,
} from './appointment.entity';
import { AppointmentRequestEntity } from './appointment-request.entity';
import { TimeSlotEntity } from './time-slot.entity';

export interface TimeSlotDTO {
  inicio: Date;
  final: Date;
  estado: boolean;
  ocupacion: boolean;
  idProfesional?: number;
  etiquetaEstado?: 'Disponible' | 'Ocupado' | 'Deshabilitado';
}

export interface AgendaAppointmentItemDTO {
  idCita: number;
  titulo: string;
  descripcion: string | null;
  estado: AppointmentState;
  idPaciente: number;
  nombrePaciente: string;
  telefonoPaciente: string | null;
  correoPaciente?: string | null;
  servicio: DentalServiceType;
  idProfesional: number;
  nombreProfesional: string;
  bloques: Date[];
  agendadoPorId: number | null;
  agendadoPor: string;
  estadoRecordatorio: ReminderDeliveryState;
  causaFalloRecordatorio?: string | null;
  historialCambios: AppointmentHistoryChange[];
}

export interface AgendaSlotDTO {
  inicio: Date;
  final: Date;
  inicioFormateado: string;
  finalFormateado: string;
  estado: boolean;
  ocupacion: boolean;
  colorEstado: 'verde' | 'rojo' | 'gris';
  etiquetaEstado: 'Disponible' | 'Ocupado' | 'Deshabilitado';
  cita?: AgendaAppointmentItemDTO;
}

export interface DayAgendaDTO {
  fecha: string; // YYYY-MM-DD
  fechaFormateada: string; // DD/MM/AAAA
  nombreDia: string; // Lunes, Martes, etc.
  citasSolicitadasCount: number; // Indicador de solicitudes por día (RF-AGE-008)
  bloques: AgendaSlotDTO[];
}

export interface WeeklyAgendaDTO {
  semanaInicio: string; // DD/MM/AAAA
  semanaFin: string; // DD/MM/AAAA
  idProfesional?: number;
  nombreProfesional?: string;
  servicio?: DentalServiceType;
  dias: DayAgendaDTO[];
  totalCitasSemana: number;
}

export interface PatientSummaryDTO {
  idPaciente: number;
  nombreCompleto: string;
  documentoIdentidad: string;
  correo: string | null;
  telefono: string | null;
  fechaNacimiento: Date;
  sexo: string | null;
  datosIncompletos?: boolean;
  acudienteNombre?: string | null;
  acudienteDocumento?: string | null;
  acudienteTelefono?: string | null;
  acudienteParentesco?: string | null;
}

export interface ProfessionalStaffDTO {
  idUsuario: number;
  nombreCompleto: string;
  documentoIdentidad: string;
  correo: string;
  telefono: string | null;
  estado: boolean;
  roles: string[];
}

export interface AppointmentDTO {
  idCita: number;
  titulo: string;
  descripcion: string | null;
  idPaciente: number;
  nombrePaciente?: string;
  documentoPaciente?: string;
  telefonoPaciente?: string | null;
  correoPaciente?: string | null;
  idProfesional: number;
  nombreProfesional?: string;
  servicio: DentalServiceType;
  estado: AppointmentState;
  bloques: Date[];
  horaInicio: Date;
  horaFinal: Date;
  agendadoPorId: number | null;
  agendadoPorNombre: string;
  estadoRecordatorio: ReminderDeliveryState;
  causaFalloRecordatorio: string | null;
  historialCambios: AppointmentHistoryChange[];
}

export interface AppointmentRequestDTO {
  idSolicitud: number;
  nombreSolicitante: string;
  documentoSolicitante: string;
  correoSolicitante: string;
  telefonoSolicitante?: string;
  fechaNacimiento?: Date;
  servicio: DentalServiceType;
  idProfesional?: number;
  bloquesSolicitados: Date[];
  descripcion: string | null;
  autorizacionDatosAceptada: boolean;
  versionAvisoPrivacidad: string;
  fechaSolicitud: Date;
  estado: boolean;
}

/**
 * Puerto de persistencia para el módulo de agendamiento (DIP / Clean Architecture).
 */
export interface IAppointmentRepository {
  // Gestión de Bloques de Horario (RF-AGE-001)
  upsertTimeSlots(slots: TimeSlotEntity[]): Promise<void>;
  getTimeSlots(params: {
    idProfesional?: number;
    desde?: Date;
    hasta?: Date;
  }): Promise<TimeSlotEntity[]>;
  findSlotsByDates(dates: Date[]): Promise<TimeSlotEntity[]>;
  releaseSlots(bloques: Date[], keepEnabled?: boolean): Promise<void>;
  occupySlots(bloques: Date[]): Promise<void>;

  // Solicitudes públicas (RF-AGE-003, RF-AGE-004, RF-AGE-005)
  createPublicRequest(request: AppointmentRequestEntity): Promise<AppointmentRequestEntity>;
  findRequestById(idSolicitud: number): Promise<AppointmentRequestEntity | null>;
  findPendingRequestsByDocumentAndService(
    documento: string,
    servicio: DentalServiceType
  ): Promise<AppointmentRequestEntity[]>;
  findPendingRequests(targetDateLessThanDays?: number): Promise<AppointmentRequestEntity[]>;
  updateRequestStatus(idSolicitud: number, estado: boolean): Promise<void>;
  recordRequestHistory(entry: {
    idSolicitud: number;
    idUsuarioGestor: number;
    reporte: string;
    motivo?: string | null;
  }): Promise<void>;

  // Citas (RF-AGE-002, RF-AGE-005, RF-AGE-006, RF-AGE-007, RF-AGE-008, RF-AGE-009, RF-AGE-013)
  scheduleAppointment(appointment: AppointmentEntity): Promise<AppointmentEntity>;
  findAppointmentById(idCita: number): Promise<AppointmentEntity | null>;
  findAppointmentDTOById?(idCita: number): Promise<AppointmentDTO | null>;
  findAppointmentsByProfessionalAndRange(
    idProfesional: number,
    desde: Date,
    hasta: Date
  ): Promise<AppointmentEntity[]>;
  findAllAppointmentsByRange(desde: Date, hasta: Date): Promise<AppointmentEntity[]>;
  findActiveConsultationByProfessional(idProfesional: number): Promise<AppointmentEntity | null>;
  findActiveConsultationByPatient(idPaciente: number): Promise<AppointmentEntity | null>;
  findAppointmentsByPatient(idPaciente: number): Promise<AppointmentDTO[]>;
  countActiveAppointmentsByProfessional(idProfesional: number): Promise<number>;
  updateAppointment(appointment: AppointmentEntity): Promise<AppointmentEntity>;
  recordAppointmentHistory(idCita: number, change: AppointmentHistoryChange): Promise<void>;

  // Pacientes (asociación / creación in-place según RF-AGE-002 y RF-AGE-005)
  findPatientByDocument(documento: string): Promise<PatientSummaryDTO | null>;
  findPatientById(idPaciente: number): Promise<PatientSummaryDTO | null>;
  createPatientInPlace(data: {
    nombreCompleto: string;
    documentoIdentidad: string;
    correo?: string;
    telefono?: string;
    fechaNacimiento: Date;
    sexo?: string;
    datosIncompletos: boolean;
    autorizacionDatos: boolean;
  }): Promise<PatientSummaryDTO>;

  // Profesionales y Personal administrativo (RF-AGE-004, RF-AGE-012)
  findActiveStaffByRoleCodes(roleCodes: string[]): Promise<ProfessionalStaffDTO[]>;
  findUserById(idUsuario: number): Promise<ProfessionalStaffDTO | null>;

  // Soporte para transiciones automáticas y recordatorios (RF-AGE-010, RF-AGE-011)
  findAppointmentsForReminder?(windowStart: Date, windowEnd: Date): Promise<AppointmentEntity[]>;
}

/**
 * Puerto de mensajería electrónica con tolerancia a fallos (RQNF-FIA-004).
 */
export interface IAppointmentMailerPort {
  sendAppointmentConfirmationEmail(params: {
    to: string;
    nombrePaciente: string;
    servicio: DentalServiceType;
    nombreProfesional: string;
    fechaInicio: Date;
    fechaFinal: Date;
  }): Promise<void>;

  sendPublicRequestReceivedEmail(params: {
    to: string;
    nombreSolicitante: string;
    servicio: DentalServiceType;
    fechaInicio: Date;
  }): Promise<void>;

  sendStaffNewRequestNotificationEmail(params: {
    to: string;
    destinatarioNombre: string;
    rolDestinatario: string;
    nombreSolicitante: string;
    telefonoSolicitante?: string;
    servicio: DentalServiceType;
    nombreProfesional: string;
    fechaInicio: Date;
  }): Promise<void>;

  sendDailyPendingRequestsSummaryEmail(params: {
    to: string;
    destinatarioNombre: string;
    solicitudes: Array<{
      idSolicitud: number;
      nombreSolicitante: string;
      telefonoSolicitante?: string;
      servicio: DentalServiceType;
      fechaInicio: Date;
    }>;
  }): Promise<void>;

  sendRequestApprovedEmail(params: {
    to: string;
    nombreSolicitante: string;
    servicio: DentalServiceType;
    nombreProfesional: string;
    fechaInicio: Date;
  }): Promise<void>;

  sendRequestRejectedEmail(params: {
    to: string;
    nombreSolicitante: string;
    servicio: DentalServiceType;
    motivo: string;
  }): Promise<void>;

  sendAppointmentRescheduledEmail(params: {
    to: string;
    nombrePaciente: string;
    servicio: DentalServiceType;
    nombreProfesional: string;
    nuevaFechaInicio: Date;
    nuevaFechaFinal: Date;
  }): Promise<void>;

  sendAppointmentCancelledEmail(params: {
    to: string;
    nombreDestinatario: string;
    esProfesional: boolean;
    servicio: DentalServiceType;
    fechaInicio: Date;
    motivo: string;
  }): Promise<void>;

  sendAppointmentReminderEmail(params: {
    to: string;
    nombrePaciente: string;
    servicio: DentalServiceType;
    nombreProfesional: string;
    fechaInicio: Date;
  }): Promise<void>;
}

/**
 * Puerto inalterable de auditoría (RQNF-SEG-009).
 */
export interface IAppointmentAuditLoggerPort {
  log(entry: {
    usuario: string;
    accion: string;
    registroAfectado: string;
    valorAnterior?: unknown;
    valorNuevo?: unknown;
  }): Promise<void>;
}

/**
 * Puerto de notificación en tiempo real vía WebSocket / SSE (RQNF-DES-002).
 */
export interface IAppointmentRealtimeNotifierPort {
  notifyAgendaChanged(event: {
    type: 'SLOTS_UPDATED' | 'APPOINTMENT_SCHEDULED' | 'REQUEST_CREATED' | 'REQUEST_REVIEWED' | 'APPOINTMENT_UPDATED' | 'APPOINTMENT_CANCELLED' | 'ATTENTION_CHANGED' | 'NO_SHOW_MARKED';
    payload: unknown;
  }): Promise<void>;
}

/**
 * Puerto para comprobar si la historia clínica de la consulta ya tiene registrado
 * el motivo de consulta antes de permitir finalizar la atención (RF-AGE-009 / RF-HCL-005).
 */
export interface IClinicalRecordCheckerPort {
  hasConsultationReasonRegistered(idCita: number): Promise<boolean>;
}
