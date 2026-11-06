// src/shared/infrastructure/services/cron.service.ts
import { db } from '../database/database';
import { auditLog } from '../audit/audit-log.service';
import { MailerService } from '../mail/mailer.service';
import { formatColombiaDate, formatColombiaTime } from '../../domain/colombia-format';
import { AppointmentRepository } from '../../../modules/appointments/infrastructure/appointment.repository';
import {
  getNowColombiaTimestamp,
  getTodayColombiaDate,
} from '../../../modules/appointments/infrastructure/helpers/appointment-state.validator';

const SISTEMA = 'Sistema';

/**
 * Tareas automáticas del Sistema (RF-AGE-004, RF-AGE-010, RF-AGE-011).
 *
 * - Se ejecutan cada minuto (demora máxima de 5 minutos de la ERS).
 * - Cada cambio va en su propia transacción, con historial a nombre del
 *   usuario técnico "Sistema" y entrada de auditoría (Regla de Negocio 9).
 * - Todo el estado vive en la BD (recordatorio en `cita`, aviso diario en la
 *   auditoría): un reinicio del servidor no repite ni pierde envíos.
 * - `now` se puede inyectar para probar con la hora simulada.
 */
export class CronService {
  private static timer: NodeJS.Timeout | null = null;
  private static running = false;
  private static sistemaId: number | null = null;

  public static start(intervalMs: number = 60 * 1000): void {
    if (this.timer) return;
    const tick = () => {
      if (this.running) return;
      this.running = true;
      this.runAllJobs()
        .catch((err) => console.error('Error en tareas programadas:', err?.message ?? err))
        .finally(() => {
          this.running = false;
        });
    };
    tick();
    this.timer = setInterval(tick, intervalMs);
    console.log('⏰ Tareas programadas iniciadas.');
  }

  public static stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  public static async runAllJobs(now: Date = new Date()): Promise<void> {
    await this.cancelUnmanagedRequests(now);
    await this.markUnstartedAsNoShow(now);
    await this.closeOpenConsultations(now);
    await this.send24HourReminders(now);
    await this.sendDailyDigest(now);
  }

  private static async getSistemaId(): Promise<number> {
    if (this.sistemaId) return this.sistemaId;
    const { rows } = await db.query<{ id_usuario: number }>(
      `SELECT id_usuario FROM public.usuario WHERE es_sistema = true ORDER BY id_usuario LIMIT 1;`
    );
    if (!rows[0]) throw new Error('No existe el usuario técnico "Sistema" (aplique las migraciones).');
    this.sistemaId = rows[0].id_usuario;
    return this.sistemaId;
  }

  // ---------------------------------------------------------------------------
  // RF-AGE-010: Solicitada sin gestionar a las 00:00 del día solicitado → Cancelada
  // ---------------------------------------------------------------------------
  public static async cancelUnmanagedRequests(now: Date = new Date()): Promise<number> {
    const today = getTodayColombiaDate(now);
    const { rows } = await db.query<{ id_solicitud: number }>(
      `SELECT id_solicitud FROM public.solicitud_cita
        WHERE estado = true AND bloque_solicitado::date <= $1::date;`,
      [today]
    );
    const sistemaId = await this.getSistemaId();
    const motivo = 'No se realizó gestión de esta cita';
    let total = 0;

    for (const { id_solicitud } of rows) {
      const solicitud = await db.withTransaction(async (client) => {
        const res = await client.query(
          `SELECT id_solicitud, correo_solicitante, nombre_solicitante,
                  to_char(bloque_solicitado, 'YYYY-MM-DD HH24:MI:SS') AS bloque
             FROM public.solicitud_cita
            WHERE id_solicitud = $1 AND estado = true
            FOR UPDATE;`,
          [id_solicitud]
        );
        if (res.rows.length === 0) return null;
        const sol = res.rows[0];
        await client.query(`UPDATE public.solicitud_cita SET estado = false WHERE id_solicitud = $1;`, [id_solicitud]);
        await client.query(`UPDATE public.bloques_horario SET ocupacion = false WHERE inicio = $1;`, [sol.bloque]);
        await client.query(
          `INSERT INTO public.historial_solicitud (id_solicitud, id_usuario_gestor, reporte, motivo)
           VALUES ($1, $2, 'Cancelada automáticamente por el Sistema', $3);`,
          [id_solicitud, sistemaId, motivo]
        );
        await auditLog.record(
          {
            idUsuario: sistemaId,
            actor: SISTEMA,
            accion: 'CAMBIAR_ESTADO',
            entidad: 'solicitud_cita',
            idRegistro: id_solicitud,
            valorAnterior: { estado: 'Solicitada' },
            valorNuevo: { estado: 'Cancelada', motivo },
          },
          client
        );
        return sol;
      });

      if (solicitud) {
        total++;
        const [fecha, hora] = String(solicitud.bloque).split(' ');
        await new MailerService().sendGenericEmail({
          to: solicitud.correo_solicitante,
          subject: `Solicitud de cita cancelada - ${formatColombiaDate(fecha)}`,
          html: `<h2>Hola, ${solicitud.nombre_solicitante}</h2>
                 <p>Su solicitud de cita para el <strong>${formatColombiaDate(fecha)}</strong> a las
                 <strong>${formatColombiaTime(hora.slice(0, 5))}</strong> fue cancelada.</p>
                 <p><strong>Motivo:</strong> ${motivo}.</p>
                 <p>Puede enviar una nueva solicitud o comunicarse con el consultorio.</p>`,
          text: `Su solicitud de cita para el ${formatColombiaDate(fecha)} fue cancelada. Motivo: ${motivo}.`,
        });
      }
    }
    return total;
  }

  /** Cambia el estado de una cita por el Sistema, con historial y auditoría en una transacción. */
  private static async systemStateChange(
    idCita: number,
    estadoEsperado: string,
    nuevoEstado: string,
    motivo: string,
    sistemaId: number
  ): Promise<boolean> {
    return db.withTransaction(async (client) => {
      const res = await client.query(
        `UPDATE public.cita
            SET estado = $1,
                recordatorio_estado = CASE WHEN recordatorio_estado = 'Pendiente' THEN 'Anulado' ELSE recordatorio_estado END
          WHERE id_cita = $2 AND estado = $3
          RETURNING id_cita;`,
        [nuevoEstado, idCita, estadoEsperado]
      );
      if (res.rows.length === 0) return false;
      await client.query(
        `INSERT INTO public.historial_cita (id_cita, id_usuario_gestor, reporte, motivo)
         VALUES ($1, $2, $3, $4);`,
        [idCita, sistemaId, `Cambio automático: ${estadoEsperado} -> ${nuevoEstado}`, motivo]
      );
      await auditLog.record(
        {
          idUsuario: sistemaId,
          actor: SISTEMA,
          accion: 'CAMBIAR_ESTADO',
          entidad: 'cita',
          idRegistro: idCita,
          valorAnterior: { estado: estadoEsperado },
          valorNuevo: { estado: nuevoEstado, motivo },
        },
        client
      );
      return true;
    });
  }

  /** Citas en `estado` cuyo día (primer bloque) ya terminó (después de las 23:59). */
  private static async citasDeDiasCerrados(estado: string, now: Date): Promise<number[]> {
    const { rows } = await db.query<{ id_cita: number }>(
      `SELECT c.id_cita
         FROM public.cita c
         JOIN public.bloques_citas bc ON bc.id_cita = c.id_cita
        WHERE c.estado = $1
        GROUP BY c.id_cita
       HAVING MIN(bc.id_bloque)::date < $2::date;`,
      [estado, getTodayColombiaDate(now)]
    );
    return rows.map((r) => r.id_cita);
  }

  // RF-AGE-010: Confirmada sin iniciar a las 23:59 → Inasistencia (sin liberar bloques)
  public static async markUnstartedAsNoShow(now: Date = new Date()): Promise<number> {
    const sistemaId = await this.getSistemaId();
    let total = 0;
    for (const idCita of await this.citasDeDiasCerrados('Confirmada', now)) {
      if (await this.systemStateChange(idCita, 'Confirmada', 'Inasistencia', 'No se registró el inicio de la atención', sistemaId)) {
        total++;
      }
    }
    return total;
  }

  // RF-AGE-010: En consulta sin finalizar a las 23:59 → Atendida (aun sin motivo de consulta)
  public static async closeOpenConsultations(now: Date = new Date()): Promise<number> {
    const sistemaId = await this.getSistemaId();
    let total = 0;
    for (const idCita of await this.citasDeDiasCerrados('En consulta', now)) {
      if (
        await this.systemStateChange(
          idCita,
          'En consulta',
          'Atendida',
          'Cierre automático de la atención al terminar el día',
          sistemaId
        )
      ) {
        total++;
      }
    }
    return total;
  }

  // ---------------------------------------------------------------------------
  // RF-AGE-011: recordatorio 24 horas antes, uno por cita, con estado en la cita
  // ---------------------------------------------------------------------------
  public static async send24HourReminders(now: Date = new Date()): Promise<number> {
    const { rows } = await db.query<{
      id_cita: number;
      paciente: string;
      correo: string | null;
      inicio: string;
      fin: string;
      profesional: string;
      servicio: string;
    }>(
      `SELECT c.id_cita, p.nombre_completo AS paciente, p.correo,
              to_char(MIN(bc.id_bloque), 'YYYY-MM-DD HH24:MI') AS inicio,
              to_char(MAX(bc.id_bloque) + interval '30 minutes', 'HH24:MI') AS fin,
              u.nombre_completo AS profesional, c.titulo AS servicio
         FROM public.cita c
         JOIN public.paciente p ON p.id_paciente = c.id_paciente
         JOIN public.usuario u ON u.id_usuario = c.id_usuario
         JOIN public.bloques_citas bc ON bc.id_cita = c.id_cita
        WHERE c.estado = 'Confirmada' AND c.recordatorio_estado = 'Pendiente'
        GROUP BY c.id_cita, p.nombre_completo, p.correo, u.nombre_completo
       HAVING MIN(bc.id_bloque) > $1::timestamp
          AND MIN(bc.id_bloque) <= $1::timestamp + interval '24 hours';`,
      [getNowColombiaTimestamp(now)]
    );

    let enviados = 0;
    for (const row of rows) {
      let estado = 'Enviado';
      let causa: string | null = null;

      if (!row.correo) {
        estado = 'No enviado';
        causa = 'El paciente no tiene correo registrado';
      } else {
        const [fecha, hora] = row.inicio.split(' ');
        const result = await new MailerService().sendAppointmentReminderEmail({
          to: row.correo,
          nombrePaciente: row.paciente,
          fecha,
          hora: `${hora} - ${row.fin}`,
          doctor: row.profesional,
          servicio: row.servicio,
        });
        if (result.failed) {
          estado = 'No enviado';
          causa = 'Falla del servicio de correo';
        }
      }

      await db.query(
        `UPDATE public.cita
            SET recordatorio_estado = $1, recordatorio_causa = $2, recordatorio_fecha = now()
          WHERE id_cita = $3 AND recordatorio_estado = 'Pendiente';`,
        [estado, causa, row.id_cita]
      );
      if (estado === 'Enviado') enviados++;
    }
    return enviados;
  }

  // ---------------------------------------------------------------------------
  // RF-AGE-004: aviso diario de las 7:00 a. m. con solicitudes a 5 días o menos
  // ---------------------------------------------------------------------------
  public static async sendDailyDigest(now: Date = new Date()): Promise<boolean> {
    const nowStr = getNowColombiaTimestamp(now);
    if (nowStr.slice(11, 13) !== '07') return false;
    const today = nowStr.slice(0, 10);

    const already = await db.query(
      `SELECT 1 FROM public.registro_auditoria
        WHERE accion = 'AVISO_DIARIO_SOLICITUDES' AND id_registro = $1 LIMIT 1;`,
      [today]
    );
    if (already.rows.length > 0) return false;

    const { rows } = await db.query<{
      id_solicitud: number;
      nombre: string;
      telefono: string | null;
      bloque: string;
      descripcion: string | null;
    }>(
      `SELECT id_solicitud, nombre_solicitante AS nombre, telefono_solicitante AS telefono,
              to_char(bloque_solicitado, 'YYYY-MM-DD HH24:MI') AS bloque, descripcion
         FROM public.solicitud_cita
        WHERE estado = true AND bloque_solicitado::date <= $1::date + 5
        ORDER BY bloque_solicitado ASC;`,
      [today]
    );
    if (rows.length === 0) return false;

    const staff = await new AppointmentRepository().getStaffForNewRequestNotification();
    if (staff.length === 0) return false;

    const items = rows
      .map((r) => {
        const [f, h] = r.bloque.split(' ');
        return `<li>#${r.id_solicitud} · ${formatColombiaDate(f)} ${formatColombiaTime(h)} · <strong>${r.nombre}</strong> · Tel. ${r.telefono ?? 'sin teléfono'}${r.descripcion ? ` · ${r.descripcion}` : ''}</li>`;
      })
      .join('');

    for (const person of staff) {
      await new MailerService().sendGenericEmail({
        to: person.correo,
        subject: `Aviso diario ${formatColombiaDate(today)}: ${rows.length} solicitud(es) de cita sin gestionar`,
        html: `<h2>Buenos días, ${person.nombreCompleto}</h2>
               <p>Estas solicitudes de cita están a 5 días o menos y siguen sin gestionar:</p>
               <ul>${items}</ul>
               <p>Ingrese a la agenda para confirmarlas o rechazarlas.</p>`,
      });
    }

    await auditLog.record({
      idUsuario: await this.getSistemaId(),
      actor: SISTEMA,
      accion: 'AVISO_DIARIO_SOLICITUDES',
      entidad: 'solicitud_cita',
      idRegistro: today,
      detalle: { solicitudes: rows.map((r) => r.id_solicitud), destinatarios: staff.map((s) => s.correo) },
    });
    return true;
  }
}
