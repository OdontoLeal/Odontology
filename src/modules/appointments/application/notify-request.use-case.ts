// src/modules/appointments/application/notify-request.use-case.ts
import { ColombiaTime } from '../../../shared/domain/colombia-time.util';
import {
  IAppointmentAuditLoggerPort,
  IAppointmentMailerPort,
  IAppointmentRepository,
  ProfessionalStaffDTO,
} from '../domain/appointment.repository.interface';

export interface NotifyNewRequestCommand {
  idSolicitud: number;
}

export interface NotifyRequestResult {
  enviado: boolean;
  destinatariosNotificados: string[];
  rolDestinatario: string;
  reintentosRealizados: number;
  error?: string;
}

export class NotifyRequestUseCase {
  public static readonly MAX_RETRIES = 3; // 3 reintentos (RF-AGE-004 / RQNF-FIA-004)
  public static readonly RETRY_DELAY_MS = 5 * 60 * 1000; // Cada 5 minutos

  constructor(
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly mailer?: IAppointmentMailerPort,
    private readonly auditLogger?: IAppointmentAuditLoggerPort
  ) {}

  /**
   * RF-AGE-004: Envía correo en máximo 5 minutos con los datos de la solicitud
   * siguiendo el escalado de roles: ROL-COA -> ROL-AUX -> ROL-ADM.
   */
  public async executeNotifyNewRequest(command: NotifyNewRequestCommand): Promise<NotifyRequestResult> {
    const request = await this.appointmentRepository.findRequestById(command.idSolicitud);
    if (!request) {
      throw new Error(`La solicitud con ID ${command.idSolicitud} no existe (RF-AGE-004).`);
    }

    // Resolver profesional para nombre descriptivo
    let profesionalNombre = 'Profesional asignado';
    if (request.idProfesional) {
      const profUser = await this.appointmentRepository.findUserById(request.idProfesional);
      if (profUser) {
        profesionalNombre = profUser.nombreCompleto;
      }
    }

    // Resolver destinatarios según orden de precedencia (ROL-COA -> ROL-AUX -> ROL-ADM)
    const { recipients, rolUtilizado } = await this.resolveTargetRecipients();

    if (recipients.length === 0) {
      const errorMsg = 'No se encontraron usuarios activos en el sistema con roles ROL-COA, ROL-AUX ni ROL-ADM.';
      console.warn(`⚠️ RF-AGE-004: ${errorMsg}`);
      if (this.auditLogger) {
        await this.auditLogger.log({
          usuario: 'Sistema',
          accion: 'Notificación de solicitud fallida (sin destinatarios activos)',
          registroAfectado: `solicitud:${command.idSolicitud}`,
          valorNuevo: { error: errorMsg },
        });
      }
      return {
        enviado: false,
        destinatariosNotificados: [],
        rolDestinatario: 'NINGUNO',
        reintentosRealizados: 0,
        error: errorMsg,
      };
    }

    if (!this.mailer) {
      return {
        enviado: false,
        destinatariosNotificados: recipients.map((r) => r.correo),
        rolDestinatario: rolUtilizado,
        reintentosRealizados: 0,
        error: 'Servicio de mensajería no configurado.',
      };
    }

    // Intentar envío con hasta 3 reintentos si falla (RQNF-FIA-004)
    let sendSuccess = false;
    let attemptsCount = 0;
    let lastErrorMsg = '';

    for (let attempt = 1; attempt <= NotifyRequestUseCase.MAX_RETRIES; attempt++) {
      attemptsCount = attempt;
      try {
        for (const recipient of recipients) {
          await this.mailer.sendStaffNewRequestNotificationEmail({
            to: recipient.correo,
            destinatarioNombre: recipient.nombreCompleto,
            rolDestinatario: rolUtilizado,
            nombreSolicitante: request.nombreSolicitante,
            telefonoSolicitante: request.telefonoSolicitante,
            servicio: request.servicio,
            nombreProfesional: profesionalNombre,
            fechaInicio: request.bloqueInicial,
          });
        }
        sendSuccess = true;
        break;
      } catch (err: any) {
        lastErrorMsg = err?.message || 'Error al conectar con servidor SMTP';
        console.warn(
          `⚠️ Reintento ${attempt}/${NotifyRequestUseCase.MAX_RETRIES} fallido de notificación de solicitud:`,
          lastErrorMsg
        );
      }
    }

    if (!sendSuccess && this.auditLogger) {
      await this.auditLogger.log({
        usuario: 'Sistema',
        accion: 'Envío de correo fallido (notificación nueva solicitud agotó reintentos)',
        registroAfectado: `solicitud:${command.idSolicitud}`,
        valorNuevo: {
          destinatarios: recipients.map((r) => r.correo),
          rolDestinatario: rolUtilizado,
          reintentos: attemptsCount,
          error: lastErrorMsg,
        },
      });
    }

    return {
      enviado: sendSuccess,
      destinatariosNotificados: recipients.map((r) => r.correo),
      rolDestinatario: rolUtilizado,
      reintentosRealizados: attemptsCount,
      error: sendSuccess ? undefined : lastErrorMsg,
    };
  }

  /**
   * RF-AGE-004: Envía el aviso diario a las 7:00 a. m. con las solicitudes pendientes
   * cuya fecha esté a 5 días o menos. Si no hay ninguna, no se envía.
   */
  public async executeDailyPendingRequestsSummary(now: Date = new Date()): Promise<{
    enviado: boolean;
    totalSolicitudes: number;
    destinatarios: string[];
  }> {
    // Buscar solicitudes pendientes para dentro de 5 días o menos
    const urgentRequests = await this.appointmentRepository.findPendingRequests(5);

    if (urgentRequests.length === 0) {
      console.log('ℹ️ RF-AGE-004: No hay solicitudes pendientes a 5 días o menos. No se envía aviso diario.');
      return {
        enviado: false,
        totalSolicitudes: 0,
        destinatarios: [],
      };
    }

    const { recipients, rolUtilizado } = await this.resolveTargetRecipients();
    if (recipients.length === 0 || !this.mailer) {
      return {
        enviado: false,
        totalSolicitudes: urgentRequests.length,
        destinatarios: [],
      };
    }

    const summaryPayload = urgentRequests.map((r) => ({
      idSolicitud: r.idSolicitud!,
      nombreSolicitante: r.nombreSolicitante,
      telefonoSolicitante: r.telefonoSolicitante,
      servicio: r.servicio,
      fechaInicio: r.bloqueInicial,
    }));

    let sendSuccess = false;
    try {
      for (const recipient of recipients) {
        await this.mailer.sendDailyPendingRequestsSummaryEmail({
          to: recipient.correo,
          destinatarioNombre: recipient.nombreCompleto,
          solicitudes: summaryPayload,
        });
      }
      sendSuccess = true;
    } catch (err: any) {
      console.error('❌ Error enviando aviso diario de solicitudes pendientes:', err?.message);
      if (this.auditLogger) {
        await this.auditLogger.log({
          usuario: 'Sistema',
          accion: 'Envío de correo fallido (aviso diario solicitudes pendientes)',
          registroAfectado: 'sistema:aviso_diario_solicitudes',
          valorNuevo: { error: err?.message, solicitudes: urgentRequests.length },
        });
      }
    }

    return {
      enviado: sendSuccess,
      totalSolicitudes: urgentRequests.length,
      destinatarios: recipients.map((r) => r.correo),
    };
  }

  /**
   * Escalado estricto de destinatarios según RF-AGE-004:
   * 1. Coordinadora de agendamiento (ROL-COA).
   * 2. Si no hay ninguna activa -> Auxiliar (ROL-AUX).
   * 3. Si tampoco -> Administrador del sistema (ROL-ADM).
   */
  private async resolveTargetRecipients(): Promise<{
    recipients: ProfessionalStaffDTO[];
    rolUtilizado: string;
  }> {
    const coaStaff = await this.appointmentRepository.findActiveStaffByRoleCodes(['ROL-COA']);
    if (coaStaff.length > 0) {
      return { recipients: coaStaff, rolUtilizado: 'ROL-COA (Coordinación de Agendamiento)' };
    }

    const auxStaff = await this.appointmentRepository.findActiveStaffByRoleCodes(['ROL-AUX']);
    if (auxStaff.length > 0) {
      return { recipients: auxStaff, rolUtilizado: 'ROL-AUX (Auxiliar de Odontología)' };
    }

    const admStaff = await this.appointmentRepository.findActiveStaffByRoleCodes(['ROL-ADM']);
    if (admStaff.length > 0) {
      return { recipients: admStaff, rolUtilizado: 'ROL-ADM (Administración del Sistema)' };
    }

    return { recipients: [], rolUtilizado: 'NINGUNO' };
  }
}
