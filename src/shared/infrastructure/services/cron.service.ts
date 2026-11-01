// src/shared/infrastructure/services/cron.service.ts
import { db } from '../database/database';
import { MailerService } from '../mail/mailer.service';
import { AppointmentRepository } from '../../../modules/appointments/infrastructure/appointment.repository';

export class CronService {
  private static timer: NodeJS.Timeout | null = null;
  public static readonly sentReminders = new Set<number>();

  public static start(intervalMs: number = 60 * 1000): void {
    if (this.timer) return;
    // Ejecutar verificación inicial
    this.runAllJobs().catch((err) =>
      console.error('Error en ejecución inicial de tareas Cron:', err)
    );

    this.timer = setInterval(() => {
      this.runAllJobs().catch((err) =>
        console.error('Error en ejecución periódica de tareas Cron:', err)
      );
    }, intervalMs);

    console.log('⏰ Servicio de tareas programadas (CronService) iniciado exitosamente.');
  }

  public static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public static async runAllJobs(): Promise<void> {
    await this.cancelExpiredSolicitadaRequests();
    await this.markPastConfirmadasAsInasistencia();
    await this.send24HourReminders();
    await this.checkDailyMorningDigest();
  }

  // CPS-AGE-010-01 & DEF-10: Cancelar automáticamente solicitudes cuya fecha ya pasó
  public static async cancelExpiredSolicitadaRequests(): Promise<number> {
    try {
      const sql = `
        SELECT 
          sc.id_solicitud,
          sc.bloque_solicitado,
          sc.correo_solicitante as correo,
          sc.nombre_solicitante as nombre_completo,
          to_char(sc.bloque_solicitado, 'YYYY-MM-DD') as fecha,
          to_char(sc.bloque_solicitado, 'HH24:MI') as hora_inicio
        FROM public.solicitud_cita sc
        JOIN public.bloques_horario bh ON sc.bloque_solicitado = bh.inicio
        WHERE sc.estado = true
          AND bh.inicio < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota');
      `;
      const { rows } = await db.query(sql);

      for (const row of rows) {
        await db.query(
          `UPDATE public.solicitud_cita SET estado = false WHERE id_solicitud = $1;`,
          [row.id_solicitud]
        );

        await db.query(
          `INSERT INTO public.historial_solicitud (id_solicitud, id_usuario_gestor, reporte, motivo)
           VALUES ($1, 1, 'Cancelación automática por expiración de fecha', 'Expiración');`,
          [row.id_solicitud]
        );

        if (row.bloque_solicitado) {
          await db.query(
            `UPDATE public.bloques_horario SET ocupacion = false WHERE inicio = $1;`,
            [row.bloque_solicitado]
          );
        }

        if (row.correo) {
          const mailer = new MailerService();
          await mailer.sendGenericEmail({
            to: row.correo,
            subject: 'Solicitud de Cita Cancelada por Expiración - OdontoLeal',
            html: `
              <h2>Estimado(a) ${row.nombre_completo}</h2>
              <p>Le informamos que su solicitud de cita para el día ${row.fecha} a las ${row.hora_inicio} ha sido cancelada automáticamente debido a que no fue confirmada con la anticipación requerida.</p>
              <p>Lo invitamos a ingresar nuevamente a nuestro portal público para agendar un nuevo horario de su preferencia.</p>
            `,
          }).catch(() => {});
        }
      }

      return rows.length;
    } catch (error) {
      console.error('Error en cancelExpiredSolicitadaRequests:', error);
      return 0;
    }
  }

  // CPS-AGE-010-02 & DEF-10: Pasar citas Confirmadas que no se atendieron a Inasistencia al cierre del día (23:59)
  public static async markPastConfirmadasAsInasistencia(): Promise<number> {
    try {
      const sql = `
        SELECT 
          c.id_cita,
          c.id_usuario,
          bh.final
        FROM public.cita c
        JOIN public.bloques_citas bc ON c.id_cita = bc.id_cita
        JOIN public.bloques_horario bh ON bc.id_bloque = bh.inicio
        WHERE c.estado = 'Confirmada'
          AND bh.final < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota');
      `;
      const { rows } = await db.query(sql);

      for (const row of rows) {
        await db.query(
          `UPDATE public.cita SET estado = 'Inasistencia' WHERE id_cita = $1;`,
          [row.id_cita]
        );

        await db.query(
          `INSERT INTO public.historial_cita (id_cita, id_usuario_gestor, reporte, motivo)
           VALUES ($1, NULL, 'Cierre automático por inasistencia al término de la jornada (23:59 UTC-5).', 'Inasistencia automática');`,
          [row.id_cita]
        );
      }

      return rows.length;
    } catch (error) {
      console.error('Error en markPastConfirmadasAsInasistencia:', error);
      return 0;
    }
  }

  // CPS-AGE-011-01 & DEF-10: Enviar recordatorio 24 horas antes de la cita
  public static async send24HourReminders(): Promise<number> {
    try {
      const sql = `
        SELECT 
          c.id_cita,
          p.nombre_completo as paciente_nombre,
          p.correo as paciente_correo,
          to_char(bh.inicio, 'YYYY-MM-DD') as fecha,
          to_char(bh.inicio, 'HH24:MI') as hora_inicio,
          u.nombre_completo as doctor_nombre
        FROM public.cita c
        JOIN public.paciente p ON c.id_paciente = p.id_paciente
        JOIN public.usuario u ON c.id_usuario = u.id_usuario
        JOIN public.bloques_citas bc ON c.id_cita = bc.id_cita
        JOIN public.bloques_horario bh ON bc.id_bloque = bh.inicio
        WHERE c.estado = 'Confirmada'
          AND bh.inicio BETWEEN (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota') 
                            AND ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota') + INTERVAL '28 hours');
      `;
      const { rows } = await db.query(sql);

      let sentCount = 0;
      for (const row of rows) {
        if (this.sentReminders.has(row.id_cita)) continue;

        this.sentReminders.add(row.id_cita);
        sentCount++;

        if (row.paciente_correo) {
          const mailer = new MailerService();
          await mailer.sendGenericEmail({
            to: row.paciente_correo,
            subject: 'Recordatorio de Cita Odontológica - OdontoLeal',
            html: `
              <h2>Hola, ${row.paciente_nombre}</h2>
              <p>Le recordamos su cita odontológica programada para el día <strong>${row.fecha}</strong> a las <strong>${row.hora_inicio}</strong> con el/la especialista <strong>${row.doctor_nombre}</strong>.</p>
              <p>Por favor llegar con 10 minutos de antelación.</p>
            `,
          }).catch(() => {});
        }
      }

      return sentCount;
    } catch (error) {
      console.error('Error en send24HourReminders:', error);
      return 0;
    }
  }

  // CPS-AGE-004-03 & DEF-10: Resumen diario de las 7:00 a. m. con solicitudes sin gestionar
  private static lastDigestDate: string = '';

  public static async checkDailyMorningDigest(): Promise<boolean> {
    try {
      const now = new Date();
      // Hora en Colombia (UTC-5)
      const offsetMs = -5 * 60 * 60 * 1000;
      const colTime = new Date(now.getTime() + offsetMs);
      const colHours = colTime.getUTCHours();
      const colDateStr = colTime.toISOString().split('T')[0];

      // Ejecutar a las 7:00 a. m.
      if (colHours !== 7) {
        return false;
      }

      if (this.lastDigestDate === colDateStr) {
        return false; // Ya se envió hoy
      }

      const sql = `
        SELECT id_solicitud, nombre_completo, correo, telefono, motivo, servicio, fecha_creacion
        FROM public.solicitud_cita
        WHERE estado = 'Solicitada'
        ORDER BY fecha_creacion ASC;
      `;
      const { rows } = await db.query(sql);
      if (rows.length === 0) return false;

      // Obtener destinatario por jerarquía de roles (COA -> AUX -> ADM)
      const appointmentRepo = new AppointmentRepository();
      const staffList = await appointmentRepo.getStaffForNewRequestNotification();
      if (!staffList || staffList.length === 0) return false;
      const targetStaff = staffList[0];
      if (!targetStaff.correo) return false;

      const itemsHtml = rows
        .map(
          (r: any) =>
            `<li><strong>${r.nombre_completo}</strong> (${r.servicio || 'General'}): ${r.motivo || 'Sin motivo'} - Tel: ${r.telefono}</li>`
        )
        .join('');

      const mailer = new MailerService();
      await mailer.sendGenericEmail({
        to: targetStaff.correo,
        subject: `[Resumen Diario 7:00 AM] ${rows.length} Solicitudes de Cita Pendientes - OdontoLeal`,
        html: `
          <h2>Buenos días, ${targetStaff.nombreCompleto}</h2>
          <p>Se encuentran <strong>${rows.length}</strong> solicitudes de cita pendientes de gestión en el sistema:</p>
          <ul>${itemsHtml}</ul>
          <p>Por favor ingrese al sistema para confirmar o reprogramar estas solicitudes.</p>
        `,
      }).catch(() => {});

      this.lastDigestDate = colDateStr;
      return true;
    } catch (error) {
      console.error('Error en checkDailyMorningDigest:', error);
      return false;
    }
  }
}
