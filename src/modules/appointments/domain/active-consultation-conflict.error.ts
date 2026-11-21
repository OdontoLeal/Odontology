// src/modules/appointments/domain/active-consultation-conflict.error.ts

export interface ActiveConsultationConflictData {
  idCita: number;
  idPaciente: number;
  nombrePaciente: string;
  horaInicio: string;
  horaFin: string;
  minutosTranscurridos?: number;
  tiempoExcedido?: boolean;
}

/**
 * Error de dominio para colisión de citas activas por profesional (RF-AGE-009).
 * Proporciona un payload estructurado para que la UI presente un diálogo de resolución asistida.
 */
export class ActiveConsultationConflictError extends Error {
  public readonly statusCode = 409;
  public readonly code = 'ACTIVE_CONSULTATION_CONFLICT';

  constructor(
    message: string = 'El profesional ya tiene otra cita En consulta.',
    public readonly activeAppointment?: ActiveConsultationConflictData
  ) {
    super(message);
    this.name = 'ActiveConsultationConflictError';
  }
}
