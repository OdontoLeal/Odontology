// src/modules/appointments/infrastructure/helpers/appointment-state.validator.ts
import { EstadoCita } from '../appointment.model';

export const ALLOWED_APPOINTMENT_STATES: EstadoCita[] = [
  'Solicitada',
  'Confirmada',
  'En consulta',
  'Atendida',
  'Completada',
  'Cancelada',
  'Inasistencia',
  'No asistió',
  'Rechazada',
];

export function getTodayColombiaDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function validatePastDateBooking(bloques: string[]): void {
  const today = getTodayColombiaDate();
  const now = Date.now();

  for (const bloque of bloques) {
    const blockDate = String(bloque).trim().split('T')[0].split(' ')[0];
    if (blockDate < today) {
      throw new Error(`No se pueden agendar citas para fechas pasadas (${blockDate}).`);
    }
    if (new Date(bloque).getTime() < now) {
      throw new Error(`No se pueden agendar citas en un horario que ya pasó (${bloque}).`);
    }
  }
}

export function validatePublicBookingWindow(bloqueSolicitado: string, autorizacionDatos: boolean): void {
  if (!autorizacionDatos) {
    throw new Error(
      'Debe aceptar la autorización de tratamiento de datos personales (Ley 1581 de 2012) para solicitar la cita.'
    );
  }

  const todayStr = getTodayColombiaDate();
  const reqDateStr = String(bloqueSolicitado).trim().split('T')[0].split(' ')[0];
  const d1 = new Date(`${todayStr}T00:00:00Z`);
  const d2 = new Date(`${reqDateStr}T00:00:00Z`);
  const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 5 || diffDays > 60) {
    throw new Error('Las citas solo se pueden solicitar con una anticipación de entre 5 y 60 días calendario.');
  }

  if (new Date(bloqueSolicitado).getTime() < Date.now()) {
    throw new Error('No se pueden solicitar citas en un horario que ya pasó.');
  }
}

export function validateStateChangeRules(params: {
  citaActual: { estado: string; id_usuario?: number };
  nuevoEstado: EstadoCita;
  motivo?: string;
  idUsuarioGestor?: number;
  isAdmin?: boolean;
}): void {
  const { citaActual, nuevoEstado, motivo, idUsuarioGestor, isAdmin } = params;

  if (!ALLOWED_APPOINTMENT_STATES.includes(nuevoEstado)) {
    const err: any = new Error(`Estado de cita '${nuevoEstado}' no es válido.`);
    err.status = 400;
    throw err;
  }

  if (['Cancelada', 'No asistió', 'Completada', 'Rechazada'].includes(citaActual.estado)) {
    throw new Error(
      `La cita se encuentra en estado final '${citaActual.estado}' y no permite cambios de estado posteriores.`
    );
  }

  if (nuevoEstado === 'No asistió' || nuevoEstado === 'Inasistencia') {
    if (citaActual.estado !== 'Confirmada' && citaActual.estado !== 'En espera') {
      throw new Error(`Solo se puede registrar inasistencia en citas en estado 'Confirmada' o 'En espera'.`);
    }
  }

  if (nuevoEstado === 'Cancelada') {
    if (!motivo || !motivo.trim()) {
      throw new Error('El motivo de cancelación es obligatorio.');
    }
    if (
      citaActual.estado !== 'Confirmada' &&
      citaActual.estado !== 'En espera' &&
      citaActual.estado !== 'Solicitada'
    ) {
      throw new Error(`Solo se pueden cancelar citas en estado 'Confirmada', 'En espera' o 'Solicitada'.`);
    }
  }

  if (nuevoEstado === 'Rechazada') {
    if (!motivo || !motivo.trim()) {
      throw new Error('El motivo de rechazo de la cita es obligatorio.');
    }
  }

  if (nuevoEstado === 'En consulta') {
    if (
      idUsuarioGestor &&
      citaActual.id_usuario &&
      citaActual.id_usuario !== idUsuarioGestor &&
      !isAdmin
    ) {
      const err: any = new Error('Solo el profesional responsable asignado a la cita puede iniciar la atención.');
      err.status = 403;
      throw err;
    }
  }
}
