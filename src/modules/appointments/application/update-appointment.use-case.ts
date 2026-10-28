// src/modules/appointments/application/update-appointment.use-case.ts
import { ColombiaTime } from '../../../shared/domain/colombia-time.util';
import {
  AppointmentDTO,
  IAppointmentAuditLoggerPort,
  IAppointmentMailerPort,
  IAppointmentRealtimeNotifierPort,
  IAppointmentRepository,
} from '../domain/appointment.repository.interface';
import { AppointmentEntity, DentalServiceType } from '../domain/appointment.entity';

export interface UpdateAppointmentCommand {
  idCita: number;
  idUsuarioGestor: number;
  nombreUsuarioGestor: string;
  nuevosBloques?: Array<string | Date>;
  nuevoIdProfesional?: number;
  nuevoServicio?: DentalServiceType;
  nuevoTitulo?: string;
  nuevaDescripcion?: string | null;
  confirmadoPorUsuario?: boolean; // El sistema pide confirmar un cambio de fecha, bloques o profesional (RF-AGE-006)
  now?: Date;
}

export interface UpdateAppointmentResult {
  message: string;
  data: AppointmentDTO;
  recordatorioReprogramado: boolean;
}

export class UpdateAppointmentUseCase {
  constructor(
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly mailer?: IAppointmentMailerPort,
    private readonly auditLogger?: IAppointmentAuditLoggerPort,
    private readonly realtimeNotifier?: IAppointmentRealtimeNotifierPort
  ) {}

  public async execute(command: UpdateAppointmentCommand): Promise<UpdateAppointmentResult> {
    const now = command.now ?? new Date();

    if (!command.idUsuarioGestor || !command.nombreUsuarioGestor) {
      throw new Error('Debe indicarse el usuario que realiza la modificación de la cita (Regla de Negocio 10).');
    }

    // 1. Obtener cita y validar que esté en estado Confirmada
    const appointment = await this.appointmentRepository.findAppointmentById(command.idCita);
    if (!appointment) {
      throw new Error(`La cita con ID ${command.idCita} no existe (RF-AGE-006).`);
    }

    if (appointment.estado !== 'Confirmada') {
      throw new Error(
        `Las citas en estado ${appointment.estado} no pueden ser editadas. Solo se pueden modificar citas en estado Confirmada (RF-AGE-006).`
      );
    }

    // 2. Detectar si hay cambio crítico de horario o profesional
    let parsedNewBlocks: Date[] | undefined;
    let fechaOBloquesCambiaron = false;

    if (command.nuevosBloques && command.nuevosBloques.length > 0) {
      parsedNewBlocks = command.nuevosBloques
        .map((b) => (b instanceof Date ? b : new Date(b)))
        .sort((a, b) => a.getTime() - b.getTime());

      AppointmentEntity.validateContiguousBlocks(parsedNewBlocks);

      const oldBlocksIso = appointment.bloques.map((b) => b.toISOString()).join(',');
      const newBlocksIso = parsedNewBlocks.map((b) => b.toISOString()).join(',');
      if (oldBlocksIso !== newBlocksIso) {
        fechaOBloquesCambiaron = true;
      }
    }

    const profesionalCambio = Boolean(
      command.nuevoIdProfesional !== undefined &&
        command.nuevoIdProfesional !== appointment.idUsuario
    );

    // 3. Exigir confirmación explícita para cambios de fecha, bloques o profesional (RF-AGE-006)
    if ((fechaOBloquesCambiaron || profesionalCambio) && !command.confirmadoPorUsuario) {
      throw new Error(
        'Modificación de horario o profesional detectada. Debe confirmar explícitamente el cambio antes de guardar (RF-AGE-006).'
      );
    }

    // 4. Validar disponibilidad de los nuevos bloques si hubo cambio de horario
    if (parsedNewBlocks && fechaOBloquesCambiaron) {
      // Bloques que deja de usar quedan libres (RF-AGE-006)
      const blocksToRelease = appointment.bloques.filter(
        (prev) => !parsedNewBlocks!.some((curr) => curr.getTime() === prev.getTime())
      );
      if (blocksToRelease.length > 0) {
        await this.appointmentRepository.releaseSlots([...blocksToRelease], true);
      }

      // Bloques nuevos que no pertenecían a esta cita
      const newlyAddedBlocks = parsedNewBlocks.filter(
        (curr) => !appointment.bloques.some((prev) => prev.getTime() === curr.getTime())
      );

      if (newlyAddedBlocks.length > 0) {
        const slotsInDb = await this.appointmentRepository.findSlotsByDates(newlyAddedBlocks);
        if (slotsInDb.length !== newlyAddedBlocks.length) {
          throw new Error('Uno o más de los nuevos bloques seleccionados no existen en la agenda.');
        }

        for (const slot of slotsInDb) {
          if (!slot.estado) {
            throw new Error(`El bloque ${ColombiaTime.formatDateTime(slot.inicio)} se encuentra deshabilitado.`);
          }
          if (slot.ocupacion) {
            throw new Error(
              `El bloque ${ColombiaTime.formatDateTime(
                slot.inicio
              )} ya fue ocupado desde otra sesión (RF-AGE-006).`
            );
          }
          if (slot.hasStarted(now)) {
            throw new Error('No se puede reprogramar a un bloque de horario que ya empezó.');
          }
        }

        await this.appointmentRepository.occupySlots(newlyAddedBlocks);
      }
    }

    // 5. Aplicar cambios sobre la entidad de dominio (preserva estado y Agendado por)
    const { requiereReprogramarRecordatorio } = appointment.editarCitaConfirmada({
      idUsuarioGestor: command.idUsuarioGestor,
      nombreUsuarioGestor: command.nombreUsuarioGestor,
      nuevosBloques: parsedNewBlocks,
      nuevoIdProfesional: command.nuevoIdProfesional,
      nuevoServicio: command.nuevoServicio,
      nuevoTitulo: command.nuevoTitulo,
      nuevaDescripcion: command.nuevaDescripcion,
      now,
    });

    const updatedAppointment = await this.appointmentRepository.updateAppointment(appointment);

    // 6. Obtener datos de paciente y profesional para el correo
    const patient = await this.appointmentRepository.findPatientById(updatedAppointment.idPaciente);
    const professional = await this.appointmentRepository.findUserById(updatedAppointment.idUsuario);

    // 7. Enviar correo de reprogramación al paciente si cambiaron fecha, bloques o profesional (RF-AGE-006 / RQNF-FIA-004)
    if (requiereReprogramarRecordatorio && this.mailer && patient?.correo && professional) {
      try {
        await this.mailer.sendAppointmentRescheduledEmail({
          to: patient.correo,
          nombrePaciente: patient.nombreCompleto,
          servicio: updatedAppointment.servicio,
          nombreProfesional: professional.nombreCompleto,
          nuevaFechaInicio: updatedAppointment.horaInicio,
          nuevaFechaFinal: updatedAppointment.horaFinal,
        });
      } catch (mailError: any) {
        console.warn('⚠️ Tolerancia a fallos: Correo de reprogramación no enviado:', mailError?.message);
        if (this.auditLogger) {
          await this.auditLogger.log({
            usuario: 'Sistema',
            accion: 'Envío de correo fallido (reprogramación de cita)',
            registroAfectado: `cita:${updatedAppointment.idCita}`,
            valorNuevo: { destinatario: patient.correo, error: mailError?.message },
          });
        }
      }
    }

    // 8. Registro de auditoría (RQNF-SEG-009)
    if (this.auditLogger) {
      await this.auditLogger.log({
        usuario: command.nombreUsuarioGestor,
        accion: 'Editar cita confirmada',
        registroAfectado: `cita:${updatedAppointment.idCita}`,
        valorNuevo: {
          idCita: updatedAppointment.idCita,
          titulo: updatedAppointment.titulo,
          horaInicio: ColombiaTime.formatDateTime(updatedAppointment.horaInicio),
          horaFinal: ColombiaTime.formatDateTime(updatedAppointment.horaFinal),
          profesional: professional?.nombreCompleto,
          recordatorioReprogramado: requiereReprogramarRecordatorio,
        },
      });
    }

    // 9. Notificación en tiempo real (RQNF-DES-002)
    if (this.realtimeNotifier) {
      await this.realtimeNotifier.notifyAgendaChanged({
        type: 'APPOINTMENT_UPDATED',
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
      message: 'Cita Confirmada actualizada exitosamente.',
      data: dto,
      recordatorioReprogramado: requiereReprogramarRecordatorio,
    };
  }
}
