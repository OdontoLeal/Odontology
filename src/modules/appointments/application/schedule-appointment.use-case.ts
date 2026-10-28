// src/modules/appointments/application/schedule-appointment.use-case.ts
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
import { AppointmentEntity, DentalServiceType } from '../domain/appointment.entity';

export interface NewPatientInlineInput {
  nombreCompleto: string;
  documentoIdentidad: string;
  correo?: string;
  telefono?: string;
  fechaNacimiento: string | Date;
  sexo?: 'Femenino' | 'Masculino' | 'Indeterminado' | string;
  autorizacionDatos: boolean;
}

export interface ScheduleAppointmentCommand {
  ejecutadoPorId: number;
  ejecutadoPorNombre: string;
  idPaciente?: number;
  pacienteNuevo?: NewPatientInlineInput;
  servicio: DentalServiceType;
  idProfesional?: number;
  bloques: Array<string | Date>;
  titulo?: string;
  descripcion?: string | null;
  now?: Date;
}

export interface ScheduleAppointmentResult {
  message: string;
  data: AppointmentDTO;
}

export class ScheduleAppointmentUseCase {
  constructor(
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly mailer?: IAppointmentMailerPort,
    private readonly auditLogger?: IAppointmentAuditLoggerPort,
    private readonly realtimeNotifier?: IAppointmentRealtimeNotifierPort
  ) {}

  public async execute(command: ScheduleAppointmentCommand): Promise<ScheduleAppointmentResult> {
    const now = command.now ?? new Date();

    if (!command.ejecutadoPorId || !command.ejecutadoPorNombre) {
      throw new Error('Debe identificarse el usuario que realiza el agendamiento (Regla de Negocio 10).');
    }

    if (!Array.isArray(command.bloques) || command.bloques.length === 0) {
      throw new Error('Debe seleccionar al menos un bloque de horario para agendar la cita (RF-AGE-002).');
    }

    // 1. Obtener o crear paciente in-place (RF-HCL-001 sin perder datos)
    let patient: PatientSummaryDTO;

    if (command.idPaciente) {
      const found = await this.appointmentRepository.findPatientById(command.idPaciente);
      if (!found) {
        throw new Error(`El paciente con ID ${command.idPaciente} no existe en el sistema.`);
      }
      patient = found;
    } else if (command.pacienteNuevo) {
      const p = command.pacienteNuevo;
      if (!p.autorizacionDatos) {
        throw new Error(
          'La autorización de tratamiento de datos es obligatoria para registrar al paciente (RQNF-SEG-005).'
        );
      }

      const birthDate = p.fechaNacimiento instanceof Date ? p.fechaNacimiento : new Date(p.fechaNacimiento);
      if (Number.isNaN(birthDate.getTime()) || birthDate.getTime() > now.getTime()) {
        throw new Error('La fecha de nacimiento del paciente no es válida o es una fecha futura.');
      }

      // Verificar si ya existe por documento
      const existingPatient = await this.appointmentRepository.findPatientByDocument(p.documentoIdentidad.trim());
      if (existingPatient) {
        throw new Error(
          `El documento ${p.documentoIdentidad} ya está registrado a nombre de ${existingPatient.nombreCompleto}.`
        );
      }

      // Calcular si es menor de 18 años para marcar datos incompletos si no tiene acudiente
      const ageDiffMs = now.getTime() - birthDate.getTime();
      const ageYears = ageDiffMs / (1000 * 60 * 60 * 24 * 365.25);
      const isMinor = ageYears < 18;

      patient = await this.appointmentRepository.createPatientInPlace({
        nombreCompleto: p.nombreCompleto.trim(),
        documentoIdentidad: p.documentoIdentidad.trim(),
        correo: p.correo?.trim().toLowerCase(),
        telefono: p.telefono?.trim(),
        fechaNacimiento: birthDate,
        sexo: p.sexo,
        datosIncompletos: isMinor, // Si es menor creado rápido, queda marcado datos incompletos
        autorizacionDatos: true,
      });
    } else {
      throw new Error('Debe seleccionar un paciente existente o suministrar los datos del nuevo paciente (RF-AGE-002).');
    }

    // 2. Resolver servicio y profesional responsable (RF-AGE-012)
    let idProfesionalFinal = command.idProfesional;

    if (!idProfesionalFinal) {
      const serviceConfig = findServiceConfigByName(command.servicio);
      if (!serviceConfig) {
        throw new Error(`El servicio "${command.servicio}" no se encuentra en el catálogo (RF-AGE-012).`);
      }
      const staffList = await this.appointmentRepository.findActiveStaffByRoleCodes([
        serviceConfig.profesionalPorDefecto.rolRequerido,
      ]);
      if (staffList.length === 0) {
        throw new Error(
          `No se encontró un profesional activo para el servicio "${command.servicio}" (${serviceConfig.profesionalPorDefecto.nombre}).`
        );
      }
      idProfesionalFinal = staffList[0].idUsuario;
    }

    const professional = await this.appointmentRepository.findUserById(idProfesionalFinal);
    if (!professional) {
      throw new Error(`El profesional con ID ${idProfesionalFinal} no existe.`);
    }
    if (!professional.estado) {
      throw new Error(`El profesional ${professional.nombreCompleto} se encuentra inactivo (RF-USR-003).`);
    }

    // 3. Normalizar y validar bloques seleccionados
    const parsedBlocks = command.bloques
      .map((b) => (b instanceof Date ? b : new Date(b)))
      .sort((a, b) => a.getTime() - b.getTime());

    for (const b of parsedBlocks) {
      if (Number.isNaN(b.getTime())) {
        throw new Error('Uno o más bloques de horario proporcionados no tienen formato de fecha válido.');
      }
    }

    AppointmentEntity.validateContiguousBlocks(parsedBlocks);

    // 4. Verificar disponibilidad estricta de los bloques en el repositorio
    const existingSlots = await this.appointmentRepository.findSlotsByDates(parsedBlocks);
    if (existingSlots.length !== parsedBlocks.length) {
      throw new Error('Uno o más bloques de horario seleccionados no están configurados en la agenda.');
    }

    for (const slot of existingSlots) {
      if (!slot.estado) {
        throw new Error(
          `El bloque ${ColombiaTime.formatDateTime(slot.inicio)} se encuentra deshabilitado (RF-AGE-001).`
        );
      }
      if (slot.ocupacion) {
        throw new Error(
          `El bloque de horario ${ColombiaTime.formatDateTime(
            slot.inicio
          )} ya fue ocupado desde otra sesión (RF-AGE-002).`
        );
      }
      if (slot.hasStarted(now)) {
        throw new Error(
          `No se puede agendar en el bloque ${ColombiaTime.formatDateTime(slot.inicio)} porque ya ha empezado.`
        );
      }
    }

    // 5. Instanciar y crear la cita de dominio (nace en estado Confirmada y guarda Agendado por)
    const appointmentEntity = AppointmentEntity.scheduleInternal({
      idPaciente: patient.idPaciente,
      idUsuarioProfesional: professional.idUsuario,
      servicio: command.servicio,
      bloques: parsedBlocks,
      titulo: command.titulo,
      descripcion: command.descripcion,
      agendadoPorId: command.ejecutadoPorId,
      agendadoPorNombre: command.ejecutadoPorNombre,
      now,
    });

    const savedAppointment = await this.appointmentRepository.scheduleAppointment(appointmentEntity);

    // 6. Enviar confirmación por correo al paciente (con tolerancia a fallos, RQNF-FIA-004)
    if (this.mailer && patient.correo) {
      try {
        await this.mailer.sendAppointmentConfirmationEmail({
          to: patient.correo,
          nombrePaciente: patient.nombreCompleto,
          servicio: command.servicio,
          nombreProfesional: professional.nombreCompleto,
          fechaInicio: savedAppointment.horaInicio,
          fechaFinal: savedAppointment.horaFinal,
        });
      } catch (mailError: any) {
        // Tolerancia a fallos: no interrumpe el agendamiento guardado
        console.warn('⚠️ Tolerancia a fallos: Correo de confirmación no enviado:', mailError?.message);
        if (this.auditLogger) {
          await this.auditLogger.log({
            usuario: 'Sistema',
            accion: 'Envío de correo fallido (confirmación de cita)',
            registroAfectado: `cita:${savedAppointment.idCita}`,
            valorNuevo: { destinatario: patient.correo, error: mailError?.message },
          });
        }
      }
    }

    // 7. Registro de auditoría (RQNF-SEG-009)
    if (this.auditLogger) {
      await this.auditLogger.log({
        usuario: command.ejecutadoPorNombre,
        accion: 'Agendar cita interna',
        registroAfectado: `cita:${savedAppointment.idCita}`,
        valorNuevo: {
          idCita: savedAppointment.idCita,
          paciente: patient.nombreCompleto,
          profesional: professional.nombreCompleto,
          servicio: command.servicio,
          estado: savedAppointment.estado,
          horaInicio: ColombiaTime.formatDateTime(savedAppointment.horaInicio),
          agendadoPor: command.ejecutadoPorNombre,
        },
      });
    }

    // 8. Notificación en tiempo real (RQNF-DES-002 <= 10s)
    if (this.realtimeNotifier) {
      await this.realtimeNotifier.notifyAgendaChanged({
        type: 'APPOINTMENT_SCHEDULED',
        payload: {
          idCita: savedAppointment.idCita,
          idProfesional: professional.idUsuario,
          servicio: command.servicio,
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
      idProfesional: professional.idUsuario,
      nombreProfesional: professional.nombreCompleto,
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
      message: 'Cita agendada exitosamente en estado Confirmada.',
      data: appointmentDTO,
    };
  }
}
