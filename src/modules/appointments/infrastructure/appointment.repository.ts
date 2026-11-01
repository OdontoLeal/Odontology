import { db } from '../../../shared/infrastructure/database/database';
import {
  CreateCitaDTO,
  CreateSolicitudCitaDTO,
  EstadoCita,
  MonthlyDaySummary,
  TimeSlotRow,
} from './appointment.model';

export class AppointmentRepository {
  // RF-AGE-001: Crear / Habilitar bloque de horario asignado a un profesional (DEF-03)
  async upsertTimeSlot(
    inicio: string,
    final: string,
    estado = true,
    idProfesional = 1
  ): Promise<TimeSlotRow> {
    const sql = `
      INSERT INTO public.bloques_horario (inicio, final, estado, ocupacion)
      VALUES ($1, $2, $3, FALSE)
      ON CONFLICT (inicio) DO UPDATE SET estado = EXCLUDED.estado
      WHERE public.bloques_horario.ocupacion = FALSE
      RETURNING inicio, final, estado, ocupacion;
    `;
    const { rows } = await db.query<TimeSlotRow>(sql, [inicio, final, estado]);
    if (rows.length === 0) {
      throw new Error('No se puede modificar un bloque que ya se encuentra ocupado por una cita.');
    }
    return rows[0];
  }

  async getTimeSlots(
    desde?: string,
    hasta?: string,
    idProfesional?: number
  ): Promise<TimeSlotRow[]> {
    const params: any[] = [];
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

  // Generar bloques estándar de 30 min desde las 06:00 hasta las 20:00 (RF-AGE-001)
  async generateDaySlots(
    fecha: string,
    idProfesional = 1
  ): Promise<{ totalGenerados: number; fecha: string }> {
    const cleanFecha = fecha.trim().split('T')[0].split(' ')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanFecha)) {
      throw new Error('La fecha debe tener formato YYYY-MM-DD');
    }

    const todayColombia = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    if (cleanFecha < todayColombia) {
      throw new Error(`No se pueden generar bloques de horario para fechas pasadas (${cleanFecha}).`);
    }

    const slots: { inicio: string; final: string }[] = [];
    for (let hour = 6; hour < 20; hour++) {
      for (const minute of [0, 30]) {
        const startH = hour.toString().padStart(2, '0');
        const startM = minute.toString().padStart(2, '0');

        const endHour = minute === 30 ? hour + 1 : hour;
        const endMinute = minute === 30 ? 0 : 30;
        const endH = endHour.toString().padStart(2, '0');
        const endM = endMinute.toString().padStart(2, '0');

        const inicio = `${cleanFecha} ${startH}:${startM}:00`;
        const final = `${cleanFecha} ${endH}:${endM}:00`;
        slots.push({ inicio, final });
      }
    }

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

  // Obtener bloques disponibles para agendamiento público, filtrando opcionalmente por profesional
  async getAvailableSlots(fecha: string, idProfesional?: number): Promise<TimeSlotRow[]> {
    const cleanFecha = fecha.trim().split('T')[0].split(' ')[0];
    const params: any[] = [`${cleanFecha} 00:00:00`, `${cleanFecha} 23:59:59`];
    const { rows } = await db.query<TimeSlotRow>(
      `SELECT inicio, final, estado, ocupacion
       FROM public.bloques_horario 
       WHERE inicio >= $1::timestamp AND inicio <= $2::timestamp 
         AND estado = true AND ocupacion = false
       ORDER BY inicio ASC;`,
      params
    );
    return rows;
  }

  // Habilitar o deshabilitar un bloque horario
  async toggleSlotStatus(inicio: string, idProfesional = 1): Promise<TimeSlotRow> {
    let cleanInicio = String(inicio).trim();
    if (cleanInicio.includes('T')) {
      cleanInicio = cleanInicio.replace('T', ' ').split('.')[0];
    }

    const todayColombia = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const slotDate = cleanInicio.split(' ')[0];
    if (slotDate < todayColombia) {
      throw new Error(`No se pueden modificar bloques de horario de fechas pasadas (${slotDate}).`);
    }

    const slotRes = await db.query<TimeSlotRow>(
      `SELECT inicio, final, estado, ocupacion FROM public.bloques_horario WHERE inicio = $1;`,
      [cleanInicio]
    );
    if (slotRes.rows.length === 0) {
      throw new Error(`El bloque ${cleanInicio} no existe en la base de datos.`);
    }
    if (slotRes.rows[0].ocupacion) {
      throw new Error('No se puede deshabilitar un bloque que se encuentra ocupado por una cita o reserva activa.');
    }
    const updateRes = await db.query<TimeSlotRow>(
      `UPDATE public.bloques_horario SET estado = NOT estado WHERE inicio = $1 RETURNING inicio, final, estado, ocupacion;`,
      [cleanInicio]
    );
    return updateRes.rows[0];
  }

  // RF-AGE-003: Solicitar cita desde sección pública y reservar bloque (DEF-06, DEF-07, DEF-08, DEF-12)
  async createPublicRequest(dto: CreateSolicitudCitaDTO) {
    // 1. Validar autorización de datos personales Ley 1581 (DEF-07 / CPS-AGE-003-03)
    if (!dto.autorizacionDatos) {
      throw new Error('Debe aceptar la autorización de tratamiento de datos personales (Ley 1581 de 2012) para solicitar la cita.');
    }

    // 2. Validar ventana de 5 a 60 días calendario (DEF-06 / CPS-AGE-003-02)
    const todayColombiaStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const reqDateStr = String(dto.bloqueSolicitado).trim().split('T')[0].split(' ')[0];
    const d1 = new Date(`${todayColombiaStr}T00:00:00Z`);
    const d2 = new Date(`${reqDateStr}T00:00:00Z`);
    const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 5 || diffDays > 60) {
      throw new Error('Las citas solo se pueden solicitar con una anticipación de entre 5 y 60 días calendario.');
    }

    // 3. Validar que no sea horario pasado del día de hoy (DEF-12 / CPS-AGE-002-04)
    if (new Date(dto.bloqueSolicitado).getTime() < Date.now()) {
      throw new Error('No se pueden solicitar citas en un horario que ya pasó.');
    }

    const idDoctor = dto.idProfesional || 1;

    return db.withTransaction(async (client) => {
      const startDate = new Date(dto.bloqueSolicitado);
      const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
      const startStr = dto.bloqueSolicitado;
      const endStr = `${endDate.getFullYear()}-${(endDate.getMonth() + 1).toString().padStart(2, '0')}-${endDate.getDate().toString().padStart(2, '0')} ${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}:00`;

      await client.query(
        `INSERT INTO public.bloques_horario (inicio, final, estado, ocupacion)
         VALUES ($1, $2, TRUE, FALSE)
         ON CONFLICT (inicio) DO NOTHING;`,
        [startStr, endStr]
      );

      const slotRes = await client.query<TimeSlotRow>(
        `SELECT inicio, estado, ocupacion FROM public.bloques_horario WHERE inicio = $1 FOR UPDATE;`,
        [startStr]
      );
      if (slotRes.rows.length === 0 || !slotRes.rows[0].estado || slotRes.rows[0].ocupacion) {
        throw new Error('El horario seleccionado no se encuentra disponible o ya está ocupado.');
      }

      // Registrar en public.solicitud_cita
      const insertSolSql = `
        INSERT INTO public.solicitud_cita 
          (nombre_solicitante, documento_solicitante, correo_solicitante, telefono_solicitante, fecha_nacimiento, sexo, bloque_solicitado, descripcion, estado)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
        RETURNING *;
      `;
      const solRes = await client.query(insertSolSql, [
        dto.nombreSolicitante.trim(),
        dto.documentoSolicitante.trim(),
        dto.correoSolicitante.trim(),
        dto.telefonoSolicitante?.trim() || null,
        dto.fechaNacimiento || null,
        dto.sexo || null,
        startStr,
        dto.descripcion || 'Valoración odontológica solicitada vía portal web',
      ]);
      const solicitud = solRes.rows[0];

      // Bloquear preventivamente el bloque en bloques_horario para reservar el cupo mientras la coordinación lo revisa
      await client.query(
        `UPDATE public.bloques_horario SET ocupacion = TRUE WHERE inicio = $1;`,
        [startStr]
      );

      // Verificar si ya es paciente registrado
      const existingPatientRes = await client.query(
        `SELECT id_paciente FROM public.paciente WHERE documento_identidad = $1;`,
        [dto.documentoSolicitante.trim()]
      );
      const esPacienteNuevo = existingPatientRes.rows.length === 0;

      return {
        solicitud,
        idSolicitud: solicitud.id_solicitud,
        bloqueSolicitado: startStr,
        esPacienteNuevo,
      };
    });
  }

  // RF-AGE-005: Gestionar solicitud (Aprobar o Rechazar y guardar en historial_solicitud)
  async reviewRequest(params: {
    idSolicitud: number;
    idUsuarioGestor: number;
    aprobar: boolean;
    motivo: string;
    idPaciente?: number;
    idProfesional?: number;
    selectedBlocks?: string[];
  }) {
    if (!params.aprobar) {
      if (!params.motivo || !params.motivo.trim()) {
        throw new Error('El motivo de rechazo de la solicitud es obligatorio.');
      }
    }

    return db.withTransaction(async (client) => {
      const solRes = await client.query(
        `SELECT * FROM public.solicitud_cita WHERE id_solicitud = $1 FOR UPDATE;`,
        [params.idSolicitud]
      );
      if (solRes.rows.length === 0) throw new Error('Solicitud no encontrada.');
      const solicitud = solRes.rows[0];

      if (solicitud.estado === false) {
        throw new Error('Esta solicitud ya ha sido gestionada previamente y no puede ser modificada de nuevo (D-09).');
      }

      await client.query(`UPDATE public.solicitud_cita SET estado = FALSE WHERE id_solicitud = $1;`, [
        params.idSolicitud,
      ]);

      await client.query(
        `INSERT INTO public.historial_solicitud (id_solicitud, id_usuario_gestor, reporte, motivo)
         VALUES ($1, $2, $3, $4);`,
        [
          params.idSolicitud,
          params.idUsuarioGestor,
          params.aprobar ? 'Solicitud Confirmada' : 'Solicitud Rechazada',
          params.motivo,
        ]
      );

      if (!params.aprobar) {
        await client.query(`UPDATE public.bloques_horario SET ocupacion = FALSE WHERE inicio = $1;`, [
          solicitud.bloque_solicitado,
        ]);
        await client.query(
          `UPDATE public.cita SET estado = 'Rechazada' WHERE id_cita IN (SELECT id_cita FROM public.bloques_citas WHERE id_bloque = $1);`,
          [solicitud.bloque_solicitado]
        );
        return {
          estado: 'Rechazada',
          solicitudId: params.idSolicitud,
          correo: solicitud.correo_solicitante,
        };
      }

      // Alta automática o verificación de paciente existente
      const patientCheck = await client.query(
        `SELECT id_paciente, nombre_completo, correo, telefono FROM public.paciente WHERE documento_identidad = $1;`,
        [solicitud.documento_solicitante.trim()]
      );

      let finalPatientId: number;
      let esNuevo = false;

      if (patientCheck.rows.length > 0) {
        finalPatientId = patientCheck.rows[0].id_paciente;
      } else {
        esNuevo = true;
        const insertPacRes = await client.query(
          `INSERT INTO public.paciente 
            (nombre_completo, documento_identidad, correo, telefono, fecha_nacimiento, sexo)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id_paciente;`,
          [
            solicitud.nombre_solicitante.trim(),
            solicitud.documento_solicitante.trim(),
            solicitud.correo_solicitante.trim(),
            solicitud.telefono_solicitante?.trim() || null,
            solicitud.fecha_nacimiento || null,
            solicitud.sexo || null,
          ]
        );
        finalPatientId = insertPacRes.rows[0].id_paciente;

        await client.query(
          `INSERT INTO public.historia_clinica (id_paciente) VALUES ($1) ON CONFLICT (id_paciente) DO NOTHING;`,
          [finalPatientId]
        );
      }

      const existingCitaRes = await client.query(
        `SELECT c.* FROM public.cita c
         JOIN public.bloques_citas bc ON c.id_cita = bc.id_cita
         WHERE bc.id_bloque = $1;`,
        [solicitud.bloque_solicitado]
      );

      let cita;
      const targetDoctorId = params.idProfesional || 1;

      if (existingCitaRes.rows.length > 0) {
        const updateCitaRes = await client.query(
          `UPDATE public.cita 
           SET estado = 'Confirmada', id_paciente = $2, id_usuario = COALESCE($3, id_usuario)
           WHERE id_cita = $1
           RETURNING *;`,
          [existingCitaRes.rows[0].id_cita, finalPatientId, targetDoctorId]
        );
        cita = updateCitaRes.rows[0];
      } else {
        const insertCitaRes = await client.query(
          `INSERT INTO public.cita (titulo, descripcion, id_paciente, id_usuario, estado)
           VALUES ($1, $2, $3, $4, 'Confirmada') RETURNING *;`,
          [
            'Valoración Odontológica',
            solicitud.descripcion || 'Valoración odontológica confirmada',
            finalPatientId,
            targetDoctorId,
          ]
        );
        cita = insertCitaRes.rows[0];
        await client.query(
          `INSERT INTO public.bloques_citas (id_bloque, id_cita) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
          [solicitud.bloque_solicitado, cita.id_cita]
        );
      }

      // Bloques a ocupar y asociar
      const rawBlocks =
        params.selectedBlocks && params.selectedBlocks.length > 0
          ? params.selectedBlocks
          : [solicitud.bloque_solicitado];
      const blocksToOccupy = rawBlocks.map((b) => String(b).replace('T', ' ').slice(0, 19));

      const originalBlockClean = String(solicitud.bloque_solicitado).replace('T', ' ').slice(0, 19);
      if (!blocksToOccupy.includes(originalBlockClean)) {
        await client.query(
          `UPDATE public.bloques_horario SET ocupacion = FALSE WHERE inicio = $1;`,
          [solicitud.bloque_solicitado]
        );
      }

      await client.query(`DELETE FROM public.bloques_citas WHERE id_cita = $1;`, [cita.id_cita]);

      for (const bInicio of blocksToOccupy) {
        const bStartDate = new Date(bInicio);
        const bEndDate = new Date(bStartDate.getTime() + 30 * 60 * 1000);
        const bEndStr = `${bEndDate.getFullYear()}-${(bEndDate.getMonth() + 1).toString().padStart(2, '0')}-${bEndDate.getDate().toString().padStart(2, '0')} ${bEndDate.getHours().toString().padStart(2, '0')}:${bEndDate.getMinutes().toString().padStart(2, '0')}:00`;

        await client.query(
          `INSERT INTO public.bloques_horario (inicio, final, estado, ocupacion)
           VALUES ($1, $2, TRUE, TRUE)
           ON CONFLICT (inicio) DO UPDATE SET ocupacion = TRUE, estado = TRUE;`,
          [bInicio, bEndStr]
        );

        await client.query(
          `INSERT INTO public.bloques_citas (id_bloque, id_cita)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING;`,
          [bInicio, cita.id_cita]
        );
      }

      const sortedBlocks = [...blocksToOccupy].sort();
      const firstBlockStr = sortedBlocks[0];
      const lastBlockStr = sortedBlocks[sortedBlocks.length - 1];
      const lastDate = new Date(lastBlockStr);
      const endDate = new Date(lastDate.getTime() + 30 * 60 * 1000);
      const endHHmm = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
      const firstParts = firstBlockStr.split(' ');
      const fechaCita = firstParts[0];
      const startHHmm = (firstParts[1] || '').slice(0, 5);
      const horaRango = `${startHHmm} - ${endHHmm}`;

      const docRes = await client.query(
        `SELECT nombre_completo, correo FROM public.usuario WHERE id_usuario = $1;`,
        [cita.id_usuario]
      );
      const doctorNombre = docRes.rows[0]?.nombre_completo || 'Dr. Eduar Leal Álvarez';
      const doctorCorreo = docRes.rows[0]?.correo || 'eduard.leal@gmail.com';

      // Registro de trazabilidad en historial_cita: solo params.idUsuarioGestor (DEF-08)
      await client.query(
        `INSERT INTO public.historial_cita (id_cita, id_usuario_gestor, reporte, motivo)
         VALUES ($1, $2, 'Cita Confirmada por gestión de solicitud web (Alta automática)', $3);`,
        [cita.id_cita, params.idUsuarioGestor, params.motivo]
      );

      return {
        ...cita,
        idCita: cita.id_cita,
        correoPaciente: solicitud.correo_solicitante,
        nombrePaciente: solicitud.nombre_solicitante,
        fechaHora: `${fechaCita} ${horaRango}`,
        fecha: fechaCita,
        hora: horaRango,
        nombreDoctor: doctorNombre,
        correoDoctor: doctorCorreo,
        telefonoPaciente: solicitud.telefono_solicitante,
        esPacienteNuevo: esNuevo,
      };
    });
  }

  // RF-AGE-002: Agendar cita directamente (Confirmada) ocupando bloques con validación de profesional (DEF-03, DEF-12)
  async scheduleAppointment(dto: CreateCitaDTO) {
    const todayColombia = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    for (const bloque of dto.bloques) {
      const blockDate = String(bloque).trim().split('T')[0].split(' ')[0];
      if (blockDate < todayColombia) {
        throw new Error(`No se pueden agendar citas para fechas pasadas (${blockDate}).`);
      }
      if (new Date(bloque).getTime() < Date.now()) {
        throw new Error(`No se pueden agendar citas en un horario que ya pasó (${bloque}).`);
      }
    }

    return db.withTransaction(async (client) => {
      for (const bloque of dto.bloques) {
        const check = await client.query<TimeSlotRow>(
          `SELECT inicio, estado, ocupacion FROM public.bloques_horario WHERE inicio = $1 FOR UPDATE;`,
          [bloque]
        );
        if (check.rows.length === 0 || !check.rows[0].estado || check.rows[0].ocupacion) {
          throw new Error(`El bloque ${bloque} no está disponible.`);
        }
      }

      const citaRes = await client.query(
        `INSERT INTO public.cita (titulo, descripcion, id_paciente, id_usuario, estado)
         VALUES ($1, $2, $3, $4, 'Confirmada')
         RETURNING *;`,
        [dto.titulo.slice(0, 50), dto.descripcion || null, dto.idPaciente, dto.idUsuarioProfesional]
      );
      const cita = citaRes.rows[0];

      for (const bloque of dto.bloques) {
        await client.query(`INSERT INTO public.bloques_citas (id_bloque, id_cita) VALUES ($1, $2);`, [
          bloque,
          cita.id_cita,
        ]);
        await client.query(
          `UPDATE public.bloques_horario SET ocupacion = TRUE WHERE inicio = $1;`,
          [bloque]
        );
      }

      // Regla de Negocio 10: Guardar "Agendado por" en historial_cita
      await client.query(
        `INSERT INTO public.historial_cita (id_cita, id_usuario_gestor, reporte, motivo)
         VALUES ($1, $2, 'Cita creada en estado Confirmada (Agendado por)', 'Agendamiento interno');`,
        [cita.id_cita, dto.idUsuarioGestor]
      );

      const pacRes = await client.query(
        `SELECT nombre_completo, correo, telefono FROM public.paciente WHERE id_paciente = $1;`,
        [dto.idPaciente]
      );
      const docRes = await client.query(
        `SELECT nombre_completo, correo FROM public.usuario WHERE id_usuario = $1;`,
        [dto.idUsuarioProfesional]
      );

      const sortedBlocks = [...dto.bloques].sort();
      const firstBlockStr = String(sortedBlocks[0]).replace('T', ' ');
      const lastBlockStr = String(sortedBlocks[sortedBlocks.length - 1]).replace('T', ' ');
      const fechaCita = firstBlockStr.split(' ')[0];
      const startHHmm = (firstBlockStr.split(' ')[1] || '').slice(0, 5);
      const lastDate = new Date(lastBlockStr);
      const endDate = new Date(lastDate.getTime() + 30 * 60 * 1000);
      const endHHmm = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
      const horaRango = `${startHHmm} - ${endHHmm}`;

      return {
        ...cita,
        nombrePaciente: pacRes.rows[0]?.nombre_completo || 'Paciente',
        correoPaciente: pacRes.rows[0]?.correo || null,
        telefonoPaciente: pacRes.rows[0]?.telefono || null,
        nombreDoctor: docRes.rows[0]?.nombre_completo || 'Doctor',
        correoDoctor: docRes.rows[0]?.correo || null,
        fecha: fechaCita,
        hora: horaRango,
      };
    });
  }

  // RF-AGE-007, RF-AGE-009, RF-AGE-013: Cambiar estado de cita con validaciones estrictas (DEF-02, DEF-04, DEF-05, DEF-11)
  async changeAppointmentState(params: {
    idCita: number;
    nuevoEstado: EstadoCita;
    idUsuarioGestor: number;
    motivo: string;
    liberarBloques?: boolean;
    isAdmin?: boolean;
  }) {
    const allowedStates = [
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
    if (!allowedStates.includes(params.nuevoEstado)) {
      const err: any = new Error(`Estado de cita '${params.nuevoEstado}' no es válido.`);
      err.status = 400;
      throw err;
    }

    return db.withTransaction(async (client) => {
      const currentRes = await client.query(
        `SELECT * FROM public.cita WHERE id_cita = $1 FOR UPDATE;`,
        [params.idCita]
      );
      if (currentRes.rows.length === 0) throw new Error('La cita no existe.');
      const citaActual = currentRes.rows[0];

      if (['Cancelada', 'No asistió', 'Completada', 'Rechazada'].includes(citaActual.estado)) {
        throw new Error(
          `La cita se encuentra en estado final '${citaActual.estado}' y no permite cambios de estado posteriores.`
        );
      }

      if (citaActual.estado === params.nuevoEstado) {
        return citaActual;
      }

      if (params.nuevoEstado === 'No asistió' || params.nuevoEstado === 'Inasistencia') {
        if (citaActual.estado !== 'Confirmada' && citaActual.estado !== 'En espera') {
          throw new Error(`Solo se puede registrar inasistencia en citas en estado 'Confirmada' o 'En espera'.`);
        }
        // Validar que la hora programada ya haya llegado (DEF-05 / CPS-AGE-013-01)
        const bcCheck = await client.query(
          `SELECT id_bloque FROM public.bloques_citas WHERE id_cita = $1 ORDER BY id_bloque ASC LIMIT 1;`,
          [params.idCita]
        );
        if (bcCheck.rows.length > 0) {
          const startTime = new Date(bcCheck.rows[0].id_bloque);
          if (startTime.getTime() > Date.now()) {
            throw new Error('No se puede marcar inasistencia antes de la fecha y hora programada de la cita.');
          }
        }
      }

      if (params.nuevoEstado === 'Cancelada') {
        if (!params.motivo || !params.motivo.trim()) {
          throw new Error('El motivo de cancelación es obligatorio.');
        }
        if (citaActual.estado !== 'Confirmada' && citaActual.estado !== 'En espera' && citaActual.estado !== 'Solicitada') {
          throw new Error(`Solo se pueden cancelar citas en estado 'Confirmada', 'En espera' o 'Solicitada'.`);
        }
      }

      // Finalizar atención requiere motivo de consulta en historia clínica (DEF-04 / CPS-AGE-009-02)
      if (params.nuevoEstado === 'Completada' || params.nuevoEstado === 'Atendida') {
        const evoRes = await client.query(
          `SELECT motivo_consulta FROM public.evolucion WHERE id_cita = $1 AND TRIM(COALESCE(motivo_consulta, '')) != '' LIMIT 1;`,
          [params.idCita]
        );
        if (evoRes.rows.length === 0) {
          throw new Error('No se puede finalizar la atención sin registrar el motivo de consulta en la historia clínica.');
        }
      }

      // Solo el profesional responsable inicia la atención (DEF-02 / CPS-AGE-009-03)
      if (params.nuevoEstado === 'En consulta') {
        if (
          params.idUsuarioGestor &&
          citaActual.id_usuario &&
          citaActual.id_usuario !== params.idUsuarioGestor &&
          !params.isAdmin
        ) {
          const err: any = new Error('Solo el profesional responsable asignado a la cita puede iniciar la atención.');
          err.status = 403;
          throw err;
        }
        const doctorIdToCheck = citaActual.id_usuario || params.idUsuarioGestor;
        const activeRes = await client.query(
          `SELECT id_cita FROM public.cita WHERE id_usuario = $1 AND estado = 'En consulta' AND id_cita != $2;`,
          [doctorIdToCheck, params.idCita]
        );
        if (activeRes.rows.length > 0) {
          throw new Error('El profesional ya tiene otra cita En consulta activa.');
        }
      }

      const updateRes = await client.query(
        `UPDATE public.cita 
         SET estado = $1, 
             id_usuario = COALESCE(id_usuario, $3)
         WHERE id_cita = $2 
         RETURNING *;`,
        [params.nuevoEstado, params.idCita, params.idUsuarioGestor || null]
      );

      if (params.nuevoEstado === 'Cancelada' && params.liberarBloques !== false) {
        await client.query(
          `UPDATE public.bloques_horario 
           SET ocupacion = FALSE 
           WHERE inicio IN (SELECT id_bloque FROM public.bloques_citas WHERE id_cita = $1);`,
          [params.idCita]
        );
      }

      await client.query(
        `INSERT INTO public.historial_cita (id_cita, id_usuario_gestor, reporte, motivo)
         VALUES ($1, $2, $3, $4);`,
        [
          params.idCita,
          params.idUsuarioGestor,
          `Cambio de estado: ${citaActual.estado} -> ${params.nuevoEstado}`,
          params.motivo,
        ]
      );

      // Obtener datos del paciente y doctor para notificaciones
      const detailRes = await client.query(
        `SELECT p.nombre_completo AS "nombrePaciente", p.correo AS "correoPaciente",
                u.nombre_completo AS "nombreDoctor", u.correo AS "correoDoctor"
         FROM public.cita c
         JOIN public.paciente p ON c.id_paciente = p.id_paciente
         JOIN public.usuario u ON c.id_usuario = u.id_usuario
         WHERE c.id_cita = $1;`,
        [params.idCita]
      );

      const bcRes = await client.query(
        `SELECT to_char(id_bloque, 'YYYY-MM-DD HH24:MI:SS') AS id_bloque FROM public.bloques_citas WHERE id_cita = $1 ORDER BY id_bloque ASC;`,
        [params.idCita]
      );
      const bList = bcRes.rows.map((r: any) => r.id_bloque);
      const fecha = bList.length > 0 ? bList[0].split(' ')[0] : 'Por confirmar';
      const hora = bList.length > 0 ? (bList[0].split(' ')[1] || '').slice(0, 5) : 'Por confirmar';

      return {
        ...updateRes.rows[0],
        nombrePaciente: detailRes.rows[0]?.nombrePaciente || 'Paciente',
        correoPaciente: detailRes.rows[0]?.correoPaciente || null,
        nombreDoctor: detailRes.rows[0]?.nombreDoctor || 'Doctor',
        correoDoctor: detailRes.rows[0]?.correoDoctor || null,
        fecha,
        hora,
      };
    });
  }

  // RF-AGE-006: Editar cita confirmada
  async updateAppointmentDetails(params: {
    idCita: number;
    idUsuarioGestor: number;
    idDoctor?: number;
    titulo?: string;
    descripcion?: string;
    selectedBlocks?: string[];
    motivo?: string;
  }) {
    return db.withTransaction(async (client) => {
      const currentRes = await client.query(
        `SELECT c.*, p.nombre_completo AS "nombrePaciente", p.correo AS "correoPaciente", p.telefono AS "telefonoPaciente"
         FROM public.cita c
         JOIN public.paciente p ON c.id_paciente = p.id_paciente
         WHERE c.id_cita = $1 FOR UPDATE;`,
        [params.idCita]
      );
      if (currentRes.rows.length === 0) throw new Error('La cita no existe.');
      const cita = currentRes.rows[0];

      if (cita.estado !== 'Confirmada') {
        throw new Error(
          `Las citas en estado '${cita.estado}' no pueden ser editadas. Solo se pueden modificar citas en estado Confirmada (RF-AGE-006).`
        );
      }

      const targetDoctorId = params.idDoctor || cita.id_usuario;

      await client.query(
        `UPDATE public.cita
         SET titulo = COALESCE($2, titulo),
             descripcion = COALESCE($3, descripcion),
             id_usuario = COALESCE($4, id_usuario)
         WHERE id_cita = $1;`,
        [params.idCita, params.titulo ? params.titulo.slice(0, 50) : null, params.descripcion, targetDoctorId]
      );

      if (params.selectedBlocks && params.selectedBlocks.length > 0) {
        const currentBcRes = await client.query(
          `SELECT to_char(id_bloque, 'YYYY-MM-DD HH24:MI:SS') AS id_bloque FROM public.bloques_citas WHERE id_cita = $1;`,
          [params.idCita]
        );
        const currentBlocks: string[] = currentBcRes.rows.map((r: any) => r.id_bloque);
        const newBlocks: string[] = params.selectedBlocks.map((b) =>
          String(b).replace('T', ' ').slice(0, 19)
        );

        const blocksToRelease = currentBlocks.filter((b) => !newBlocks.includes(b));
        for (const b of blocksToRelease) {
          await client.query(
            `UPDATE public.bloques_horario SET ocupacion = FALSE WHERE inicio = $1;`,
            [b]
          );
          await client.query(
            `DELETE FROM public.bloques_citas WHERE id_cita = $1 AND id_bloque = $2;`,
            [params.idCita, b]
          );
        }

        const blocksToOccupy = newBlocks.filter((b) => !currentBlocks.includes(b));
        for (const b of blocksToOccupy) {
          const slotCheck = await client.query<TimeSlotRow>(
            `SELECT inicio, final, estado, ocupacion FROM public.bloques_horario WHERE inicio = $1 FOR UPDATE;`,
            [b]
          );

          if (slotCheck.rows.length === 0) {
            const bDate = new Date(b);
            const bEndDate = new Date(bDate.getTime() + 30 * 60 * 1000);
            const bEndStr = `${bEndDate.getFullYear()}-${(bEndDate.getMonth() + 1).toString().padStart(2, '0')}-${bEndDate.getDate().toString().padStart(2, '0')} ${bEndDate.getHours().toString().padStart(2, '0')}:${bEndDate.getMinutes().toString().padStart(2, '0')}:00`;

            await client.query(
              `INSERT INTO public.bloques_horario (inicio, final, estado, ocupacion) VALUES ($1, $2, TRUE, TRUE);`,
              [b, bEndStr]
            );
          } else {
            if (!slotCheck.rows[0].estado) {
              throw new Error(`El bloque ${b} se encuentra deshabilitado.`);
            }
            if (slotCheck.rows[0].ocupacion) {
              throw new Error(`El bloque ${b} ya se encuentra ocupado por otra cita.`);
            }
            await client.query(
              `UPDATE public.bloques_horario SET ocupacion = TRUE WHERE inicio = $1;`,
              [b]
            );
          }

          await client.query(
            `INSERT INTO public.bloques_citas (id_bloque, id_cita) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
            [b, params.idCita]
          );
        }
      }

      await client.query(
        `INSERT INTO public.historial_cita (id_cita, id_usuario_gestor, reporte, motivo)
         VALUES ($1, $2, 'Cita modificada / reprogramada', $3);`,
        [params.idCita, params.idUsuarioGestor, params.motivo || 'Modificación de detalles y/o bloques de la cita']
      );

      const updatedRes = await client.query(
        `SELECT c.*, u.nombre_completo AS "nombreDoctor", u.correo AS "correoDoctor"
         FROM public.cita c
         JOIN public.usuario u ON c.id_usuario = u.id_usuario
         WHERE c.id_cita = $1;`,
        [params.idCita]
      );

      const finalBcRes = await client.query(
        `SELECT to_char(id_bloque, 'YYYY-MM-DD HH24:MI:SS') AS id_bloque 
         FROM public.bloques_citas 
         WHERE id_cita = $1 
         ORDER BY id_bloque ASC;`,
        [params.idCita]
      );
      const finalBlocks: string[] = finalBcRes.rows.map((r: any) => r.id_bloque);
      let fechaCita = 'Fecha por confirmar';
      let horaRango = 'Horario por confirmar';
      if (finalBlocks.length > 0) {
        const first = finalBlocks[0];
        const last = finalBlocks[finalBlocks.length - 1];
        fechaCita = first.split(' ')[0];
        const startHHmm = (first.split(' ')[1] || '').slice(0, 5);
        const lastDate = new Date(last);
        const endDate = new Date(lastDate.getTime() + 30 * 60 * 1000);
        const endHHmm = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
        horaRango = `${startHHmm} - ${endHHmm}`;
      }

      return {
        ...updatedRes.rows[0],
        correoPaciente: cita.correoPaciente,
        nombrePaciente: cita.nombrePaciente,
        telefonoPaciente: cita.telefonoPaciente,
        fecha: fechaCita,
        hora: horaRango,
      };
    });
  }

  // RF-AGE-004: Obtener personal a notificar ante solicitudes externas con escalado COA -> AUX -> ADM (DEF-09 / CPS-AGE-004-02)
  async getStaffForNewRequestNotification(): Promise<
    Array<{ nombreCompleto: string; correo: string; rol: string }>
  > {
    // 1. Coordinadores de agendamiento activos
    const coaRes = await db.query(
      `SELECT DISTINCT u.nombre_completo AS "nombreCompleto", u.correo, r.nombre_rol AS "rol"
       FROM public.usuario u
       JOIN public.usuario_rol ur ON u.id_usuario = ur.id_usuario
       JOIN public.rol r ON ur.id_rol = r.id_rol
       WHERE (LOWER(r.nombre_rol) LIKE '%coordinad%' OR LOWER(r.nombre_rol) LIKE '%agend%' OR r.codigo_rol = 'ROL-COA')
         AND u.estado = true AND ur.estado = true;`
    );

    if (coaRes.rows.length > 0) {
      return coaRes.rows;
    }

    // 2. Si la coordinadora está inactiva, recurrir a auxiliares (DEF-09 / CPS-AGE-004-02)
    const auxRes = await db.query(
      `SELECT DISTINCT u.nombre_completo AS "nombreCompleto", u.correo, r.nombre_rol AS "rol"
       FROM public.usuario u
       JOIN public.usuario_rol ur ON u.id_usuario = ur.id_usuario
       JOIN public.rol r ON ur.id_rol = r.id_rol
       WHERE (LOWER(r.nombre_rol) LIKE '%auxiliar%' OR r.codigo_rol = 'ROL-AUX')
         AND u.estado = true AND ur.estado = true;`
    );

    if (auxRes.rows.length > 0) {
      return auxRes.rows;
    }

    // 3. Administradores del sistema
    const admRes = await db.query(
      `SELECT DISTINCT u.nombre_completo AS "nombreCompleto", u.correo, r.nombre_rol AS "rol"
       FROM public.usuario u
       JOIN public.usuario_rol ur ON u.id_usuario = ur.id_usuario
       JOIN public.rol r ON ur.id_rol = r.id_rol
       WHERE (LOWER(r.nombre_rol) LIKE '%administrad%' OR LOWER(r.nombre_rol) LIKE '%admin%' OR r.codigo_rol = 'ROL-ADM')
         AND u.estado = true AND ur.estado = true;`
    );

    return admRes.rows;
  }

  // RF-AGE-008: Consultar agenda con paciente, bloques e historial
  async getAgenda(idProfesional?: number, idPaciente?: number, fecha?: string) {
    const conditions: string[] = [];
    const params: any[] = [];
    if (idProfesional) {
      params.push(idProfesional);
      conditions.push(`c.id_usuario = $${params.length}`);
    }
    if (idPaciente) {
      params.push(idPaciente);
      conditions.push(`c.id_paciente = $${params.length}`);
    }
    if (fecha) {
      params.push(`${fecha}%`);
      conditions.push(`bc.id_bloque::text LIKE $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        c.id_cita AS "idCita",
        c.titulo,
        c.descripcion,
        c.estado,
        c.titulo AS "servicio",
        p.id_paciente AS "idPaciente",
        COALESCE(sc.nombre_solicitante, p.nombre_completo) AS "nombrePaciente",
        COALESCE(sc.documento_solicitante, p.documento_identidad) AS "documentoPaciente",
        COALESCE(sc.telefono_solicitante, p.telefono, '+57 318 459 2011') AS "telefonoPaciente",
        COALESCE(sc.correo_solicitante, p.correo, 'paciente@odontoleal.com') AS "correoPaciente",
        sc.id_solicitud AS "idSolicitud",
        sc.fecha_solicitud AS "fechaSolicitud",
        COALESCE(sc.fecha_nacimiento::text, p.fecha_nacimiento::text) AS "fechaNacimiento",
        COALESCE(sc.sexo, p.sexo) AS "sexo",
        CASE WHEN p.id_paciente IS NULL OR p.documento_identidad != sc.documento_solicitante THEN true ELSE false END AS "esPacienteNuevo",
        u.id_usuario AS "idProfesional",
        u.nombre_completo AS "nombreProfesional",
        u.firma_base64 AS "firmaProfesional",
        COALESCE(json_agg(DISTINCT to_char(bc.id_bloque, 'YYYY-MM-DD HH24:MI:SS')) FILTER (WHERE bc.id_bloque IS NOT NULL), '[]') AS bloques,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'idCambio', hc.id_cambio_cita,
              'idUsuarioGestor', hc.id_usuario_gestor,
              'fecha', hc.fecha_historial,
              'reporte', hc.reporte,
              'motivo', hc.motivo
            )
          ) FILTER (WHERE hc.id_cambio_cita IS NOT NULL), '[]'
        ) AS historial
      FROM public.cita c
      INNER JOIN public.paciente p ON c.id_paciente = p.id_paciente
      INNER JOIN public.usuario u ON c.id_usuario = u.id_usuario
      LEFT JOIN public.bloques_citas bc ON c.id_cita = bc.id_cita
      LEFT JOIN public.solicitud_cita sc ON (sc.bloque_solicitado = bc.id_bloque AND sc.estado = true)
      LEFT JOIN public.historial_cita hc ON c.id_cita = hc.id_cita
      ${where}
      GROUP BY c.id_cita, p.id_paciente, u.id_usuario, u.firma_base64, sc.id_solicitud, sc.nombre_solicitante,
               sc.documento_solicitante, sc.telefono_solicitante, sc.correo_solicitante,
               sc.fecha_solicitud, sc.fecha_nacimiento, sc.sexo
      ORDER BY c.id_cita DESC;
    `;
    const { rows } = await db.query(sql, params);
    return rows;
  }

  // Resumen mensual de citas y bloques para el calendario lateral izquierdo
  async getMonthlySummary(year: number, month: number): Promise<MonthlyDaySummary[]> {
    const monthStr = month.toString().padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;

    const sql = `
      SELECT 
        to_char(d.day, 'YYYY-MM-DD') AS fecha,
        EXTRACT(DAY FROM d.day)::int AS dia,
        COALESCE(citas.total_citas, 0)::int AS "totalCitas",
        COALESCE(bloques.total_bloques, 0)::int AS "totalBloques",
        CASE WHEN COALESCE(bloques.total_bloques, 0) = 0 THEN true ELSE false END AS "sinBloques"
      FROM generate_series(
        $1::date,
        ($1::date + interval '1 month' - interval '1 day')::date,
        interval '1 day'
      ) AS d(day)
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
      ORDER BY d.day ASC;
    `;
    const { rows } = await db.query<MonthlyDaySummary>(sql, [startDate]);
    return rows;
  }

  // Obtener solicitudes pendientes registradas en solicitud_cita
  async getRequests(idSolicitud?: number) {
    const params: any[] = [];
    let where = 'WHERE sc.estado = true';
    if (idSolicitud) {
      params.push(idSolicitud);
      where += ` AND sc.id_solicitud = $${params.length}`;
    }
    const sql = `
      SELECT 
        sc.id_solicitud AS "idSolicitud",
        sc.nombre_solicitante AS "nombrePaciente",
        sc.documento_solicitante AS "documentoIdentidad",
        sc.correo_solicitante AS "correo",
        COALESCE(sc.telefono_solicitante, p.telefono, '+57 318 459 2011') AS "telefono",
        to_char(sc.bloque_solicitado, 'YYYY-MM-DD') AS "fechaSolicitada",
        to_char(sc.bloque_solicitado, 'HH24:MI') AS "horaSolicitada",
        sc.bloque_solicitado AS "bloqueSolicitado",
        sc.descripcion AS "motivoConsulta",
        sc.fecha_solicitud AS "fechaSolicitud",
        COALESCE(sc.fecha_nacimiento::text, p.fecha_nacimiento::text) AS "fechaNacimiento",
        COALESCE(sc.sexo, p.sexo) AS "sexo",
        CASE WHEN p.id_paciente IS NULL THEN true ELSE false END AS "esPacienteNuevo",
        c.id_cita AS "idCita",
        u.nombre_completo AS "doctorAsignado"
      FROM public.solicitud_cita sc
      LEFT JOIN public.paciente p ON p.documento_identidad = sc.documento_solicitante
      LEFT JOIN public.bloques_citas bc ON bc.id_bloque = sc.bloque_solicitado
      LEFT JOIN public.cita c ON c.id_cita = bc.id_cita
      LEFT JOIN public.usuario u ON u.id_usuario = c.id_usuario
      ${where}
      ORDER BY sc.bloque_solicitado ASC;
    `;
    const { rows } = await db.query(sql, params);
    return rows;
  }

  async getRequestById(idSolicitud: number) {
    const rows = await this.getRequests(idSolicitud);
    return rows[0] || null;
  }
}
