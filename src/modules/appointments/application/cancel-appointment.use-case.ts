// src/modules/appointments/application/cancel-appointment.use-case.ts
import { ColombiaTime } from '../../../shared/domain/colombia-time.util';
import {
  AppointmentDTO,
  IAppointmentAuditLoggerPort,
  IAppointmentMailerPort,
  IAppointmentRealtimeNotifierPort,
  IAppointmentRepository,
} from '../domain/appointment.repository.interface';

export interface CancelAppointmentCommand {
  idCita: number;
  idUsuarioGestor: number;
  nombreUsuarioGestor: string;
  motivo: string;
  destinoBloques?: 'DISPONIBLE' | 'DESHABILITADO'; // Por defecto DISPONIBLE (RF-AGE-007 / sección 7)
  now?: Date;
}

export interface CancelAppointmentResult {
  message: string;
  data: AppointmentDTO;
}

export class CancelAppointmentUseCase {
  constructor(
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly mailer?: IAppointmentMailerPort,
    private readonly auditLogger?: IAppointmentAuditLoggerPort,
    private readonly realtimeNotifier?: IAppointmentRealtimeNotifierPort
  ) {}

  public async execute(command: CancelAppointmentCommand): Promise<CancelAppointmentResult> {
    const now = command.now ?? new Date();

    if (!command.idUsuarioGestor || !command.nombreUsuarioGestor) {
      throw new Error('Debe indicarse el usuario gestor que realiza la cancelación (Regla de Negocio 10).');
    }

    const cleanMotivo = (command.motivo ?? '').trim();
    if (!cleanMotivo) {
      throw new Error('El motivo de cancelación es obligatorio (RF-AGE-007).');
    }

    // 1. Obtener la cita y validar que esté en estado Confirmada
    const appointment = await this.appointmentRepository.findAppointmentById(command.idCita);
    if (!appointment) {
      throw new Error(`La cita con ID ${command.idCita} no existe (RF-AGE-007).`);
    }

    if (appointment.estado !== 'Confirmada') {
      throw new Error(
        `Solo se pueden cancelar citas en estado Confirmada. Estado actual de la cita: ${appointment.estado} (RF-AGE-007).`
      );
    }

    // 2. Ejecutar cancelación en la entidad de dominio
    appointment.cancelar({
      idUsuarioGestor: command.idUsuarioGestor,
      nombreUsuarioGestor: command.nombreUsuarioGestor,
      motivo: cleanMotivo,
      now,
    });

    // 3. Gestionar destino de los bloques que no han empezado (RF-AGE-007)
    const keepEnabled = (command.destinoBloques ?? 'DISPONIBLE') === 'DISPONIBLE';
    const futureBlocks = appointment.bloques.filter((b) => b.getTime() > now.getTime());

    if (futureBlocks.length > 0) {
      await this.appointmentRepository.releaseSlots([...futureBlocks], keepEnabled);
    }

    // 4. Actualizar la cita en persistencia
    const updatedAppointment = await this.appointmentRepository.updateAppointment(appointment);

    // 5. Obtener datos de paciente y profesional para el envío de correos
    const patient = await this.appointmentRepository.findPatientById(updatedAppointment.idPaciente);
    const professional = await this.appointmentRepository.findUserById(updatedAppointment.idUsuario);

    // 6. Enviar correo de cancelación al paciente y al profesional (RF-AGE-007 / RQNF-FIA-004)
    if (this.mailer) {
      // Al paciente
      if (patient?.correo) {
        try {
          await this.mailer.sendAppointmentCancelledEmail({
            to: patient.correo,
            nombreDestinatario: patient.nombreCompleto,
            esProfesional: false,
            servicio: updatedAppointment.servicio,
            fechaInicio: updatedAppointment.horaInicio,
            motivo: cleanMotivo,
          });
        } catch (mailError: any) {
          console.warn('⚠️ Tolerancia a fallos: Correo de cancelación a paciente falló:', mailError?.message);
        }
      }

      // Al profesional
      if (professional?.correo) {
        try {
          await this.mailer.sendAppointmentCancelledEmail({
            to: professional.correo,
            nombreDestinatario: professional.nombreCompleto,
            esProfesional: true,
            servicio: updatedAppointment.servicio,
            fechaInicio: updatedAppointment.horaInicio,
            motivo: cleanMotivo,
          });
        } catch (profMailError: any) {
          console.warn('⚠️ Tolerancia a fallos: Correo de cancelación a profesional falló:', profMailError?.message);
        }
      }
    }

    // 7. Registro de auditoría (RQNF-SEG-009)
    if (this.auditLogger) {
      await this.auditLogger.log({
        usuario: command.nombreUsuarioGestor,
        accion: 'Cancelar cita',
        registroAfectado: `cita:${updatedAppointment.idCita}`,
        valorNuevo: {
          idCita: updatedAppointment.idCita,
          estado: 'Cancelada',
          motivo: cleanMotivo,
          destinoBloques: command.destinoBloques ?? 'DISPONIBLE',
          paciente: patient?.nombreCompleto,
          profesional: professional?.nombreCompleto,
        },
      });
    }

    // 8. Notificación en tiempo real (RQNF-DES-002)
    if (this.realtimeNotifier) {
      await this.realtimeNotifier.notifyAgendaChanged({
        type: 'APPOINTMENT_CANCELLED',
        payload: {
          idCita: updatedAppointment.idCita,
          idProfesional: updatedAppointment.idUsuario,
          servicio: updatedAppointment.servicio,
          fecha: ColombiaTime.toDateKey(updatedAppointment.horaInicio),
        },
      });
    }

    const dto: AppointmentDTO = {
      idCita: updatedAppointment.idCita!,
      titulo: updatedAppointment.titulo,
      descripcion: updatedAppointment.descripcion,
      idPaciente: updatedAppointment.idPaciente,
      nombrePaciente: patient?.nombreCompleto,
      documentoPaciente: patient?.documentoIdentidad,
      telefonoPaciente: patient?.telefono,
      correoPaciente: patient?.correo,
      idProfesional: updatedAppointment.idUsuario,
      nombreProfesional: professional?.nombreCompleto,
      servicio: updatedAppointment.servicio,
      estado: updatedAppointment.estado,
      bloques: [...updatedAppointment.bloques],
      horaInicio: updatedAppointment.horaInicio,
      horaFinal: updatedAppointment.horaFinal,
      agendadoPorId: updatedAppointment.agendadoPorId,
      agendadoPorNombre: updatedAppointment.agendadoPorNombre,
      estadoRecordatorio: updatedAppointment.estadoRecordatorio,
      causaFalloRecordatorio: updatedAppointment.causaFalloRecordatorio,
      historialCambios: [...updatedAppointment.historialCambios],
    };

    return {
      message: 'Cita cancelada exitosamente.',
      data: dto,
    };
  }
}
