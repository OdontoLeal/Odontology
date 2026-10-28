// src/modules/appointments/application/review-request.use-case.ts
import { ColombiaTime } from '../../../shared/domain/colombia-time.util';
import { findServiceConfigByName } from '../../../app/config/services-catalog.config';
import {
  AppointmentDTO,
  IAppointmentAuditLoggerPort,
  IAppointmentMailerPort,
  IAppointmentRealtimeNotifierPort,
  IAppointmentRepository,
  PatientSummaryDTO,
} from '../domain/appointment.repository.interface';
import { AppointmentEntity } from '../domain/appointment.entity';

export interface ReviewRequestCommand {
  idSolicitud: number;
  decision: 'CONFIRMAR' | 'RECHAZAR';
  idUsuarioGestor: number;
  nombreUsuarioGestor: string;
  motivo?: string; // Obligatorio si decision === 'RECHAZAR'
  nuevosBloques?: Array<string | Date>; // Opcional si se confirma en otra fecha u horario
  idProfesional?: number;
  now?: Date;
}

export interface ReviewRequestResult {
  message: string;
  decision: 'CONFIRMAR' | 'RECHAZAR';
  cita?: AppointmentDTO;
  pacienteCreado: boolean;
  diferenciasContacto?: {
    telefonoDifiere: boolean;
    correoDifiere: boolean;
    telefonoRegistrado?: string | null;
    telefonoSolicitud?: string | null;
    correoRegistrado?: string | null;
    correoSolicitud?: string | null;
  };
}

export class ReviewRequestUseCase {
  constructor(
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly mailer?: IAppointmentMailerPort,
    private readonly auditLogger?: IAppointmentAuditLoggerPort,
    private readonly realtimeNotifier?: IAppointmentRealtimeNotifierPort
  ) {}

  public async execute(command: ReviewRequestCommand): Promise<ReviewRequestResult> {
    const now = command.now ?? new Date();

    if (!command.idUsuarioGestor || !command.nombreUsuarioGestor) {
      throw new Error('Debe indicarse el usuario gestor que procesa la solicitud (Regla de Negocio 10).');
    }

    // 1. Obtener solicitud de cita y validar su estado pendiente
    const request = await this.appointmentRepository.findRequestById(command.idSolicitud);
    if (!request) {
      throw new Error(`La solicitud de cita con ID ${command.idSolicitud} no existe (RF-AGE-005).`);
    }

    if (!request.estado) {
      throw new Error('La solicitud ya cambió de estado o ya fue procesada previamente (RF-AGE-005).');
    }

    // ==========================================
    // CASO RECHAZO (RF-AGE-005)
    // ==========================================
    if (command.decision === 'RECHAZAR') {
      const cleanMotivo = (command.motivo ?? '').trim();
      if (!cleanMotivo) {
        throw new Error('El motivo de rechazo es obligatorio para rechazar una solicitud (RF-AGE-005).');
      }

      // 1. Marcar solicitud de dominio como revisada
      request.markAsReviewed({
        decision: 'REJECT',
        motivoRechazo: cleanMotivo,
      });

      // 2. Liberar los bloques reservados en la agenda
      await this.appointmentRepository.releaseSlots([...request.bloquesSolicitados], true);

      // 3. Actualizar estado de la solicitud y registrar en historial_solicitud
      await this.appointmentRepository.updateRequestStatus(request.idSolicitud!, false);
      await this.appointmentRepository.recordRequestHistory({
        idSolicitud: request.idSolicitud!,
        idUsuarioGestor: command.idUsuarioGestor,
        reporte: `Solicitud rechazada por ${command.nombreUsuarioGestor}.`,
        motivo: cleanMotivo,
      });

      // 4. Enviar motivo de rechazo al solicitante por correo (RQNF-FIA-004)
      if (this.mailer) {
        try {
          await this.mailer.sendRequestRejectedEmail({
            to: request.correoSolicitante,
            nombreSolicitante: request.nombreSolicitante,
            servicio: request.servicio,
            motivo: cleanMotivo,
          });
        } catch (mailError: any) {
          console.warn('⚠️ Tolerancia a fallos: Correo de rechazo no enviado:', mailError?.message);
        }
      }

      // 5. Auditoría y tiempo real
      if (this.auditLogger) {
        await this.auditLogger.log({
          usuario: command.nombreUsuarioGestor,
          accion: 'Rechazar solicitud de cita',
          registroAfectado: `solicitud:${request.idSolicitud}`,
          valorNuevo: { motivo: cleanMotivo, solicitante: request.nombreSolicitante },
        });
      }

      if (this.realtimeNotifier) {
        await this.realtimeNotifier.notifyAgendaChanged({
          type: 'REQUEST_REVIEWED',
          payload: {
            idSolicitud: request.idSolicitud,
            decision: 'RECHAZAR',
            fechasLiberadas: request.bloquesSolicitados.map((b) => ColombiaTime.toDateKey(b)),
          },
        });
      }

      return {
        message: 'Solicitud rechazada exitosamente y bloques liberados en la agenda.',
        decision: 'RECHAZAR',
        pacienteCreado: false,
      };
    }

    // ==========================================
    // CASO CONFIRMACIÓN (RF-AGE-005)
    // ==========================================
    if (command.decision !== 'CONFIRMAR') {
      throw new Error('La decisión debe ser CONFIRMAR o RECHAZAR.');
    }

    // 1. Resolver bloques finales (los originales pedidos o nuevos bloques disponibles)
    let finalBlocks: Date[];
    if (command.nuevosBloques && command.nuevosBloques.length > 0) {
      finalBlocks = command.nuevosBloques
        .map((b) => (b instanceof Date ? b : new Date(b)))
        .sort((a, b) => a.getTime() - b.getTime());

      AppointmentEntity.validateContiguousBlocks(finalBlocks);

      // Liberar bloques previamente reservados que no se utilizarán
      const previousBlocksToRelease = request.bloquesSolicitados.filter(
        (prev) => !finalBlocks.some((curr) => curr.getTime() === prev.getTime())
      );
      if (previousBlocksToRelease.length > 0) {
        await this.appointmentRepository.releaseSlots([...previousBlocksToRelease], true);
      }

      // Verificar y ocupar los nuevos bloques
      const newSlotsToCheck = finalBlocks.filter(
        (nb) => !request.bloquesSolicitados.some((prev) => prev.getTime() === nb.getTime())
      );

      if (newSlotsToCheck.length > 0) {
        const slotsInDb = await this.appointmentRepository.findSlotsByDates(newSlotsToCheck);
        for (const slot of slotsInDb) {
          if (!slot.estado || slot.ocupacion || slot.hasStarted(now)) {
            throw new Error(
              `El bloque reprogramado ${ColombiaTime.formatDateTime(slot.inicio)} no está disponible.`
            );
          }
        }
        await this.appointmentRepository.occupySlots(newSlotsToCheck);
      }
    } else {
      finalBlocks = [...request.bloquesSolicitados];
    }

    // 2. Resolver profesional asignado (RF-AGE-012)
    let finalProfessionalId = command.idProfesional ?? request.idProfesional;
    if (!finalProfessionalId) {
      const srvConfig = findServiceConfigByName(request.servicio);
      if (!srvConfig) {
        throw new Error(`El servicio ${request.servicio} no tiene configuración de profesional.`);
      }
      const staff = await this.appointmentRepository.findActiveStaffByRoleCodes([
        srvConfig.profesionalPorDefecto.rolRequerido,
      ]);
      if (staff.length === 0) {
        throw new Error(`No hay profesionales activos disponibles para el servicio de ${request.servicio}.`);
      }
      finalProfessionalId = staff[0].idUsuario;
    }

    const professionalUser = await this.appointmentRepository.findUserById(finalProfessionalId);
    if (!professionalUser || !professionalUser.estado) {
      throw new Error('El profesional seleccionado no se encuentra activo en el sistema.');
    }

    // 3. Gestión de Paciente: Buscar por documento (RF-AGE-005 / RF-HCL-001)
    let patient: PatientSummaryDTO;
    let pacienteCreado = false;
    let diferenciasContacto: ReviewRequestResult['diferenciasContacto'] = undefined;

    const existingPatient = await this.appointmentRepository.findPatientByDocument(
      request.documentoSolicitante
    );

    if (!existingPatient) {
      // Crear paciente con los datos y autorización de la solicitud, marcado "Datos incompletos" (RF-AGE-005)
      patient = await this.appointmentRepository.createPatientInPlace({
        nombreCompleto: request.nombreSolicitante,
        documentoIdentidad: request.documentoSolicitante,
        correo: request.correoSolicitante,
        telefono: request.telefonoSolicitante,
        fechaNacimiento: request.fechaNacimiento ?? new Date('2000-01-01'),
        sexo: undefined, // Faltante: motivo de marca "Datos incompletos"
        datosIncompletos: true, // Se retira al completarlos en RF-HCL-002
        autorizacionDatos: true,
      });
      pacienteCreado = true;
    } else {
      patient = existingPatient;
      // Comparar datos de contacto que difieran para alertar al personal (RF-HCL-002)
      const telDifiere = Boolean(
        request.telefonoSolicitante &&
          existingPatient.telefono &&
          request.telefonoSolicitante !== existingPatient.telefono
      );
      const mailDifiere = Boolean(
        request.correoSolicitante &&
          existingPatient.correo &&
          request.correoSolicitante.toLowerCase() !== existingPatient.correo.toLowerCase()
      );

      if (telDifiere || mailDifiere) {
        diferenciasContacto = {
          telefonoDifiere: telDifiere,
          correoDifiere: mailDifiere,
          telefonoRegistrado: existingPatient.telefono,
          telefonoSolicitud: request.telefonoSolicitante,
          correoRegistrado: existingPatient.correo,
          correoSolicitud: request.correoSolicitante,
        };
      }
    }

    // 4. Crear la Cita en estado Confirmada y con "Agendado por"
    const appointmentEntity = AppointmentEntity.scheduleInternal({
      idPaciente: patient.idPaciente,
      idUsuarioProfesional: professionalUser.idUsuario,
      servicio: request.servicio,
      bloques: finalBlocks,
      titulo: `Consulta ${request.servicio}`,
      descripcion: request.descripcion,
      agendadoPorId: command.idUsuarioGestor,
      agendadoPorNombre: command.nombreUsuarioGestor,
      now,
    });

    const savedAppointment = await this.appointmentRepository.scheduleAppointment(appointmentEntity);

    // 5. Actualizar solicitud y registrar historial
    await this.appointmentRepository.updateRequestStatus(request.idSolicitud!, false);
    await this.appointmentRepository.recordRequestHistory({
      idSolicitud: request.idSolicitud!,
      idUsuarioGestor: command.idUsuarioGestor,
      reporte: `Solicitud confirmada por ${command.nombreUsuarioGestor}. Cita generada ID: ${savedAppointment.idCita}.`,
      motivo: command.motivo ?? 'Aprobación de solicitud',
    });

    // 6. Enviar correo de confirmación de detalles al solicitante (RQNF-FIA-004)
    if (this.mailer) {
      try {
        await this.mailer.sendRequestApprovedEmail({
          to: request.correoSolicitante,
          nombreSolicitante: request.nombreSolicitante,
          servicio: request.servicio,
          nombreProfesional: professionalUser.nombreCompleto,
          fechaInicio: savedAppointment.horaInicio,
        });
      } catch (mailError: any) {
        console.warn('⚠️ Tolerancia a fallos: Correo de aprobación no enviado:', mailError?.message);
      }
    }

    // 7. Registro de auditoría (RQNF-SEG-009)
    if (this.auditLogger) {
      await this.auditLogger.log({
        usuario: command.nombreUsuarioGestor,
        accion: 'Confirmar solicitud de cita',
        registroAfectado: `solicitud:${request.idSolicitud}`,
        valorNuevo: {
          idSolicitud: request.idSolicitud,
          idCita: savedAppointment.idCita,
          paciente: patient.nombreCompleto,
          pacienteCreadoConDatosIncompletos: pacienteCreado,
          profesional: professionalUser.nombreCompleto,
          fechaInicio: ColombiaTime.formatDateTime(savedAppointment.horaInicio),
        },
      });
    }

    // 8. Notificación en tiempo real (RQNF-DES-002)
    if (this.realtimeNotifier) {
      await this.realtimeNotifier.notifyAgendaChanged({
        type: 'REQUEST_REVIEWED',
        payload: {
          idSolicitud: request.idSolicitud,
          decision: 'CONFIRMAR',
          idCita: savedAppointment.idCita,
          idProfesional: professionalUser.idUsuario,
          fecha: ColombiaTime.toDateKey(savedAppointment.horaInicio),
        },
      });
    }

    const appointmentDTO: AppointmentDTO = {
      idCita: savedAppointment.idCita!,
      titulo: savedAppointment.titulo,
      descripcion: savedAppointment.descripcion,
      idPaciente: patient.idPaciente,
      nombrePaciente: patient.nombreCompleto,
      documentoPaciente: patient.documentoIdentidad,
      telefonoPaciente: patient.telefono,
      correoPaciente: patient.correo,
      idProfesional: professionalUser.idUsuario,
      nombreProfesional: professionalUser.nombreCompleto,
      servicio: savedAppointment.servicio,
      estado: savedAppointment.estado,
      bloques: [...savedAppointment.bloques],
      horaInicio: savedAppointment.horaInicio,
      horaFinal: savedAppointment.horaFinal,
      agendadoPorId: savedAppointment.agendadoPorId,
      agendadoPorNombre: savedAppointment.agendadoPorNombre,
      estadoRecordatorio: savedAppointment.estadoRecordatorio,
      causaFalloRecordatorio: savedAppointment.causaFalloRecordatorio,
      historialCambios: [...savedAppointment.historialCambios],
    };

    return {
      message: `Solicitud confirmada exitosamente.${
        pacienteCreado ? ' Se creó la ficha del paciente con marca "Datos incompletos".' : ''
      }`,
      decision: 'CONFIRMAR',
      cita: appointmentDTO,
      pacienteCreado,
      diferenciasContacto,
    };
  }
}
