// src/modules/appointments/application/mark-no-show.use-case.ts
import { ColombiaTime } from '../../../shared/domain/colombia-time.util';
import {
  AppointmentDTO,
  IAppointmentAuditLoggerPort,
  IAppointmentRealtimeNotifierPort,
  IAppointmentRepository,
} from '../domain/appointment.repository.interface';
import { AppointmentEntity } from '../domain/appointment.entity';

export interface MarkNoShowCommand {
  idCita: number;
  idUsuarioGestor: number;
  nombreUsuarioGestor: string;
  rolesGestor: string[];
  observacion?: string | null;
  confirmado: boolean; // Confirmación previa: "La inasistencia no se puede deshacer" (RF-AGE-013)
  now?: Date;
}

export interface MarkNoShowResult {
  message: string;
  data: AppointmentDTO;
}

export class MarkNoShowUseCase {
  constructor(
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly auditLogger?: IAppointmentAuditLoggerPort,
    private readonly realtimeNotifier?: IAppointmentRealtimeNotifierPort
  ) {}

  public async execute(command: MarkNoShowCommand): Promise<MarkNoShowResult> {
    const now = command.now ?? new Date();

    if (!command.confirmado) {
      throw new Error(
        'Debe confirmar la acción. La inasistencia no se puede deshacer (RF-AGE-013).'
      );
    }

    if (!command.idUsuarioGestor || !command.nombreUsuarioGestor) {
      throw new Error('Debe indicarse el usuario que marca la inasistencia (Regla de Negocio 10).');
    }

    // 1. Obtener la cita existente
    const appointment = await this.appointmentRepository.findAppointmentById(command.idCita);
    if (!appointment) {
      throw new Error(`La cita con ID ${command.idCita} no existe (RF-AGE-013).`);
    }

    // 2. Control de acceso por rol: a un profesional solo se le permite en sus propias citas (RF-AGE-013)
    const roles = command.rolesGestor.map((r) => r.toUpperCase());
    const isAdmin = roles.includes('ROL-ADM') || roles.some((r) => r.includes('ADMIN'));
    const isDoctor =
      roles.includes('ROL-ODO') ||
      roles.includes('ROL-ESP') ||
      roles.some((r) => r.includes('ODONT') || r.includes('ESPECIALISTA'));

    if (isDoctor && !isAdmin && appointment.idUsuario !== command.idUsuarioGestor) {
      throw new Error(
        'No tiene permiso para realizar esta acción: un profesional solo puede marcar inasistencias en sus propias citas (RF-AGE-013).'
      );
    }

    // 3. Regla RF-AGE-013: "Si la cita ya cambió de estado, el sistema no la modifica y muestra su estado actual"
    if (appointment.estado !== 'Confirmada') {
      throw new Error(
        `La cita ya cambió de estado (${appointment.estado}) y no puede marcarse como Inasistencia (RF-AGE-013).`
      );
    }

    // 4. Validar que la hora de inicio ya haya pasado y no supere las 23:59 del día de la cita
    const citaDay = AppointmentEntity.toColombiaDateString(appointment.horaInicio);
    const todayDay = AppointmentEntity.toColombiaDateString(now);

    if (citaDay !== todayDay || now.getTime() < appointment.horaInicio.getTime()) {
      throw new Error(
        'Solo se puede marcar la inasistencia desde la hora de inicio de la cita hasta las 23:59 de ese mismo día (RF-AGE-013).'
      );
    }

    // 5. Ejecutar la transición en el dominio (bloques NO se liberan)
    appointment.marcarInasistencia({
      idUsuarioGestor: command.idUsuarioGestor,
      nombreUsuarioGestor: command.nombreUsuarioGestor,
      observacion: command.observacion,
      now,
    });

    const updatedAppointment = await this.appointmentRepository.updateAppointment(appointment);

    // 6. Obtener datos de paciente y profesional para el DTO
    const patient = await this.appointmentRepository.findPatientById(updatedAppointment.idPaciente);
    const professional = await this.appointmentRepository.findUserById(updatedAppointment.idUsuario);

    // 7. Registro de auditoría (RQNF-SEG-009)
    if (this.auditLogger) {
      await this.auditLogger.log({
        usuario: command.nombreUsuarioGestor,
        accion: 'Marcar inasistencia de cita',
        registroAfectado: `cita:${updatedAppointment.idCita}`,
        valorNuevo: {
          idCita: updatedAppointment.idCita,
          estado: 'Inasistencia',
          observacion: command.observacion,
          paciente: patient?.nombreCompleto,
          profesional: professional?.nombreCompleto,
          horaMarcado: ColombiaTime.formatDateTime(now),
        },
      });
    }

    // 8. Notificación en tiempo real (RQNF-DES-002)
    if (this.realtimeNotifier) {
      await this.realtimeNotifier.notifyAgendaChanged({
        type: 'NO_SHOW_MARKED',
        payload: {
          idCita: updatedAppointment.idCita,
          estado: 'Inasistencia',
          idProfesional: updatedAppointment.idUsuario,
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
      message: 'Inasistencia registrada correctamente.',
      data: dto,
    };
  }
}
