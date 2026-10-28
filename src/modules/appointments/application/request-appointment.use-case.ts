// src/modules/appointments/application/request-appointment.use-case.ts
import { ColombiaTime } from '../../../shared/domain/colombia-time.util';
import { findServiceConfigByName } from '../../../app/config/services-catalog.config';
import {
  AppointmentRequestDTO,
  IAppointmentAuditLoggerPort,
  IAppointmentMailerPort,
  IAppointmentRealtimeNotifierPort,
  IAppointmentRepository,
} from '../domain/appointment.repository.interface';
import { AppointmentRequestEntity } from '../domain/appointment-request.entity';
import { DentalServiceType } from '../domain/appointment.entity';

export interface RequestAppointmentCommand {
  servicio: DentalServiceType;
  idProfesional?: number;
  bloques: Array<string | Date>;
  documentoIdentidad: string;
  nombreCompleto: string;
  telefono?: string;
  correoElectronico: string;
  fechaNacimiento?: string | Date;
  motivo?: string | null;
  autorizacionDatos: boolean;
  versionAvisoPrivacidad?: string;
  now?: Date;
}

export interface RequestAppointmentResult {
  message: string;
  data: AppointmentRequestDTO;
}

export class RequestAppointmentUseCase {
  constructor(
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly mailer?: IAppointmentMailerPort,
    private readonly auditLogger?: IAppointmentAuditLoggerPort,
    private readonly realtimeNotifier?: IAppointmentRealtimeNotifierPort
  ) {}

  public async execute(command: RequestAppointmentCommand): Promise<RequestAppointmentResult> {
    const now = command.now ?? new Date();

    // 1. Validar autorización de tratamiento de datos personales (RQNF-SEG-005, RF-AGE-003)
    if (!command.autorizacionDatos) {
      throw new Error(
        'Debe aceptar la autorización de tratamiento de datos personales y la política de privacidad para enviar la solicitud (RF-AGE-003).'
      );
    }

    // 2. Resolver profesional asignado al servicio (RF-AGE-012)
    let idProfesionalFinal = command.idProfesional;
    if (!idProfesionalFinal) {
      const serviceConfig = findServiceConfigByName(command.servicio);
      if (!serviceConfig) {
        throw new Error(`El servicio "${command.servicio}" no se encuentra disponible (RF-AGE-012).`);
      }
      const staffList = await this.appointmentRepository.findActiveStaffByRoleCodes([
        serviceConfig.profesionalPorDefecto.rolRequerido,
      ]);
      if (staffList.length === 0) {
        throw new Error(
          `En este momento no hay disponibilidad de profesionales activos para el servicio de ${command.servicio}.`
        );
      }
      idProfesionalFinal = staffList[0].idUsuario;
    }

    const professional = await this.appointmentRepository.findUserById(idProfesionalFinal);
    if (!professional || !professional.estado) {
      throw new Error('El profesional asignado para el servicio no se encuentra disponible.');
    }

    // 3. Crear entidad de solicitud de dominio (valida ventana de 5 a 60 días, máx 4 bloques contiguos, formato de documento y correo)
    const requestEntity = AppointmentRequestEntity.createPublicRequest({
      nombreSolicitante: command.nombreCompleto,
      documentoSolicitante: command.documentoIdentidad,
      correoSolicitante: command.correoElectronico,
      telefonoSolicitante: command.telefono,
      fechaNacimiento: command.fechaNacimiento,
      servicio: command.servicio,
      idProfesional: idProfesionalFinal,
      bloquesSolicitados: command.bloques,
      descripcion: command.motivo,
      autorizacionDatosAceptada: command.autorizacionDatos,
      versionAvisoPrivacidad: command.versionAvisoPrivacidad ?? '1.0',
      now,
    });

    // 4. Regla RF-AGE-003: Verificar que el documento no tenga ya una cita Solicitada en ese servicio
    const existingRequests = await this.appointmentRepository.findPendingRequestsByDocumentAndService(
      requestEntity.documentoSolicitante,
      requestEntity.servicio
    );

    if (existingRequests.length > 0) {
      throw new Error(
        `El documento ${requestEntity.documentoSolicitante} ya tiene una cita Solicitada en trámite para el servicio de ${requestEntity.servicio}. Por favor espere su confirmación o comuníquese con el consultorio (RF-AGE-003).`
      );
    }

    // 5. Verificar disponibilidad de los bloques solicitados y aplicar Regla de Negocio 1 (Exclusividad de reserva)
    const targetDates = [...requestEntity.bloquesSolicitados];
    const existingSlots = await this.appointmentRepository.findSlotsByDates(targetDates);

    if (existingSlots.length !== targetDates.length) {
      throw new Error('Uno o más de los bloques solicitados no están habilitados en la agenda.');
    }

    for (const slot of existingSlots) {
      if (!slot.estado) {
        throw new Error(
          `El bloque ${ColombiaTime.formatDateTime(slot.inicio)} se encuentra deshabilitado para agendamiento.`
        );
      }
      if (slot.ocupacion) {
        throw new Error(
          `Uno de los bloques seleccionados (${ColombiaTime.formatDateTime(
            slot.inicio
          )}) ya fue reservado u ocupado. Por favor seleccione otro horario.`
        );
      }
      if (slot.hasStarted(now)) {
        throw new Error('No es posible solicitar bloques de horario que ya han empezado.');
      }
    }

    // 6. Reservar bloques y guardar la solicitud
    await this.appointmentRepository.occupySlots(targetDates);
    const savedRequest = await this.appointmentRepository.createPublicRequest(requestEntity);

    // 7. Enviar correo de confirmación de recepción al solicitante (RQNF-FIA-004)
    if (this.mailer) {
      try {
        await this.mailer.sendPublicRequestReceivedEmail({
          to: savedRequest.correoSolicitante,
          nombreSolicitante: savedRequest.nombreSolicitante,
          servicio: savedRequest.servicio,
          fechaInicio: savedRequest.bloqueInicial,
        });
      } catch (mailError: any) {
        console.warn('⚠️ Tolerancia a fallos: Correo de recepción de solicitud no enviado:', mailError?.message);
        if (this.auditLogger) {
          await this.auditLogger.log({
            usuario: 'Sistema',
            accion: 'Envío de correo fallido (recepción de solicitud de cita)',
            registroAfectado: `solicitud:${savedRequest.idSolicitud}`,
            valorNuevo: { destinatario: savedRequest.correoSolicitante, error: mailError?.message },
          });
        }
      }
    }

    // 8. Registro de auditoría (RQNF-SEG-009)
    if (this.auditLogger) {
      await this.auditLogger.log({
        usuario: 'Paciente (Público)',
        accion: 'Solicitar cita web',
        registroAfectado: `solicitud:${savedRequest.idSolicitud}`,
        valorNuevo: {
          idSolicitud: savedRequest.idSolicitud,
          documento: savedRequest.documentoSolicitante,
          nombre: savedRequest.nombreSolicitante,
          servicio: savedRequest.servicio,
          bloqueInicial: ColombiaTime.formatDateTime(savedRequest.bloqueInicial),
          totalBloques: savedRequest.bloquesSolicitados.length,
        },
      });
    }

    // 9. Notificación en tiempo real (RQNF-DES-002: los demás ven el bloque ocupado sin datos personales, RQNF-SEG-008)
    if (this.realtimeNotifier) {
      await this.realtimeNotifier.notifyAgendaChanged({
        type: 'REQUEST_CREATED',
        payload: {
          idSolicitud: savedRequest.idSolicitud,
          servicio: savedRequest.servicio,
          idProfesional: idProfesionalFinal,
          fecha: ColombiaTime.toDateKey(savedRequest.bloqueInicial),
        },
      });
    }

    const requestDTO: AppointmentRequestDTO = {
      idSolicitud: savedRequest.idSolicitud!,
      nombreSolicitante: savedRequest.nombreSolicitante,
      documentoSolicitante: savedRequest.documentoSolicitante,
      correoSolicitante: savedRequest.correoSolicitante,
      telefonoSolicitante: savedRequest.telefonoSolicitante,
      fechaNacimiento: savedRequest.fechaNacimiento,
      servicio: savedRequest.servicio,
      idProfesional: savedRequest.idProfesional,
      bloquesSolicitados: [...savedRequest.bloquesSolicitados],
      descripcion: savedRequest.descripcion,
      autorizacionDatosAceptada: savedRequest.autorizacionDatosAceptada,
      versionAvisoPrivacidad: savedRequest.versionAvisoPrivacidad,
      fechaSolicitud: savedRequest.fechaSolicitud,
      estado: savedRequest.estado,
    };

    return {
      message:
        'Solicitud enviada exitosamente. Sus bloques han quedado reservados y la cita está sujeta a aprobación del consultorio. Si necesita cambiar o cancelar comuníquese al consultorio.',
      data: requestDTO,
    };
  }
}
