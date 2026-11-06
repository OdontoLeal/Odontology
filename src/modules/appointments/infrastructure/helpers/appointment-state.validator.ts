// src/modules/appointments/infrastructure/helpers/appointment-state.validator.ts
import { AppointmentEntity } from '../../domain/appointment.entity';
import { EstadoCita } from '../appointment.model';
import { ForbiddenError } from '../../../../shared/infrastructure/security/access-control';

/** Únicos estados válidos de la ERS (sección 1.3). La BD los exige con chk_cita_estado. */
export const ALLOWED_APPOINTMENT_STATES: ReadonlyArray<EstadoCita> = AppointmentEntity.VALID_STATES;

export class AppointmentRuleError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppointmentRuleError';
  }
}

export function getTodayColombiaDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** "YYYY-MM-DD HH:MM:SS" en hora de Colombia (formato de `bloques_horario.inicio`). */
export function getNowColombiaTimestamp(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}:${get('second')}`;
}

const normalizeBlock = (bloque: string): string => String(bloque).trim().replace('T', ' ').slice(0, 19);

export function validatePastDateBooking(bloques: string[], now: Date = new Date()): void {
  const nowStr = getNowColombiaTimestamp(now);
  for (const bloque of bloques) {
    const b = normalizeBlock(bloque);
    if (b.slice(0, 10) < nowStr.slice(0, 10)) {
      throw new AppointmentRuleError(`No se pueden agendar citas para fechas pasadas (${b.slice(0, 10)}).`);
    }
    if (b < nowStr) {
      throw new AppointmentRuleError(`No se pueden agendar citas en un horario que ya pasó (${b}).`);
    }
  }
}

/** Regla de Negocio 2: solicitudes públicas solo entre 5 y 60 días calendario. */
export function validatePublicBookingWindow(bloqueSolicitado: string, now: Date = new Date()): void {
  const todayStr = getTodayColombiaDate(now);
  const reqDateStr = normalizeBlock(bloqueSolicitado).slice(0, 10);
  const d1 = new Date(`${todayStr}T00:00:00Z`);
  const d2 = new Date(`${reqDateStr}T00:00:00Z`);
  const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));

  if (Number.isNaN(diffDays) || diffDays < 5 || diffDays > 60) {
    throw new AppointmentRuleError(
      'Las citas solo se pueden solicitar con una anticipación de entre 5 y 60 días calendario.'
    );
  }
}

/** Actor que pide el cambio de estado (siempre el usuario de la sesión). */
export interface StateChangeActor {
  idUsuario: number;
  roles: string[];
  permisos: string[];
}

export interface StateChangeContext {
  citaActual: { estado: string; id_usuario: number };
  nuevoEstado: string;
  motivo?: string | null;
  actor: StateChangeActor;
  /** Inicio del primer bloque de la cita ("YYYY-MM-DD HH:MM:SS", hora Colombia). */
  inicioCita: string | null;
  now?: Date;
}

/**
 * Transiciones permitidas por la ERS v1.3 y quién puede hacerlas:
 *  - Confirmada → En consulta  (RF-AGE-009): profesional responsable, cita del día.
 *  - En consulta → Atendida     (RF-AGE-009): profesional responsable.
 *  - Confirmada → Cancelada     (RF-AGE-007): con motivo.
 *  - Confirmada → Inasistencia  (RF-AGE-012): desde la hora de inicio hasta las 23:59 de ese día;
 *    a un profesional solo en sus propias citas.
 * Rechazada se decide al gestionar la solicitud (RF-AGE-005) y los cambios
 * automáticos los hace el Sistema (RF-AGE-010).
 */
export function validateStateChangeRules(ctx: StateChangeContext): void {
  const { citaActual, nuevoEstado, motivo, actor } = ctx;
  const now = ctx.now ?? new Date();

  if (!ALLOWED_APPOINTMENT_STATES.includes(nuevoEstado as EstadoCita)) {
    throw new AppointmentRuleError(
      `El estado '${nuevoEstado}' no es válido. Estados permitidos: ${ALLOWED_APPOINTMENT_STATES.join(', ')}.`
    );
  }

  if (AppointmentEntity.FINAL_STATES.includes(citaActual.estado as EstadoCita)) {
    throw new AppointmentRuleError(
      `La cita está en estado final '${citaActual.estado}' y no admite cambios.`,
      409
    );
  }

  const isAdmin = actor.roles.includes('ROL-ADM');
  const isResponsible = citaActual.id_usuario === actor.idUsuario || isAdmin;
  const can = (perm: string) => actor.permisos.includes(perm);
  const today = getTodayColombiaDate(now);
  const inicioDia = ctx.inicioCita?.slice(0, 10) ?? null;

  switch (nuevoEstado) {
    case 'En consulta': {
      if (!can('RF-AGE-009') || !isResponsible) throw new ForbiddenError();
      if (citaActual.estado !== 'Confirmada') {
        throw new AppointmentRuleError('Solo se puede iniciar la atención de una cita Confirmada.', 409);
      }
      // =========================================================================
      // [DESHABILITADO TEMPORALMENTE]: Restricción de atender solo citas del mismo día.
      // Detalle y reversión documentados en: /TEMPORAL_ATENDER_CITA_CUALQUIER_DIA.md
      // =========================================================================
      /*
      if (inicioDia !== today && !isAdmin) {
        throw new AppointmentRuleError('Solo se puede iniciar la atención de una cita del día.', 409);
      }
      */
      return;
    }
    case 'Atendida': {
      if (!can('RF-AGE-009') || !isResponsible) throw new ForbiddenError();
      if (citaActual.estado !== 'En consulta') {
        throw new AppointmentRuleError('Solo se puede finalizar una cita que está En consulta.', 409);
      }
      return; // El motivo de consulta guardado se verifica en el repositorio.
    }
    case 'Cancelada': {
      if (!can('RF-AGE-007')) throw new ForbiddenError();
      if (citaActual.estado !== 'Confirmada') {
        throw new AppointmentRuleError('Solo se pueden cancelar citas en estado Confirmada.', 409);
      }
      if (!motivo || !String(motivo).trim()) {
        throw new AppointmentRuleError('El motivo de cancelación es obligatorio.');
      }
      return;
    }
    case 'Inasistencia': {
      if (!can('RF-AGE-012')) throw new ForbiddenError();
      const isAgendaStaff = actor.roles.some((r) => ['ROL-COA', 'ROL-AUX', 'ROL-ADM'].includes(r));
      if (!isAgendaStaff && !isResponsible) throw new ForbiddenError();
      if (citaActual.estado !== 'Confirmada') {
        throw new AppointmentRuleError(
          `La cita ya cambió de estado (${citaActual.estado}) y no puede marcarse como inasistencia.`,
          409
        );
      }
      const nowStr = getNowColombiaTimestamp(now);
      if (!ctx.inicioCita || nowStr < ctx.inicioCita || inicioDia !== today) {
        throw new AppointmentRuleError(
          'Solo se puede marcar la inasistencia desde la hora de inicio de la cita hasta las 11:59 p. m. de ese día.',
          409
        );
      }
      return;
    }
    default:
      throw new AppointmentRuleError(
        `El cambio a '${nuevoEstado}' no se hace desde la agenda (lo gestionan la solicitud o el Sistema).`,
        409
      );
  }
}
