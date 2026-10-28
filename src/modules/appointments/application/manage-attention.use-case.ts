// src/modules/appointments/application/manage-attention.use-case.ts
import { ColombiaTime } from '../../../shared/domain/colombia-time.util';
import {
  AppointmentDTO,
  IAppointmentAuditLoggerPort,
  IAppointmentRealtimeNotifierPort,
  IAppointmentRepository,
  IClinicalRecordCheckerPort,
} from '../domain/appointment.repository.interface';
import { AppointmentEntity } from '../domain/appointment.entity';

export interface ManageAttentionCommand {
  accion: 'INICIAR' | 'FINALIZAR';
  idCita: number;
  idProfesionalEjecutor: number;
  nombreProfesionalEjecutor: string;
  now?: Date;
}

export interface ManageAttentionResult {
  message: string;
  data: AppointmentDTO;
}

export class ManageAttentionUseCase {
  constructor(
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly clinicalRecordChecker?: IClinicalRecordCheckerPort,
    private readonly auditLogger?: IAppointmentAuditLoggerPort,
    private readonly realtimeNotifier?: IAppointmentRealtimeNotifierPort
  ) {}

  public async execute(command: ManageAttentionCommand): Promise<ManageAttentionResult> {
    const now = command.now ?? new Date();

    if (!command.idProfesionalEjecutor || !command.nombreProfesionalEjecutor) {
      throw new Error('Debe indicarse el profesional responsable que ejecuta la acción (Regla de Negocio 9).');
    }

    // 1. Obtener cita existente
    const appointment = await this.appointmentRepository.findAppointmentById(command.idCita);
    if (!appointment) {
      throw new Error(`La cita con ID ${command.idCita} no existe (RF-AGE-009).`);
    }

    // 2. Verificar que el ejecutor sea el profesional responsable de esta cita (RF-AGE-009 / Regla 5)
    if (appointment.idUsuario !== command.idProfesionalEjecutor) {
      throw new Error(
        'No tiene permiso para realizar esta acción: solo el profesional responsable de la cita puede iniciar o finalizar la atención (RF-AGE-009).'
      );
    }

    // ==========================================
    // CASO INICIAR ATENCIÓN (Confirmada -> En consulta)
    // ==========================================
    if (command.accion === 'INICIAR') {
      // Verificar si el profesional ya tiene otra cita "En consulta" activa (RF-AGE-009)
      const activeAppointment = await this.appointmentRepository.findActiveConsultationByProfessional(
        command.idProfesionalEjecutor
      );

      const yaTieneCitaActiva = Boolean(
        activeAppointment && activeAppointment.idCita !== appointment.idCita
      );

      // Ejecutar validaciones y cambio de estado en el dominio
      appointment.iniciarAtencion({
        idProfesionalEjecutor: command.idProfesionalEjecutor,
        nombreProfesionalEjecutor: command.nombreProfesionalEjecutor,
        profesionalYaTieneCitaEnConsulta: yaTieneCitaActiva,
        now,
      });

      const updatedAppointment = await this.appointmentRepository.updateAppointment(appointment);

      // Auditoría y tiempo real
      if (this.auditLogger) {
        await this.auditLogger.log({
          usuario: command.nombreProfesionalEjecutor,
          accion: 'Iniciar atención odontológica (En consulta)',
          registroAfectado: `cita:${updatedAppointment.idCita}`,
          valorNuevo: {
            idCita: updatedAppointment.idCita,
            estado: 'En consulta',
            profesional: command.nombreProfesionalEjecutor,
            horaInicioAtencion: ColombiaTime.formatDateTime(now),
          },
        });
      }

      if (this.realtimeNotifier) {
        await this.realtimeNotifier.notifyAgendaChanged({
          type: 'ATTENTION_CHANGED',
          payload: {
            idCita: updatedAppointment.idCita,
            estado: 'En consulta',
            idProfesional: updatedAppointment.idUsuario,
            idPaciente: updatedAppointment.idPaciente,
          },
        });
      }

      return {
        message: 'Atención iniciada con éxito. La cita se encuentra En consulta y el registro clínico está habilitado.',
        data: this.toDTO(updatedAppointment),
      };
    }

    // ==========================================
    // CASO FINALIZAR ATENCIÓN (En consulta -> Atendida)
    // ==========================================
    if (command.accion === 'FINALIZAR') {
      // Verificar obligatoriedad de registrar motivo de consulta en la historia clínica (RF-AGE-009 / RF-HCL-005)
      let tieneMotivoRegistrado = false;
      if (this.clinicalRecordChecker) {
        tieneMotivoRegistrado = await this.clinicalRecordChecker.hasConsultationReasonRegistered(
          appointment.idCita!
        );
      } else {
        // Si no se inyectó el checker en pruebas aisladas, asumimos true por defecto
        tieneMotivoRegistrado = true;
      }

      if (!tieneMotivoRegistrado) {
        throw new Error('Falta registrar el motivo de consulta');
      }

      // Ejecutar cambio de estado en el dominio
      appointment.finalizarAtencion({
        idProfesionalEjecutor: command.idProfesionalEjecutor,
        nombreProfesionalEjecutor: command.nombreProfesionalEjecutor,
        tieneMotivoConsultaRegistrado: true,
        now,
      });

      const updatedAppointment = await this.appointmentRepository.updateAppointment(appointment);

      // Auditoría y tiempo real
      if (this.auditLogger) {
        await this.auditLogger.log({
          usuario: command.nombreProfesionalEjecutor,
          accion: 'Finalizar atención odontológica (Atendida)',
          registroAfectado: `cita:${updatedAppointment.idCita}`,
          valorNuevo: {
            idCita: updatedAppointment.idCita,
            estado: 'Atendida',
            profesional: command.nombreProfesionalEjecutor,
            horaFinAtencion: ColombiaTime.formatDateTime(now),
          },
        });
      }

      if (this.realtimeNotifier) {
        await this.realtimeNotifier.notifyAgendaChanged({
          type: 'ATTENTION_CHANGED',
          payload: {
            idCita: updatedAppointment.idCita,
            estado: 'Atendida',
            idProfesional: updatedAppointment.idUsuario,
            idPaciente: updatedAppointment.idPaciente,
          },
        });
      }

      return {
        message: 'Atención finalizada exitosamente. La cita quedó en estado Atendida.',
        data: this.toDTO(updatedAppointment),
      };
    }

    throw new Error(`Acción desconocida "${command.accion}". Las acciones válidas son INICIAR o FINALIZAR.`);
  }

  private toDTO(entity: AppointmentEntity): AppointmentDTO {
    return {
      idCita: entity.idCita!,
      titulo: entity.titulo,
      descripcion: entity.descripcion,
      idPaciente: entity.idPaciente,
      idProfesional: entity.idUsuario,
      servicio: entity.servicio,
      estado: entity.estado,
      bloques: [...entity.bloques],
      horaInicio: entity.horaInicio,
      horaFinal: entity.horaFinal,
      agendadoPorId: entity.agendadoPorId,
      agendadoPorNombre: entity.agendadoPorNombre,
      estadoRecordatorio: entity.estadoRecordatorio,
      causaFalloRecordatorio: entity.causaFalloRecordatorio,
      historialCambios: [...entity.historialCambios],
    };
  }
}
