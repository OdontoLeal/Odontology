// src/modules/appointments/infrastructure/appointment.repository.ts
import { PoolClient } from 'pg';
import { db } from '../../../shared/infrastructure/database/database';
import { auditLog } from '../../../shared/infrastructure/audit/audit-log.service';
import {
  CreateCitaDTO,
  CreateSolicitudCitaDTO,
  EstadoCita,
  MonthlyDaySummary,
  TimeSlotRow,
} from './appointment.model';
import {
  AppointmentRuleError,
  StateChangeActor,
  getNowColombiaTimestamp,
  getTodayColombiaDate,
  validatePastDateBooking,
  validatePublicBookingWindow,
  validateStateChangeRules,
} from './helpers/appointment-state.validator';
import {
  blockEnd,
  computeTimeRangeFromBlocks,
  generateStandardDayIntervals,
  normalizeBlock,
} from './helpers/appointment-query.helpers';

/** Usuario de la sesión que gestiona la agenda (historial y auditoría). */
export interface AgendaActor extends StateChangeActor {
  correo: string;
}

/**
 * Persistencia de la agenda (Módulo B). ERS v1.3: hay una sola agenda para el
 * consultorio (los bloques no se separan por profesional); cada cita tiene su
 * profesional responsable.
 */
export class AppointmentRepository {
  // ------------------------------------------------------------------
  // RF-AGE-001: bloques de horario
  // ------------------------------------------------------------------
  private assertBlockNotStarted(inicio: string): void {
    if (normalizeBlock(inicio) <= getNowColombiaTimestamp()) {
      throw new AppointmentRuleError(`No se puede modificar el bloque ${normalizeBlock(inicio)} porque ya empezó.`);
    }
  }

  async upsertTimeSlot(inicio: string, final: string | undefined, estado = true): Promise<TimeSlotRow> {
    const start = normalizeBlock(inicio);
    this.assertBlockNotStarted(start);
    const { rows } = await db.query<TimeSlotRow>(
      `INSERT INTO public.bloques_horario (inicio, final, estado, ocupacion)
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (inicio) DO UPDATE SET estado = EXCLUDED.estado
       WHERE public.bloques_horario.ocupacion = FALSE
       RETURNING inicio, final, estado, ocupacion;`,
      [start, final ? normalizeBlock(final) : blockEnd(start), estado]
    );
    if (rows.length === 0) {
      throw new AppointmentRuleError('No se puede modificar un bloque que tiene una cita.', 409);
    }
    return rows[0];
  }

  async getTimeSlots(desde?: string, hasta?: string): Promise<TimeSlotRow[]> {
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (desde) {
      params.push(desde);
      conditions.push(`inicio >= $${params.length}`);
    }
    if (hasta) {
      params.push(hasta);
      conditions.push(`final <= $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query<TimeSlotRow>(
      `SELECT inicio, final, estado, ocupacion FROM public.bloques_horario ${where} ORDER BY inicio ASC;`,
      params
    );
    return rows;
  }

  // Bloques estándar de 30 min de 6:00 a. m. a 8:00 p. m. (RF-AGE-001)
  async generateDaySlots(fecha: string): Promise<{ totalGenerados: number; fecha: string }> {
    const cleanFecha = fecha.trim().split('T')[0].split(' ')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanFecha)) {
      throw new AppointmentRuleError('La fecha debe tener formato YYYY-MM-DD.');
    }
    if (cleanFecha < getTodayColombiaDate()) {
      throw new AppointmentRuleError(`No se pueden generar bloques de horario para fechas pasadas (${cleanFecha}).`);
    }

    const nowStr = getNowColombiaTimestamp();
    const slots = generateStandardDayIntervals(cleanFecha).filter((s) => s.inicio > nowStr);
    for (const s of slots) {
      await db.query(
        `INSERT INTO public.bloques_horario (inicio, final, estado, ocupacion)
         VALUES ($1, $2, TRUE, FALSE)
         ON CONFLICT (inicio) DO NOTHING;`,
        [s.inicio, s.final]
      );
    }
    return { totalGenerados: slots.length, fecha: cleanFecha };
  }

  // Calendario público: solo fecha, hora y disponibilidad (RQNF-SEG-008)
  async getAvailableSlots(fecha: string): Promise<TimeSlotRow[]> {
    const cleanFecha = fecha.trim().split('T')[0].split(' ')[0];
    const { rows } = await db.query<TimeSlotRow>(
      `SELECT inicio, final, estado, ocupacion
         FROM public.bloques_horario
        WHERE inicio >= $1::timestamp AND inicio <= $2::timestamp
          AND inicio > $3::timestamp
          AND estado = true AND ocupacion = false
        ORDER BY inicio ASC;`,
      [`${cleanFecha} 00:00:00`, `${cleanFecha} 23:59:59`, getNowColombiaTimestamp()]
    );
    return rows;
  }

  async toggleSlotStatus(inicio: string): Promise<TimeSlotRow> {
    const cleanInicio = normalizeBlock(inicio);
    this.assertBlockNotStarted(cleanInicio);

    const slotRes = await db.query<TimeSlotRow>(
      `SELECT inicio, final, estado, ocupacion FROM public.bloques_horario WHERE inicio = $1;`,
      [cleanInicio]
    );
    if (slotRes.rows.length === 0) {
      throw new AppointmentRuleError(`El bloque ${cleanInicio} no existe.`, 404);
    }
    if (slotRes.rows[0].ocupacion) {
      throw new AppointmentRuleError('No se puede deshabilitar un bloque que tiene una cita o una solicitud.', 409);
    }
    const updateRes = await db.query<TimeSlotRow>(
      `UPDATE public.bloques_horario SET estado = NOT estado WHERE inicio = $1 RETURNING inicio, final, estado, ocupacion;`,
      [cleanInicio]
    );
    return updateRes.rows[0];
  }

  /** Reserva bloques disponibles (habilitados, sin cita y sin empezar) dentro de una transacción. */
  private async occupyBlocks(client: PoolClient, idCita: number, bloques: string[]): Promise<void> {
    const nowStr = getNowColombiaTimestamp();
    for (const bloque of bloques) {
      const check = await client.query<TimeSlotRow>(
        `SELECT inicio, estado, ocupacion FROM public.bloques_horario WHERE inicio = $1 FOR UPDATE;`,
        [bloque]
      );
      if (check.rows.length === 0 || !check.rows[0].estado || check.rows[0].ocupacion || bloque <= nowStr) {
        throw new AppointmentRuleError(`El bloque ${bloque} no está disponible.`, 409);
      }
      await client.query(`UPDATE public.bloques_horario SET ocupacion = TRUE WHERE inicio = $1;`, [bloque]);
      await client.query(`INSERT INTO public.bloques_citas (id_bloque, id_cita) VALUES ($1, $2);`, [bloque, idCita]);
    }
  }

  private assertContiguous(bloques: string[]): string[] {
    const sorted = [...new Set(bloques.map(normalizeBlock))].sort();
    if (sorted.length === 0) {
      throw new AppointmentRuleError('Debe seleccionar al menos un bloque.');
    }
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].slice(0, 10) !== sorted[0].slice(0, 10) || sorted[i] !== blockEnd(sorted[i - 1])) {
        throw new AppointmentRuleError('Los bloques deben ser contiguos y del mismo día.');
      }
    }
    return sorted;
  }

  /** El profesional responsable debe estar activo y tener ROL-ODO o ROL-ESP. */
  private async assertActiveProfessional(executor: { query: PoolClient['query'] }, idUsuario: number): Promise<void> {
    const { rows } = await executor.query(
      `SELECT 1
         FROM public.usuario u
         JOIN public.usuario_rol ur ON ur.id_usuario = u.id_usuario AND ur.estado = true
         JOIN public.rol r ON r.id_rol = ur.id_rol
        WHERE u.id_usuario = $1 AND u.estado = true AND u.es_sistema = false
          AND r.codigo_rol IN ('ROL-ODO', 'ROL-ESP')
        LIMIT 1;`,
      [idUsuario]
    );
    if (rows.length === 0) {
      throw new AppointmentRuleError('El profesional seleccionado no existe, está inactivo o no es odontólogo ni especialista.');
    }
  }

  // ------------------------------------------------------------------
  // RF-AGE-003: solicitud pública
  // ------------------------------------------------------------------
  async createPublicRequest(dto: CreateSolicitudCitaDTO) {
    if (dto.autorizacionDatos !== true) {
      throw new AppointmentRuleError(
        'Debe aceptar la autorización de tratamiento de datos personales (Ley 1581 de 2012) para solicitar la cita.'
      );
    }
    const bloque = normalizeBlock(dto.bloqueSolicitado);
    validatePublicBookingWindow(bloque);

    return db.withTransaction(async (client) => {
      // RQNF-SEG-005: se guarda la aceptación de la plantilla vigente de autorización (D-22)
      const plantillaRes = await client.query<{ id_consentimiento: number; version: number }>(
        `SELECT id_consentimiento, version FROM public.plantilla_consentimiento
          WHERE tipo = 'AUTORIZACION_DATOS' AND estado = true
          LIMIT 1;`
      );
      if (plantillaRes.rows.length === 0) {
        throw new AppointmentRuleError(
          'El consultorio no tiene publicada la autorización de tratamiento de datos. Intente más tarde.',
          503
        );
      }
      const plantilla = plantillaRes.rows[0];
      if (
        dto.versionPlantillaAutorizacion !== undefined &&
        Number(dto.versionPlantillaAutorizacion) !== Number(plantilla.version)
      ) {
        throw new AppointmentRuleError(
          'El texto de la autorización cambió mientras diligenciaba la solicitud. Recargue la página y acéptelo de nuevo.',
          409
        );
      }

      // RF-AGE-003 (D-19): un documento no puede tener otra solicitud pendiente
      const pending = await client.query(
        `SELECT id_solicitud FROM public.solicitud_cita
          WHERE documento_solicitante = $1 AND estado = true
          FOR UPDATE;`,
        [dto.documentoSolicitante.trim()]
      );
      if (pending.rows.length > 0) {
        throw new AppointmentRuleError(
          'Ya existe una solicitud de cita pendiente con este documento. Espere la respuesta del consultorio o comuníquese con él.',
          409
        );
      }

      const slotRes = await client.query<TimeSlotRow>(
        `SELECT inicio, estado, ocupacion FROM public.bloques_horario WHERE inicio = $1 FOR UPDATE;`,
        [bloque]
      );
      if (slotRes.rows.length === 0 || !slotRes.rows[0].estado || slotRes.rows[0].ocupacion) {
        throw new AppointmentRuleError('El horario seleccionado no se encuentra disponible o ya está ocupado.', 409);
      }

      const solRes = await client.query(
        `INSERT INTO public.solicitud_cita
           (nombre_solicitante, documento_solicitante, correo_solicitante, telefono_solicitante,
            fecha_nacimiento, sexo, bloque_solicitado, descripcion, estado,
            id_plantilla_autorizacion, version_plantilla_autorizacion, fecha_aceptacion_autorizacion)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10, CURRENT_TIMESTAMP)
         RETURNING *;`,
        [
          dto.nombreSolicitante.trim(),
          dto.documentoSolicitante.trim(),
          dto.correoSolicitante.trim().toLowerCase(),
          dto.telefonoSolicitante?.trim() || null,
          dto.fechaNacimiento,
          dto.sexo || null,
          bloque,
          dto.descripcion?.trim() || null,
          plantilla.id_consentimiento,
          plantilla.version,
        ]
      );
      const solicitud = solRes.rows[0];

      // Regla de Negocio 1: el bloque queda reservado para esta solicitud
      await client.query(`UPDATE public.bloques_horario SET ocupacion = TRUE WHERE inicio = $1;`, [bloque]);

      await auditLog.record(
        {
          idUsuario: null,
          actor: `Solicitante ${dto.documentoSolicitante.trim()}`,
          accion: 'CREAR',
          entidad: 'solicitud_cita',
          idRegistro: solicitud.id_solicitud,
          valorNuevo: {
            bloque,
            idPlantillaAutorizacion: plantilla.id_consentimiento,
            versionPlantillaAutorizacion: plantilla.version,
          },
        },
        client
      );

      const existingPatientRes = await client.query(
        `SELECT 1 FROM public.paciente WHERE documento_identidad = $1;`,
        [dto.documentoSolicitante.trim()]
      );

      return {
        solicitud,
        idSolicitud: solicitud.id_solicitud,
        bloqueSolicitado: bloque,
        esPacienteNuevo: existingPatientRes.rows.length === 0,
      };
    });
  }

  // ------------------------------------------------------------------
  // RF-AGE-005: gestionar solicitud (confirmar o rechazar)
  // ------------------------------------------------------------------
  async reviewRequest(params: {
    idSolicitud: number;
    actor: AgendaActor;
    aprobar: boolean;
    motivo: string;
    idProfesional?: number;
    selectedBlocks?: string[];
  }) {
    if (!params.aprobar && (!params.motivo || !params.motivo.trim())) {
      throw new AppointmentRuleError('El motivo de rechazo de la solicitud es obligatorio.');
    }

    return db.withTransaction(async (client) => {
      const solRes = await client.query(
        `SELECT *, to_char(bloque_solicitado, 'YYYY-MM-DD HH24:MI:SS') AS bloque_texto
           FROM public.solicitud_cita WHERE id_solicitud = $1 FOR UPDATE;`,
        [params.idSolicitud]
      );
      if (solRes.rows.length === 0) throw new AppointmentRuleError('Solicitud no encontrada.', 404);
      const solicitud = solRes.rows[0];

      if (solicitud.estado === false) {
        throw new AppointmentRuleError('Esta solicitud ya fue gestionada y no puede modificarse de nuevo.', 409);
      }

      await client.query(`UPDATE public.solicitud_cita SET estado = FALSE WHERE id_solicitud = $1;`, [
        params.idSolicitud,
      ]);
      await client.query(
        `INSERT INTO public.historial_solicitud (id_solicitud, id_usuario_gestor, reporte, motivo)
         VALUES ($1, $2, $3, $4);`,
        [
          params.idSolicitud,
          params.actor.idUsuario,
          params.aprobar ? 'Solicitud Confirmada' : 'Solicitud Rechazada',
          params.motivo || null,
        ]
      );
      await auditLog.record(
        {
          idUsuario: params.actor.idUsuario,
          actor: params.actor.correo,
          accion: 'CAMBIAR_ESTADO',
          entidad: 'solicitud_cita',
          idRegistro: params.idSolicitud,
          valorAnterior: { estado: 'Solicitada' },
          valorNuevo: { estado: params.aprobar ? 'Confirmada' : 'Rechazada', motivo: params.motivo || null },
        },
        client
      );

      const bloqueSolicitado = String(solicitud.bloque_texto);
      if (!params.aprobar) {
        // Al rechazar se liberan los bloques reservados por la solicitud
        await client.query(`UPDATE public.bloques_horario SET ocupacion = FALSE WHERE inicio = $1;`, [bloqueSolicitado]);
        const timeRange = computeTimeRangeFromBlocks([bloqueSolicitado]);
        return {
          estado: 'Rechazada',
          solicitudId: params.idSolicitud,
          correo: solicitud.correo_solicitante,
          nombreSolicitante: solicitud.nombre_solicitante,
          fecha: timeRange.fecha,
          hora: timeRange.horaInicio,
        };
      }

      return this.confirmApprovedRequest(client, solicitud, bloqueSolicitado, params);
    });
  }

  private async resolveProfessional(client: PoolClient, idProfesional?: number): Promise<number> {
    if (idProfesional) {
      await this.assertActiveProfessional(client, Number(idProfesional));
      return Number(idProfesional);
    }
    // Sin profesional elegido: el primer odontólogo general activo (ERS v1.3: agenda única).
    const { rows } = await client.query<{ id_usuario: number }>(
      `SELECT u.id_usuario
         FROM public.usuario u
         JOIN public.usuario_rol ur ON ur.id_usuario = u.id_usuario AND ur.estado = true
         JOIN public.rol r ON r.id_rol = ur.id_rol
        WHERE u.estado = true AND u.es_sistema = false AND r.codigo_rol = 'ROL-ODO'
        ORDER BY u.id_usuario
        LIMIT 1;`
    );
    if (rows.length === 0) {
      throw new AppointmentRuleError('No hay un profesional activo para asignar a la cita.');
    }
    return rows[0].id_usuario;
  }

  private async confirmApprovedRequest(
    client: PoolClient,
    solicitud: any,
    bloqueSolicitado: string,
    params: { idSolicitud: number; actor: AgendaActor; motivo: string; idProfesional?: number; selectedBlocks?: string[] }
  ) {
    const idProfesional = await this.resolveProfessional(client, params.idProfesional);

    const patientCheck = await client.query<{ id_paciente: number }>(
      `SELECT id_paciente FROM public.paciente WHERE documento_identidad = $1;`,
      [solicitud.documento_solicitante.trim()]
    );

    let idPaciente: number;
    let esNuevo = false;
    if (patientCheck.rows.length > 0) {
      idPaciente = patientCheck.rows[0].id_paciente;
    } else {
      if (!solicitud.fecha_nacimiento) {
        throw new AppointmentRuleError(
          'La solicitud no tiene fecha de nacimiento; no se puede crear el paciente. Regístrelo primero (RF-HCL-001).'
        );
      }
      // Paciente nuevo con los datos de la solicitud; sin sexo queda con "Datos incompletos" (RF-AGE-005)
      esNuevo = true;
      const insertPacRes = await client.query<{ id_paciente: number }>(
        `INSERT INTO public.paciente (nombre_completo, documento_identidad, correo, telefono, fecha_nacimiento, sexo)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id_paciente;`,
        [
          solicitud.nombre_solicitante.trim(),
          solicitud.documento_solicitante.trim(),
          solicitud.correo_solicitante.trim(),
          solicitud.telefono_solicitante?.trim() || null,
          solicitud.fecha_nacimiento,
          solicitud.sexo || null,
        ]
      );
      idPaciente = insertPacRes.rows[0].id_paciente;
      await client.query(`INSERT INTO public.historia_clinica (id_paciente) VALUES ($1);`, [idPaciente]);
      await auditLog.record(
        {
          idUsuario: params.actor.idUsuario,
          actor: params.actor.correo,
          accion: 'CREAR',
          entidad: 'paciente',
          idRegistro: idPaciente,
          detalle: { origen: `solicitud_cita:${params.idSolicitud}` },
        },
        client
      );
    }

    const blocks =
      params.selectedBlocks && params.selectedBlocks.length > 0
        ? this.assertContiguous(params.selectedBlocks)
        : [bloqueSolicitado];

    // Se libera la reserva de la solicitud y se ocupan los bloques definitivos (verificando disponibilidad)
    await client.query(`UPDATE public.bloques_horario SET ocupacion = FALSE WHERE inicio = $1;`, [bloqueSolicitado]);

    const insertCitaRes = await client.query(
      `INSERT INTO public.cita (titulo, descripcion, id_paciente, id_usuario, estado, recordatorio_estado)
       VALUES ($1, $2, $3, $4, 'Confirmada', 'Pendiente') RETURNING *;`,
      [
        'Valoración odontológica',
        solicitud.descripcion || 'Solicitud web confirmada',
        idPaciente,
        idProfesional,
      ]
    );
    const cita = insertCitaRes.rows[0];
    await this.occupyBlocks(client, cita.id_cita, blocks);

    // "Agendado por": el usuario que confirmó (Regla de Negocio 9)
    await client.query(
      `INSERT INTO public.historial_cita (id_cita, id_usuario_gestor, reporte, motivo)
       VALUES ($1, $2, 'Cita Confirmada por gestión de solicitud web', $3);`,
      [cita.id_cita, params.actor.idUsuario, params.motivo || null]
    );
    await auditLog.record(
      {
        idUsuario: params.actor.idUsuario,
        actor: params.actor.correo,
        accion: 'CREAR',
        entidad: 'cita',
        idRegistro: cita.id_cita,
        valorNuevo: { estado: 'Confirmada', bloques: blocks, idProfesional, origen: `solicitud:${params.idSolicitud}` },
      },
      client
    );

    const docRes = await client.query(
      `SELECT nombre_completo, correo FROM public.usuario WHERE id_usuario = $1;`,
      [idProfesional]
    );
    const timeRange = computeTimeRangeFromBlocks(blocks);

    return {
      ...cita,
      idCita: cita.id_cita,
      correoPaciente: solicitud.correo_solicitante,
      nombrePaciente: solicitud.nombre_solicitante,
      fecha: timeRange.fecha,
      hora: timeRange.hora,
      nombreDoctor: docRes.rows[0]?.nombre_completo ?? 'Profesional asignado',
      correoDoctor: docRes.rows[0]?.correo ?? null,
      telefonoPaciente: solicitud.telefono_solicitante,
      esPacienteNuevo: esNuevo,
    };
  }

  // ------------------------------------------------------------------
  // RF-AGE-002: agendar cita (nace Confirmada con "Agendado por")
  // ------------------------------------------------------------------
  async scheduleAppointment(dto: CreateCitaDTO) {
    if (!Array.isArray(dto.bloques) || dto.bloques.length === 0) {
      throw new AppointmentRuleError('Debe seleccionar al menos un bloque.');
    }
    if (!dto.idPaciente) {
      throw new AppointmentRuleError('Debe seleccionar el paciente.');
    }
    const bloques = this.assertContiguous(dto.bloques);
    validatePastDateBooking(bloques);
    const titulo = (dto.titulo || 'Consulta odontológica').trim().slice(0, 50);

    return db.withTransaction(async (client) => {
      await this.assertActiveProfessional(client, Number(dto.idUsuarioProfesional));

      const citaRes = await client.query(
        `INSERT INTO public.cita (titulo, descripcion, id_paciente, id_usuario, estado, recordatorio_estado)
         VALUES ($1, $2, $3, $4, 'Confirmada', 'Pendiente')
         RETURNING *;`,
        [titulo, dto.descripcion?.slice(0, 500) || null, dto.idPaciente, dto.idUsuarioProfesional]
      );
      const cita = citaRes.rows[0];
      await this.occupyBlocks(client, cita.id_cita, bloques);

      await client.query(
        `INSERT INTO public.historial_cita (id_cita, id_usuario_gestor, reporte, motivo)
         VALUES ($1, $2, 'Cita creada en estado Confirmada', 'Agendamiento interno');`,
        [cita.id_cita, dto.idUsuarioGestor]
      );
      await auditLog.record(
        {
          idUsuario: dto.idUsuarioGestor,
          actor: dto.actorGestor ?? 'Desconocido',
          accion: 'CREAR',
          entidad: 'cita',
          idRegistro: cita.id_cita,
          valorNuevo: { estado: 'Confirmada', bloques, idProfesional: dto.idUsuarioProfesional, idPaciente: dto.idPaciente },
        },
        client
      );

      const pacRes = await client.query(
        `SELECT nombre_completo, correo, telefono FROM public.paciente WHERE id_paciente = $1;`,
        [dto.idPaciente]
      );
      const docRes = await client.query(
        `SELECT nombre_completo, correo FROM public.usuario WHERE id_usuario = $1;`,
        [dto.idUsuarioProfesional]
      );
      const timeRange = computeTimeRangeFromBlocks(bloques);

      return {
        ...cita,
        nombrePaciente: pacRes.rows[0]?.nombre_completo || 'Paciente',
        correoPaciente: pacRes.rows[0]?.correo || null,
        telefonoPaciente: pacRes.rows[0]?.telefono || null,
        nombreDoctor: docRes.rows[0]?.nombre_completo || 'Profesional',
        correoDoctor: docRes.rows[0]?.correo || null,
        fecha: timeRange.fecha,
        hora: timeRange.hora,
      };
    });
  }

  // ------------------------------------------------------------------
  // RF-AGE-007, RF-AGE-009, RF-AGE-012: cambios de estado desde la agenda
  // ------------------------------------------------------------------
  async changeAppointmentState(params: {
    idCita: number;
    nuevoEstado: EstadoCita;
    actor: AgendaActor;
    motivo?: string | null;
    liberarBloques?: boolean;
  }) {
    return db.withTransaction(async (client) => {
      const currentRes = await client.query(`SELECT * FROM public.cita WHERE id_cita = $1 FOR UPDATE;`, [
        params.idCita,
      ]);
      if (currentRes.rows.length === 0) throw new AppointmentRuleError('La cita no existe.', 404);
      const citaActual = currentRes.rows[0];

      const bcRes = await client.query<{ id_bloque: string }>(
        `SELECT to_char(id_bloque, 'YYYY-MM-DD HH24:MI:SS') AS id_bloque
           FROM public.bloques_citas WHERE id_cita = $1 ORDER BY id_bloque ASC;`,
        [params.idCita]
      );
      const bloques = bcRes.rows.map((r) => r.id_bloque);

      validateStateChangeRules({
        citaActual,
        nuevoEstado: params.nuevoEstado,
        motivo: params.motivo,
        actor: params.actor,
        inicioCita: bloques[0] ?? null,
      });

      if (params.nuevoEstado === 'En consulta') {
        // RF-AGE-009: máximo una cita En consulta por profesional
        const activeRes = await client.query(
          `SELECT id_cita FROM public.cita WHERE id_usuario = $1 AND estado = 'En consulta' AND id_cita <> $2;`,
          [citaActual.id_usuario, params.idCita]
        );
        if (activeRes.rows.length > 0) {
          throw new AppointmentRuleError('El profesional ya tiene otra cita En consulta.', 409);
        }
      }

      if (params.nuevoEstado === 'Atendida') {
        // RF-AGE-009: sin el motivo de consulta guardado (RF-HCL-005) no se finaliza
        const evoRes = await client.query(
          `SELECT 1 FROM public.evolucion
            WHERE id_cita = $1 AND id_usuario_diligencio IS NOT NULL
              AND TRIM(COALESCE(motivo_consulta, '')) <> ''
            LIMIT 1;`,
          [params.idCita]
        );
        if (evoRes.rows.length === 0) {
          throw new AppointmentRuleError('Falta registrar el motivo de consulta', 409);
        }
      }

      const recordatorio =
        params.nuevoEstado === 'Cancelada' || params.nuevoEstado === 'Inasistencia'
          ? 'Anulado'
          : citaActual.recordatorio_estado;

      const updateRes = await client.query(
        `UPDATE public.cita SET estado = $1, recordatorio_estado = $2 WHERE id_cita = $3 RETURNING *;`,
        [params.nuevoEstado, recordatorio, params.idCita]
      );

      // RF-AGE-007: al cancelar, los bloques que no han empezado quedan disponibles
      // (por defecto) o deshabilitados. La inasistencia no libera bloques (RF-AGE-012).
      if (params.nuevoEstado === 'Cancelada') {
        const nowStr = getNowColombiaTimestamp();
        const futuros = bloques.filter((b) => b > nowStr);
        if (futuros.length > 0) {
          await client.query(
            `UPDATE public.bloques_horario
                SET ocupacion = FALSE, estado = $2
              WHERE inicio = ANY($1::timestamp[]);`,
            [futuros, params.liberarBloques !== false]
          );
        }
      }

      await client.query(
        `INSERT INTO public.historial_cita (id_cita, id_usuario_gestor, reporte, motivo)
         VALUES ($1, $2, $3, $4);`,
        [
          params.idCita,
          params.actor.idUsuario,
          `Cambio de estado: ${citaActual.estado} -> ${params.nuevoEstado}`,
          params.motivo?.trim() || null,
        ]
      );
      await auditLog.record(
        {
          idUsuario: params.actor.idUsuario,
          actor: params.actor.correo,
          accion: 'CAMBIAR_ESTADO',
          entidad: 'cita',
          idRegistro: params.idCita,
          valorAnterior: { estado: citaActual.estado },
          valorNuevo: { estado: params.nuevoEstado, motivo: params.motivo ?? null },
        },
        client
      );

      const detailRes = await client.query(
        `SELECT p.nombre_completo AS "nombrePaciente", p.correo AS "correoPaciente",
                u.nombre_completo AS "nombreDoctor", u.correo AS "correoDoctor"
           FROM public.cita c
           JOIN public.paciente p ON c.id_paciente = p.id_paciente
           JOIN public.usuario u ON c.id_usuario = u.id_usuario
          WHERE c.id_cita = $1;`,
        [params.idCita]
      );
      const timeRange = computeTimeRangeFromBlocks(bloques);

      return {
        ...updateRes.rows[0],
        nombrePaciente: detailRes.rows[0]?.nombrePaciente || 'Paciente',
        correoPaciente: detailRes.rows[0]?.correoPaciente || null,
        nombreDoctor: detailRes.rows[0]?.nombreDoctor || 'Profesional',
        correoDoctor: detailRes.rows[0]?.correoDoctor || null,
        fecha: timeRange.fecha,
        hora: timeRange.hora,
      };
    });
  }

  // ------------------------------------------------------------------
  // RF-AGE-006: editar cita Confirmada
  // ------------------------------------------------------------------
  async updateAppointmentDetails(params: {
    idCita: number;
    actor: AgendaActor;
    idDoctor?: number;
    titulo?: string;
    descripcion?: string;
    selectedBlocks?: string[];
    motivo?: string;
  }) {
    const nuevosBloques =
      params.selectedBlocks && params.selectedBlocks.length > 0 ? this.assertContiguous(params.selectedBlocks) : null;

    return db.withTransaction(async (client) => {
      const currentRes = await client.query(
        `SELECT c.*, p.nombre_completo AS "nombrePaciente", p.correo AS "correoPaciente", p.telefono AS "telefonoPaciente"
           FROM public.cita c
           JOIN public.paciente p ON c.id_paciente = p.id_paciente
          WHERE c.id_cita = $1 FOR UPDATE OF c;`,
        [params.idCita]
      );
      if (currentRes.rows.length === 0) throw new AppointmentRuleError('La cita no existe.', 404);
      const cita = currentRes.rows[0];

      if (cita.estado !== 'Confirmada') {
        throw new AppointmentRuleError(
          `Las citas en estado '${cita.estado}' no se pueden editar. Solo se editan citas Confirmadas (RF-AGE-006).`,
          409
        );
      }

      const prevBlocksRes = await client.query<{ id_bloque: string }>(
        `SELECT to_char(id_bloque, 'YYYY-MM-DD HH24:MI:SS') AS id_bloque FROM public.bloques_citas WHERE id_cita = $1 ORDER BY 1;`,
        [params.idCita]
      );
      const prevBlocks = prevBlocksRes.rows.map((r) => r.id_bloque);

      const targetDoctorId = params.idDoctor ? Number(params.idDoctor) : cita.id_usuario;
      if (targetDoctorId !== cita.id_usuario) {
        await this.assertActiveProfessional(client, targetDoctorId);
      }

      const cambiaHorario = Boolean(nuevosBloques && nuevosBloques.join() !== prevBlocks.join());
      if (nuevosBloques && cambiaHorario) {
        // Los bloques que la cita ya tenía siguen siendo válidos para ella
        const nuevos = nuevosBloques.filter((b) => !prevBlocks.includes(b));
        validatePastDateBooking(nuevos);
        const liberar = prevBlocks.filter((b) => !nuevosBloques.includes(b));
        if (liberar.length) {
          await client.query(
            `UPDATE public.bloques_horario SET ocupacion = FALSE WHERE inicio = ANY($1::timestamp[]);`,
            [liberar]
          );
          await client.query(
            `DELETE FROM public.bloques_citas WHERE id_cita = $1 AND id_bloque = ANY($2::timestamp[]);`,
            [params.idCita, liberar]
          );
        }
        await this.occupyBlocks(client, params.idCita, nuevos);
      }

      const cambiaProfesional = targetDoctorId !== cita.id_usuario;
      // RF-AGE-006: si cambian fecha, bloques o profesional, se reprograma el recordatorio
      await client.query(
        `UPDATE public.cita
            SET titulo = COALESCE($2, titulo),
                descripcion = COALESCE($3, descripcion),
                id_usuario = $4,
                recordatorio_estado = CASE WHEN $5 THEN 'Pendiente' ELSE recordatorio_estado END,
                recordatorio_causa = CASE WHEN $5 THEN NULL ELSE recordatorio_causa END
          WHERE id_cita = $1;`,
        [
          params.idCita,
          params.titulo ? params.titulo.slice(0, 50) : null,
          params.descripcion ?? null,
          targetDoctorId,
          cambiaHorario || cambiaProfesional,
        ]
      );

      await client.query(
        `INSERT INTO public.historial_cita (id_cita, id_usuario_gestor, reporte, motivo)
         VALUES ($1, $2, 'Cita modificada / reprogramada', $3);`,
        [params.idCita, params.actor.idUsuario, params.motivo || 'Modificación de detalles y/o bloques de la cita']
      );
      const finalBlocks = nuevosBloques ?? prevBlocks;
      await auditLog.record(
        {
          idUsuario: params.actor.idUsuario,
          actor: params.actor.correo,
          accion: 'MODIFICAR',
          entidad: 'cita',
          idRegistro: params.idCita,
          valorAnterior: { titulo: cita.titulo, descripcion: cita.descripcion, idProfesional: cita.id_usuario, bloques: prevBlocks },
          valorNuevo: {
            titulo: params.titulo ?? cita.titulo,
            descripcion: params.descripcion ?? cita.descripcion,
            idProfesional: targetDoctorId,
            bloques: finalBlocks,
          },
        },
        client
      );

      const updatedRes = await client.query(
        `SELECT c.*, u.nombre_completo AS "nombreDoctor", u.correo AS "correoDoctor"
           FROM public.cita c
           JOIN public.usuario u ON c.id_usuario = u.id_usuario
          WHERE c.id_cita = $1;`,
        [params.idCita]
      );
      const timeRange = computeTimeRangeFromBlocks(finalBlocks);

      return {
        ...updatedRes.rows[0],
        correoPaciente: cita.correoPaciente,
        nombrePaciente: cita.nombrePaciente,
        telefonoPaciente: cita.telefonoPaciente,
        fecha: timeRange.fecha,
        hora: timeRange.hora,
        notificar: cambiaHorario || cambiaProfesional,
      };
    });
  }

  // ------------------------------------------------------------------
  // RF-AGE-004: destinatarios COA → AUX → ADM (solo usuarios activos)
  // ------------------------------------------------------------------
  async getStaffForNewRequestNotification(): Promise<Array<{ nombreCompleto: string; correo: string; rol: string }>> {
    for (const codigo of ['ROL-COA', 'ROL-AUX', 'ROL-ADM']) {
      const { rows } = await db.query(
        `SELECT DISTINCT u.nombre_completo AS "nombreCompleto", u.correo, r.codigo_rol AS rol
           FROM public.usuario u
           JOIN public.usuario_rol ur ON u.id_usuario = ur.id_usuario AND ur.estado = true
           JOIN public.rol r ON ur.id_rol = r.id_rol
          WHERE r.codigo_rol = $1 AND u.estado = true AND u.es_sistema = false;`,
        [codigo]
      );
      if (rows.length > 0) return rows;
    }
    return [];
  }

  // ------------------------------------------------------------------
  // RF-AGE-008: agenda con paciente, bloques, "Agendado por", recordatorio e historial
  // ------------------------------------------------------------------
  async getAgenda(idProfesional?: number, idPaciente?: number, fecha?: string) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (idProfesional) {
      params.push(idProfesional);
      conditions.push(`c.id_usuario = $${params.length}`);
    }
    if (idPaciente) {
      params.push(idPaciente);
      conditions.push(`c.id_paciente = $${params.length}`);
    }
    if (fecha) {
      params.push(fecha);
      conditions.push(
        `EXISTS (SELECT 1 FROM public.bloques_citas bcf WHERE bcf.id_cita = c.id_cita AND bcf.id_bloque::date = $${params.length}::date)`
      );
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(
      `SELECT
         c.id_cita AS "idCita",
         c.titulo,
         c.descripcion,
         c.estado,
         c.titulo AS "servicio",
         c.recordatorio_estado AS "recordatorioEstado",
         c.recordatorio_causa AS "recordatorioCausa",
         p.id_paciente AS "idPaciente",
         p.nombre_completo AS "nombrePaciente",
         p.documento_identidad AS "documentoPaciente",
         p.telefono AS "telefonoPaciente",
         p.correo AS "correoPaciente",
         p.fecha_nacimiento::text AS "fechaNacimiento",
         p.sexo,
         false AS "esPacienteNuevo",
         u.id_usuario AS "idProfesional",
         u.nombre_completo AS "nombreProfesional",
         (SELECT ug.nombre_completo
            FROM public.historial_cita h
            JOIN public.usuario ug ON ug.id_usuario = h.id_usuario_gestor
           WHERE h.id_cita = c.id_cita
           ORDER BY h.id_cambio_cita ASC
           LIMIT 1) AS "agendadoPor",
         COALESCE(
           (SELECT json_agg(to_char(bc.id_bloque, 'YYYY-MM-DD HH24:MI:SS') ORDER BY bc.id_bloque)
              FROM public.bloques_citas bc WHERE bc.id_cita = c.id_cita),
           '[]'
         ) AS bloques,
         COALESCE(
           (SELECT json_agg(json_build_object(
                     'idCambio', h.id_cambio_cita,
                     'idUsuarioGestor', h.id_usuario_gestor,
                     'gestor', ug.nombre_completo,
                     'fecha', h.fecha_historial,
                     'reporte', h.reporte,
                     'motivo', h.motivo) ORDER BY h.id_cambio_cita)
              FROM public.historial_cita h
              LEFT JOIN public.usuario ug ON ug.id_usuario = h.id_usuario_gestor
             WHERE h.id_cita = c.id_cita),
           '[]'
         ) AS historial
       FROM public.cita c
       JOIN public.paciente p ON c.id_paciente = p.id_paciente
       JOIN public.usuario u ON c.id_usuario = u.id_usuario
       ${where}
       ORDER BY c.id_cita DESC;`,
      params
    );
    return rows;
  }

  async getMonthlySummary(year: number, month: number): Promise<MonthlyDaySummary[]> {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const { rows } = await db.query<MonthlyDaySummary>(
      `SELECT
         to_char(d.day, 'YYYY-MM-DD') AS fecha,
         EXTRACT(DAY FROM d.day)::int AS dia,
         COALESCE(citas.total_citas, 0)::int AS "totalCitas",
         COALESCE(bloques.total_bloques, 0)::int AS "totalBloques",
         (COALESCE(bloques.total_bloques, 0) = 0) AS "sinBloques"
       FROM generate_series($1::date, ($1::date + interval '1 month' - interval '1 day')::date, interval '1 day') AS d(day)
       LEFT JOIN (
         SELECT bc.id_bloque::date AS dia, COUNT(DISTINCT c.id_cita) AS total_citas
           FROM public.cita c
           JOIN public.bloques_citas bc ON c.id_cita = bc.id_cita
          WHERE c.estado NOT IN ('Cancelada', 'Rechazada')
          GROUP BY bc.id_bloque::date
       ) citas ON citas.dia = d.day::date
       LEFT JOIN (
         SELECT inicio::date AS dia, COUNT(*) AS total_bloques
           FROM public.bloques_horario
          WHERE estado = true
          GROUP BY inicio::date
       ) bloques ON bloques.dia = d.day::date
       ORDER BY d.day ASC;`,
      [startDate]
    );
    return rows;
  }

  // Solicitudes pendientes (estado Solicitada)
  async getRequests(idSolicitud?: number) {
    const params: unknown[] = [];
    let where = 'WHERE sc.estado = true';
    if (idSolicitud) {
      params.push(idSolicitud);
      where = `WHERE sc.id_solicitud = $${params.length}`;
    }
    const { rows } = await db.query(
      `SELECT
         sc.id_solicitud AS "idSolicitud",
         CASE WHEN sc.estado THEN 'Solicitada' ELSE 'Gestionada' END AS "estadoSolicitud",
         sc.nombre_solicitante AS "nombrePaciente",
         sc.documento_solicitante AS "documentoIdentidad",
         sc.correo_solicitante AS "correo",
         sc.telefono_solicitante AS "telefono",
         to_char(sc.bloque_solicitado, 'YYYY-MM-DD') AS "fechaSolicitada",
         to_char(sc.bloque_solicitado, 'HH24:MI') AS "horaSolicitada",
         to_char(sc.bloque_solicitado, 'YYYY-MM-DD HH24:MI:SS') AS "bloqueSolicitado",
         sc.descripcion AS "motivoConsulta",
         sc.fecha_solicitud AS "fechaSolicitud",
         COALESCE(sc.fecha_nacimiento::text, p.fecha_nacimiento::text) AS "fechaNacimiento",
         COALESCE(sc.sexo, p.sexo) AS "sexo",
         (p.id_paciente IS NULL) AS "esPacienteNuevo",
         p.id_paciente AS "idPaciente",
         p.correo AS "correoRegistrado",
         p.telefono AS "telefonoRegistrado",
         pc.nombre AS "plantillaAutorizacion",
         sc.version_plantilla_autorizacion AS "versionPlantillaAutorizacion",
         sc.fecha_aceptacion_autorizacion AS "fechaAceptacionAutorizacion"
       FROM public.solicitud_cita sc
       LEFT JOIN public.paciente p ON p.documento_identidad = sc.documento_solicitante
       LEFT JOIN public.plantilla_consentimiento pc ON pc.id_consentimiento = sc.id_plantilla_autorizacion
       ${where}
       ORDER BY sc.bloque_solicitado ASC;`,
      params
    );
    return rows;
  }

  async getRequestById(idSolicitud: number) {
    const rows = await this.getRequests(idSolicitud);
    return rows[0] || null;
  }

  // ------------------------------------------------------------------
  // Catálogo de profesionales odontológicos activos para asignación de citas
  // (RF-AGE-001, RF-AGE-002, RF-AGE-005, RF-AGE-006, RF-AGE-008)
  // ------------------------------------------------------------------
  async findActiveProfessionals(): Promise<Array<{
    idUsuario: number;
    nombreCompleto: string;
    especialidad: string;
    codigoRol: string;
  }>> {
    const { rows } = await db.query(
      `SELECT
         u.id_usuario AS "idUsuario",
         u.nombre_completo AS "nombreCompleto",
         string_agg(r.nombre_rol, ', ' ORDER BY r.id_rol) AS "especialidad",
         string_agg(r.codigo_rol, ', ' ORDER BY r.id_rol) AS "codigoRol"
       FROM public.usuario u
       JOIN public.usuario_rol ur ON ur.id_usuario = u.id_usuario AND ur.estado = true
       JOIN public.rol r ON r.id_rol = ur.id_rol
      WHERE u.estado = true 
        AND u.es_sistema = false 
        AND r.codigo_rol IN ('ROL-ODO', 'ROL-ESP')
      GROUP BY u.id_usuario, u.nombre_completo
      ORDER BY u.nombre_completo ASC;`
    );
    return rows;
  }
}
