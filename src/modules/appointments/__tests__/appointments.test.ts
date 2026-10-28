// src/modules/appointments/__tests__/appointments.test.ts
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { TimeSlotEntity } from '../domain/time-slot.entity';
import { AppointmentEntity, DentalServiceType, AppointmentState } from '../domain/appointment.entity';
import { AppointmentRequestEntity } from '../domain/appointment-request.entity';
import {
  IAppointmentRepository,
  IAppointmentMailerPort,
  IAppointmentAuditLoggerPort,
  IAppointmentRealtimeNotifierPort,
  IClinicalRecordCheckerPort,
  PatientSummaryDTO,
  ProfessionalStaffDTO,
  AppointmentDTO,
} from '../domain/appointment.repository.interface';

import { ManageTimeSlotsUseCase } from '../application/manage-time-slots.use-case';
import { ScheduleAppointmentUseCase } from '../application/schedule-appointment.use-case';
import { RequestAppointmentUseCase } from '../application/request-appointment.use-case';
import { NotifyRequestUseCase } from '../application/notify-request.use-case';
import { ReviewRequestUseCase } from '../application/review-request.use-case';
import { UpdateAppointmentUseCase } from '../application/update-appointment.use-case';
import { CancelAppointmentUseCase } from '../application/cancel-appointment.use-case';
import { GetWeeklyAgendaUseCase } from '../application/get-weekly-agenda.use-case';
import { ManageAttentionUseCase } from '../application/manage-attention.use-case';
import { SelectServiceUseCase } from '../application/select-service.use-case';
import { MarkNoShowUseCase } from '../application/mark-no-show.use-case';
import { AppointmentsModulePublicApi } from '../index';
import { ColombiaTime } from '../../../shared/domain/colombia-time.util';

// Implementación en memoria del repositorio para pruebas unitarias y de integración
class InMemoryAppointmentRepository implements IAppointmentRepository {
  public timeSlots: Map<string, TimeSlotEntity> = new Map();
  public requests: Map<number, AppointmentRequestEntity> = new Map();
  public appointments: Map<number, AppointmentEntity> = new Map();
  public patients: Map<number, PatientSummaryDTO> = new Map();
  public staff: Map<number, ProfessionalStaffDTO> = new Map();
  public requestHistory: Array<any> = [];
  public appointmentHistory: Array<any> = [];

  private reqIdSeq = 1;
  private apptIdSeq = 1;
  private patientIdSeq = 1;

  async upsertTimeSlots(slots: TimeSlotEntity[]): Promise<void> {
    for (const slot of slots) {
      this.timeSlots.set(slot.inicio.toISOString(), slot);
    }
  }

  async getTimeSlots(params: { idProfesional?: number; desde?: Date; hasta?: Date }): Promise<TimeSlotEntity[]> {
    return Array.from(this.timeSlots.values()).filter((slot) => {
      if (params.idProfesional && slot.idProfesional && slot.idProfesional !== params.idProfesional) return false;
      if (params.desde && slot.inicio.getTime() < params.desde.getTime()) return false;
      if (params.hasta && slot.final.getTime() > params.hasta.getTime()) return false;
      return true;
    });
  }

  async findSlotsByDates(dates: Date[]): Promise<TimeSlotEntity[]> {
    const res: TimeSlotEntity[] = [];
    for (const d of dates) {
      const slot = this.timeSlots.get(d.toISOString());
      if (slot) res.push(slot);
    }
    return res;
  }

  async releaseSlots(bloques: Date[], keepEnabled = true): Promise<void> {
    for (const b of bloques) {
      const slot = this.timeSlots.get(b.toISOString());
      if (slot) {
        slot.release(keepEnabled);
      }
    }
  }

  async occupySlots(bloques: Date[], now?: Date): Promise<void> {
    for (const b of bloques) {
      const slot = this.timeSlots.get(b.toISOString());
      if (slot && !slot.ocupacion) {
        slot.occupy(now ?? new Date('2026-10-01T00:00:00Z'));
      }
    }
  }

  async createPublicRequest(request: AppointmentRequestEntity): Promise<AppointmentRequestEntity> {
    const id = this.reqIdSeq++;
    const entity = AppointmentRequestEntity.reconstitute({
      idSolicitud: id,
      nombreSolicitante: request.nombreSolicitante,
      documentoSolicitante: request.documentoSolicitante,
      correoSolicitante: request.correoSolicitante,
      telefonoSolicitante: request.telefonoSolicitante,
      fechaNacimiento: request.fechaNacimiento,
      servicio: request.servicio,
      idProfesional: request.idProfesional,
      bloquesSolicitados: [...request.bloquesSolicitados],
      descripcion: request.descripcion,
      autorizacionDatosAceptada: request.autorizacionDatosAceptada,
      versionAvisoPrivacidad: request.versionAvisoPrivacidad,
      fechaSolicitud: request.fechaSolicitud,
      estado: request.estado,
    });
    this.requests.set(id, entity);
    return entity;
  }

  async findRequestById(idSolicitud: number): Promise<AppointmentRequestEntity | null> {
    return this.requests.get(idSolicitud) ?? null;
  }

  async findPendingRequestsByDocumentAndService(
    documento: string,
    servicio: DentalServiceType
  ): Promise<AppointmentRequestEntity[]> {
    return Array.from(this.requests.values()).filter(
      (r) => r.estado && r.documentoSolicitante === documento && r.servicio === servicio
    );
  }

  async findPendingRequests(targetDateLessThanDays?: number): Promise<AppointmentRequestEntity[]> {
    const now = new Date();
    return Array.from(this.requests.values()).filter((r) => {
      if (!r.estado) return false;
      if (targetDateLessThanDays !== undefined) {
        return r.isWithinUrgentNotificationWindow(now);
      }
      return true;
    });
  }

  async updateRequestStatus(idSolicitud: number, estado: boolean): Promise<void> {
    const r = this.requests.get(idSolicitud);
    if (r) {
      const updated = AppointmentRequestEntity.reconstitute({
        idSolicitud: r.idSolicitud,
        nombreSolicitante: r.nombreSolicitante,
        documentoSolicitante: r.documentoSolicitante,
        correoSolicitante: r.correoSolicitante,
        telefonoSolicitante: r.telefonoSolicitante,
        fechaNacimiento: r.fechaNacimiento,
        servicio: r.servicio,
        idProfesional: r.idProfesional,
        bloquesSolicitados: [...r.bloquesSolicitados],
        descripcion: r.descripcion,
        autorizacionDatosAceptada: r.autorizacionDatosAceptada,
        versionAvisoPrivacidad: r.versionAvisoPrivacidad,
        fechaSolicitud: r.fechaSolicitud,
        estado,
      });
      this.requests.set(idSolicitud, updated);
    }
  }

  async recordRequestHistory(entry: any): Promise<void> {
    this.requestHistory.push(entry);
  }

  async scheduleAppointment(appointment: AppointmentEntity): Promise<AppointmentEntity> {
    const id = appointment.idCita ?? this.apptIdSeq++;
    const entity = AppointmentEntity.reconstitute({
      idCita: id,
      titulo: appointment.titulo,
      descripcion: appointment.descripcion,
      idPaciente: appointment.idPaciente,
      idUsuario: appointment.idUsuario,
      servicio: appointment.servicio,
      estado: appointment.estado,
      bloques: [...appointment.bloques],
      agendadoPorId: appointment.agendadoPorId,
      agendadoPorNombre: appointment.agendadoPorNombre,
      estadoRecordatorio: appointment.estadoRecordatorio,
      causaFalloRecordatorio: appointment.causaFalloRecordatorio,
      historialCambios: [...appointment.historialCambios],
    });
    this.appointments.set(id, entity);
    await this.occupySlots([...appointment.bloques]);
    return entity;
  }

  async findAppointmentById(idCita: number): Promise<AppointmentEntity | null> {
    return this.appointments.get(idCita) ?? null;
  }

  async findAppointmentsByProfessionalAndRange(
    idProfesional: number,
    desde: Date,
    hasta: Date
  ): Promise<AppointmentEntity[]> {
    return Array.from(this.appointments.values()).filter(
      (a) =>
        a.idUsuario === idProfesional &&
        a.horaInicio.getTime() >= desde.getTime() &&
        a.horaFinal.getTime() <= hasta.getTime()
    );
  }

  async findAllAppointmentsByRange(desde: Date, hasta: Date): Promise<AppointmentEntity[]> {
    return Array.from(this.appointments.values()).filter(
      (a) => a.horaInicio.getTime() >= desde.getTime() && a.horaFinal.getTime() <= hasta.getTime()
    );
  }

  async findActiveConsultationByProfessional(idProfesional: number): Promise<AppointmentEntity | null> {
    return (
      Array.from(this.appointments.values()).find(
        (a) => a.idUsuario === idProfesional && a.estado === 'En consulta'
      ) ?? null
    );
  }

  async findActiveConsultationByPatient(idPaciente: number): Promise<AppointmentEntity | null> {
    return (
      Array.from(this.appointments.values()).find(
        (a) => a.idPaciente === idPaciente && a.estado === 'En consulta'
      ) ?? null
    );
  }

  async findAppointmentsByPatient(idPaciente: number): Promise<AppointmentDTO[]> {
    return Array.from(this.appointments.values())
      .filter((a) => a.idPaciente === idPaciente)
      .map((a) => ({
        idCita: a.idCita!,
        titulo: a.titulo,
        descripcion: a.descripcion,
        idPaciente: a.idPaciente,
        idProfesional: a.idUsuario,
        servicio: a.servicio,
        estado: a.estado,
        bloques: [...a.bloques],
        horaInicio: a.horaInicio,
        horaFinal: a.horaFinal,
        agendadoPorId: a.agendadoPorId,
        agendadoPorNombre: a.agendadoPorNombre,
        estadoRecordatorio: a.estadoRecordatorio,
        causaFalloRecordatorio: a.causaFalloRecordatorio,
        historialCambios: [...a.historialCambios],
      }))
      .sort((a, b) => b.horaInicio.getTime() - a.horaInicio.getTime());
  }

  async countActiveAppointmentsByProfessional(idProfesional: number): Promise<number> {
    return Array.from(this.appointments.values()).filter(
      (a) => a.idUsuario === idProfesional && a.isActiveForProfessionalCheck()
    ).length;
  }

  async updateAppointment(appointment: AppointmentEntity): Promise<AppointmentEntity> {
    this.appointments.set(appointment.idCita!, appointment);
    return appointment;
  }

  async recordAppointmentHistory(idCita: number, change: any): Promise<void> {
    this.appointmentHistory.push({ idCita, ...change });
  }

  async findPatientByDocument(documento: string): Promise<PatientSummaryDTO | null> {
    return (
      Array.from(this.patients.values()).find(
        (p) => p.documentoIdentidad.toLowerCase() === documento.toLowerCase()
      ) ?? null
    );
  }

  async findPatientById(idPaciente: number): Promise<PatientSummaryDTO | null> {
    return this.patients.get(idPaciente) ?? null;
  }

  async createPatientInPlace(data: any): Promise<PatientSummaryDTO> {
    const id = this.patientIdSeq++;
    const p: PatientSummaryDTO = {
      idPaciente: id,
      nombreCompleto: data.nombreCompleto,
      documentoIdentidad: data.documentoIdentidad,
      correo: data.correo ?? null,
      telefono: data.telefono ?? null,
      fechaNacimiento: data.fechaNacimiento,
      sexo: data.sexo ?? null,
      datosIncompletos: data.datosIncompletos,
    };
    this.patients.set(id, p);
    return p;
  }

  async findActiveStaffByRoleCodes(roleCodes: string[]): Promise<ProfessionalStaffDTO[]> {
    const upperCodes = roleCodes.map((c) => c.toUpperCase());
    return Array.from(this.staff.values()).filter(
      (s) => s.estado && s.roles.some((r) => upperCodes.includes(r.toUpperCase()))
    );
  }

  async findUserById(idUsuario: number): Promise<ProfessionalStaffDTO | null> {
    return this.staff.get(idUsuario) ?? null;
  }
}

class MockMailer implements IAppointmentMailerPort {
  public sentMails: Array<{ type: string; payload: any }> = [];

  async sendAppointmentConfirmationEmail(params: any): Promise<void> {
    this.sentMails.push({ type: 'CONFIRMATION', payload: params });
  }
  async sendPublicRequestReceivedEmail(params: any): Promise<void> {
    this.sentMails.push({ type: 'REQUEST_RECEIVED', payload: params });
  }
  async sendStaffNewRequestNotificationEmail(params: any): Promise<void> {
    this.sentMails.push({ type: 'STAFF_NOTIFICATION', payload: params });
  }
  async sendDailyPendingRequestsSummaryEmail(params: any): Promise<void> {
    this.sentMails.push({ type: 'DAILY_SUMMARY', payload: params });
  }
  async sendRequestApprovedEmail(params: any): Promise<void> {
    this.sentMails.push({ type: 'REQUEST_APPROVED', payload: params });
  }
  async sendRequestRejectedEmail(params: any): Promise<void> {
    this.sentMails.push({ type: 'REQUEST_REJECTED', payload: params });
  }
  async sendAppointmentRescheduledEmail(params: any): Promise<void> {
    this.sentMails.push({ type: 'RESCHEDULED', payload: params });
  }
  async sendAppointmentCancelledEmail(params: any): Promise<void> {
    this.sentMails.push({ type: 'CANCELLED', payload: params });
  }
  async sendAppointmentReminderEmail(params: any): Promise<void> {
    this.sentMails.push({ type: 'REMINDER', payload: params });
  }
}

class MockAuditLogger implements IAppointmentAuditLoggerPort {
  public logs: Array<any> = [];
  async log(entry: any): Promise<void> {
    this.logs.push(entry);
  }
}

class MockRealtimeNotifier implements IAppointmentRealtimeNotifierPort {
  public events: Array<any> = [];
  async notifyAgendaChanged(event: any): Promise<void> {
    this.events.push(event);
  }
}

describe('MÓDULO B: Agendamiento de Citas (RF-AGE-001 a RF-AGE-013)', () => {
  let repo: InMemoryAppointmentRepository;
  let mailer: MockMailer;
  let auditLogger: MockAuditLogger;
  let realtime: MockRealtimeNotifier;

  const DR_EDUAR_ID = 10;
  const DRA_NATALIA_ID = 20;
  const COA_USER_ID = 30;

  beforeEach(() => {
    repo = new InMemoryAppointmentRepository();
    mailer = new MockMailer();
    auditLogger = new MockAuditLogger();
    realtime = new MockRealtimeNotifier();

    // Semilla de usuarios activos
    repo.staff.set(DR_EDUAR_ID, {
      idUsuario: DR_EDUAR_ID,
      nombreCompleto: 'Dr. Eduar Leal Álvarez',
      documentoIdentidad: '1098765432',
      correo: 'dr.leal@odontoleal.com',
      telefono: '3001234567',
      estado: true,
      roles: ['ROL-ODO', 'ROL-ADM'],
    });

    repo.staff.set(DRA_NATALIA_ID, {
      idUsuario: DRA_NATALIA_ID,
      nombreCompleto: 'Dra. Natalia Díaz',
      documentoIdentidad: '1087654321',
      correo: 'dra.diaz@odontoleal.com',
      telefono: '3109876543',
      estado: true,
      roles: ['ROL-ESP'],
    });

    repo.staff.set(COA_USER_ID, {
      idUsuario: COA_USER_ID,
      nombreCompleto: 'Daniela Guerrero',
      documentoIdentidad: '1076543210',
      correo: 'agenda@odontoleal.com',
      telefono: '3201112233',
      estado: true,
      roles: ['ROL-COA'],
    });
  });

  it('RF-AGE-001: Habilitar y deshabilitar bloques de horario con repetición semanal', async () => {
    const useCase = new ManageTimeSlotsUseCase(repo, auditLogger, realtime);
    const simulatedNow = new Date('2026-10-01T12:00:00Z');

    // Habilitar bloques el 2026-10-05 de 08:00 a 09:30 con repetición semanal por 2 semanas
    const result = await useCase.execute({
      ejecutadoPorUsuario: 'Daniela Guerrero',
      idProfesional: DR_EDUAR_ID,
      fecha: '2026-10-05',
      bloques: ['08:00', '08:30', '09:00'],
      accion: 'HABILITAR',
      fechaFinalRepeticionSemanal: '2026-10-19',
      now: simulatedNow,
    });

    assert.strictEqual(result.fechasAfectadas.length, 3); // 5, 12, 19 oct
    assert.strictEqual(result.totalBloquesAfectados, 9); // 3 bloques x 3 semanas
    assert.strictEqual(realtime.events.length, 1);
  });

  it('RF-AGE-002: Agendar cita interna en estado Confirmada con "Agendado por"', async () => {
    const manageSlots = new ManageTimeSlotsUseCase(repo, auditLogger, realtime);
    const schedule = new ScheduleAppointmentUseCase(repo, mailer, auditLogger, realtime);
    const simulatedNow = new Date('2026-10-01T12:00:00Z');

    // Configurar bloques primero
    await manageSlots.execute({
      ejecutadoPorUsuario: 'Daniela Guerrero',
      idProfesional: DR_EDUAR_ID,
      fecha: '2026-10-06',
      bloques: ['09:00', '09:30'],
      accion: 'HABILITAR',
      now: simulatedNow,
    });

    const b1 = ColombiaTime.parseColombiaSlot('2026-10-06', '09:00');
    const b2 = ColombiaTime.parseColombiaSlot('2026-10-06', '09:30');

    // Agendar cita con paciente nuevo inline
    const result = await schedule.execute({
      ejecutadoPorId: COA_USER_ID,
      ejecutadoPorNombre: 'Daniela Guerrero',
      pacienteNuevo: {
        nombreCompleto: 'Carlos Mendoza',
        documentoIdentidad: '1099887766',
        correo: 'carlos@ejemplo.com',
        telefono: '3157778899',
        fechaNacimiento: '1995-05-15',
        sexo: 'Masculino',
        autorizacionDatos: true,
      },
      servicio: 'Odontología general',
      idProfesional: DR_EDUAR_ID,
      bloques: [b1, b2],
      now: simulatedNow,
    });

    assert.strictEqual(result.data.estado, 'Confirmada');
    assert.strictEqual(result.data.agendadoPorNombre, 'Daniela Guerrero');
    assert.strictEqual(mailer.sentMails.length, 1);
    assert.strictEqual(mailer.sentMails[0].type, 'CONFIRMATION');
  });

  it('RF-AGE-003: Solicitud pública con reserva exclusiva y validación de ventana 5-60 días', async () => {
    const manageSlots = new ManageTimeSlotsUseCase(repo, auditLogger, realtime);
    const requestUseCase = new RequestAppointmentUseCase(repo, mailer, auditLogger, realtime);
    const simulatedNow = new Date('2026-10-01T12:00:00Z');

    // Habilitar bloques el 2026-10-08 (a 7 días de hoy, dentro de la ventana de 5 a 60 días)
    await manageSlots.execute({
      ejecutadoPorUsuario: 'Sistema',
      idProfesional: DRA_NATALIA_ID,
      fecha: '2026-10-08',
      bloques: ['10:00', '10:30'],
      accion: 'HABILITAR',
      now: simulatedNow,
    });

    const b1 = ColombiaTime.parseColombiaSlot('2026-10-08', '10:00');
    const b2 = ColombiaTime.parseColombiaSlot('2026-10-08', '10:30');

    // Intento con fecha antes de 5 días debe fallar (Regla de Negocio 2)
    await assert.rejects(
      async () => {
        const tooEarlyBlock = ColombiaTime.parseColombiaSlot('2026-10-03', '10:00');
        await requestUseCase.execute({
          servicio: 'Ortodoncia',
          idProfesional: DRA_NATALIA_ID,
          bloques: [tooEarlyBlock],
          documentoIdentidad: '1099999999',
          nombreCompleto: 'Laura Gómez',
          correoElectronico: 'laura@test.com',
          autorizacionDatos: true,
          now: simulatedNow,
        });
      },
      /Solo se aceptan solicitudes para fechas entre 5 y 60 días/
    );

    // Solicitud válida a 7 días
    const validRes = await requestUseCase.execute({
      servicio: 'Ortodoncia',
      idProfesional: DRA_NATALIA_ID,
      bloques: [b1, b2],
      documentoIdentidad: '1099999999',
      nombreCompleto: 'Laura Gómez',
      correoElectronico: 'laura@test.com',
      telefono: '3112223344',
      autorizacionDatos: true,
      now: simulatedNow,
    });

    assert.ok(validRes.data.idSolicitud);
    assert.strictEqual(validRes.data.bloquesSolicitados.length, 2);

    // Los bloques quedan ocupados (Regla de Negocio 1)
    const slotCheck = await repo.findSlotsByDates([b1]);
    assert.strictEqual(slotCheck[0].ocupacion, true);
  });

  it('RF-AGE-004: Notificación escalada de solicitudes (COA -> AUX -> ADM) y aviso diario', async () => {
    const requestUseCase = new RequestAppointmentUseCase(repo, mailer, auditLogger, realtime);
    const notifyUseCase = new NotifyRequestUseCase(repo, mailer, auditLogger);
    const simulatedNow = new Date('2026-10-01T12:00:00Z');

    // Habilitar bloque a 6 días
    const b1 = ColombiaTime.parseColombiaSlot('2026-10-07', '14:00');
    await repo.upsertTimeSlots([
      TimeSlotEntity.create({ inicio: b1, idProfesional: DR_EDUAR_ID, estado: true, ocupacion: false }),
    ]);

    const reqResult = await requestUseCase.execute({
      servicio: 'Odontología general',
      idProfesional: DR_EDUAR_ID,
      bloques: [b1],
      documentoIdentidad: '1010101010',
      nombreCompleto: 'Felipe Ramos',
      correoElectronico: 'felipe@test.com',
      autorizacionDatos: true,
      now: simulatedNow,
    });

    // Notificar nueva solicitud (debe dirigirse a Daniela Guerrero ROL-COA)
    const notifResult = await notifyUseCase.executeNotifyNewRequest({
      idSolicitud: reqResult.data.idSolicitud,
    });

    assert.strictEqual(notifResult.enviado, true);
    assert.strictEqual(notifResult.destinatariosNotificados[0], 'agenda@odontoleal.com');
  });

  it('RF-AGE-005: Revisar solicitud -> Confirmar crea paciente "Datos incompletos"', async () => {
    const requestUseCase = new RequestAppointmentUseCase(repo, mailer, auditLogger, realtime);
    const reviewUseCase = new ReviewRequestUseCase(repo, mailer, auditLogger, realtime);
    const simulatedNow = new Date('2026-10-01T12:00:00Z');

    const b1 = ColombiaTime.parseColombiaSlot('2026-10-09', '09:00');
    await repo.upsertTimeSlots([
      TimeSlotEntity.create({ inicio: b1, idProfesional: DR_EDUAR_ID, estado: true, ocupacion: false }),
    ]);

    const reqResult = await requestUseCase.execute({
      servicio: 'Odontología general',
      idProfesional: DR_EDUAR_ID,
      bloques: [b1],
      documentoIdentidad: '7788990011',
      nombreCompleto: 'Mariana Suarez',
      correoElectronico: 'mariana@test.com',
      telefono: '3124445566',
      autorizacionDatos: true,
      now: simulatedNow,
    });

    // Confirmar solicitud
    const confirmResult = await reviewUseCase.execute({
      idSolicitud: reqResult.data.idSolicitud,
      decision: 'CONFIRMAR',
      idUsuarioGestor: COA_USER_ID,
      nombreUsuarioGestor: 'Daniela Guerrero',
      now: simulatedNow,
    });

    assert.strictEqual(confirmResult.decision, 'CONFIRMAR');
    assert.strictEqual(confirmResult.pacienteCreado, true);
    assert.strictEqual(confirmResult.cita?.estado, 'Confirmada');

    // Verificar marca "Datos incompletos" en el paciente
    const createdPatient = await repo.findPatientByDocument('7788990011');
    assert.strictEqual(createdPatient?.datosIncompletos, true);
  });

  it('RF-AGE-006 & RF-AGE-007: Editar y Cancelar cita confirmada', async () => {
    const schedule = new ScheduleAppointmentUseCase(repo, mailer, auditLogger, realtime);
    const updateUseCase = new UpdateAppointmentUseCase(repo, mailer, auditLogger, realtime);
    const cancelUseCase = new CancelAppointmentUseCase(repo, mailer, auditLogger, realtime);
    const simulatedNow = new Date('2026-10-01T12:00:00Z');

    const b1 = ColombiaTime.parseColombiaSlot('2026-10-06', '09:00');
    const b2 = ColombiaTime.parseColombiaSlot('2026-10-06', '10:00');
    await repo.upsertTimeSlots([
      TimeSlotEntity.create({ inicio: b1, idProfesional: DR_EDUAR_ID, estado: true, ocupacion: false }),
      TimeSlotEntity.create({ inicio: b2, idProfesional: DR_EDUAR_ID, estado: true, ocupacion: false }),
    ]);

    const schedRes = await schedule.execute({
      ejecutadoPorId: COA_USER_ID,
      ejecutadoPorNombre: 'Daniela Guerrero',
      pacienteNuevo: {
        nombreCompleto: 'Andrés López',
        documentoIdentidad: '1055566677',
        correo: 'andres@test.com',
        fechaNacimiento: '1990-01-01',
        autorizacionDatos: true,
      },
      servicio: 'Odontología general',
      idProfesional: DR_EDUAR_ID,
      bloques: [b1],
      now: simulatedNow,
    });

    // Editar cita: cambiar a b2
    const updateRes = await updateUseCase.execute({
      idCita: schedRes.data.idCita,
      idUsuarioGestor: COA_USER_ID,
      nombreUsuarioGestor: 'Daniela Guerrero',
      nuevosBloques: [b2],
      confirmadoPorUsuario: true,
      now: simulatedNow,
    });

    assert.strictEqual(updateRes.data.bloques[0].getTime(), b2.getTime());

    // Cancelar cita
    const cancelRes = await cancelUseCase.execute({
      idCita: schedRes.data.idCita,
      idUsuarioGestor: COA_USER_ID,
      nombreUsuarioGestor: 'Daniela Guerrero',
      motivo: 'Paciente solicitó reprogramación telefónica',
      destinoBloques: 'DISPONIBLE',
      now: simulatedNow,
    });

    assert.strictEqual(cancelRes.data.estado, 'Cancelada');
    // Bloque b2 debe quedar liberado
    const b2Check = await repo.findSlotsByDates([b2]);
    assert.strictEqual(b2Check[0].ocupacion, false);
  });

  it('RF-AGE-008: Consultar agenda semanal respetando roles y filtros', async () => {
    const agendaUseCase = new GetWeeklyAgendaUseCase(repo);
    const schedule = new ScheduleAppointmentUseCase(repo, mailer, auditLogger, realtime);
    const simulatedNow = new Date('2026-10-05T12:00:00Z'); // Lunes 5 de octubre

    const b1 = ColombiaTime.parseColombiaSlot('2026-10-05', '08:00');
    await repo.upsertTimeSlots([
      TimeSlotEntity.create({ inicio: b1, idProfesional: DR_EDUAR_ID, estado: true, ocupacion: false }),
    ]);

    await schedule.execute({
      ejecutadoPorId: COA_USER_ID,
      ejecutadoPorNombre: 'Daniela Guerrero',
      pacienteNuevo: {
        nombreCompleto: 'Gloria Estefan',
        documentoIdentidad: '55667788',
        correo: 'gloria@test.com',
        fechaNacimiento: '1980-01-01',
        autorizacionDatos: true,
      },
      servicio: 'Odontología general',
      idProfesional: DR_EDUAR_ID,
      bloques: [b1],
      now: simulatedNow,
    });

    const weeklyAgenda = await agendaUseCase.execute({
      idUsuarioConsultor: DR_EDUAR_ID,
      rolesConsultor: ['ROL-ODO'],
      semanaFechaReferencia: '2026-10-05',
    });

    assert.strictEqual(weeklyAgenda.idProfesional, DR_EDUAR_ID);
    assert.strictEqual(weeklyAgenda.dias.length, 7);
    const monday = weeklyAgenda.dias[0];
    assert.strictEqual(monday.nombreDia, 'Lunes');
    assert.strictEqual(monday.bloques[0].colorEstado, 'rojo');
    assert.strictEqual(monday.bloques[0].cita?.nombrePaciente, 'Gloria Estefan');
  });

  it('RF-AGE-009: Iniciar y finalizar atención (control motivo consulta y único en consulta)', async () => {
    let motivoRegistrado = false;
    const clinicalChecker: IClinicalRecordCheckerPort = {
      hasConsultationReasonRegistered: async () => motivoRegistrado,
    };

    const attentionUseCase = new ManageAttentionUseCase(repo, clinicalChecker, auditLogger, realtime);
    const schedule = new ScheduleAppointmentUseCase(repo, mailer, auditLogger, realtime);
    const bookingNow = new Date('2026-10-01T10:00:00Z');
    const simulatedNow = new Date('2026-10-05T19:05:00Z'); // 14:05 hora de Colombia (durante la cita)

    const b1 = ColombiaTime.parseColombiaSlot('2026-10-05', '14:00');
    await repo.upsertTimeSlots([
      TimeSlotEntity.create({ inicio: b1, idProfesional: DR_EDUAR_ID, estado: true, ocupacion: false }),
    ]);

    const sched = await schedule.execute({
      ejecutadoPorId: COA_USER_ID,
      ejecutadoPorNombre: 'Daniela Guerrero',
      pacienteNuevo: {
        nombreCompleto: 'Patricia Reyes',
        documentoIdentidad: '44556677',
        fechaNacimiento: '1992-03-10',
        autorizacionDatos: true,
      },
      servicio: 'Odontología general',
      idProfesional: DR_EDUAR_ID,
      bloques: [b1],
      now: bookingNow,
    });

    // Iniciar atención (Confirmada -> En consulta)
    const initRes = await attentionUseCase.execute({
      accion: 'INICIAR',
      idCita: sched.data.idCita,
      idProfesionalEjecutor: DR_EDUAR_ID,
      nombreProfesionalEjecutor: 'Dr. Eduar Leal Álvarez',
      now: simulatedNow,
    });

    assert.strictEqual(initRes.data.estado, 'En consulta');

    // Intentar finalizar sin motivo debe lanzar error
    await assert.rejects(
      async () => {
        await attentionUseCase.execute({
          accion: 'FINALIZAR',
          idCita: sched.data.idCita,
          idProfesionalEjecutor: DR_EDUAR_ID,
          nombreProfesionalEjecutor: 'Dr. Eduar Leal Álvarez',
          now: simulatedNow,
        });
      },
      /Falta registrar el motivo de consulta/
    );

    // Con motivo registrado: finaliza exitosamente
    motivoRegistrado = true;
    const finRes = await attentionUseCase.execute({
      accion: 'FINALIZAR',
      idCita: sched.data.idCita,
      idProfesionalEjecutor: DR_EDUAR_ID,
      nombreProfesionalEjecutor: 'Dr. Eduar Leal Álvarez',
      now: simulatedNow,
    });

    assert.strictEqual(finRes.data.estado, 'Atendida');
  });

  it('RF-AGE-013: Marcar inasistencia y verificar que bloques NO se liberan', async () => {
    const noShowUseCase = new MarkNoShowUseCase(repo, auditLogger, realtime);
    const schedule = new ScheduleAppointmentUseCase(repo, mailer, auditLogger, realtime);
    const bookingNow = new Date('2026-10-01T10:00:00Z');
    const slotTime = ColombiaTime.parseColombiaSlot('2026-10-05', '10:00');
    const pastSlotTime = new Date(slotTime.getTime() + 20 * 60 * 1000); // 10:20 a. m.

    await repo.upsertTimeSlots([
      TimeSlotEntity.create({ inicio: slotTime, idProfesional: DR_EDUAR_ID, estado: true, ocupacion: false }),
    ]);

    const sched = await schedule.execute({
      ejecutadoPorId: COA_USER_ID,
      ejecutadoPorNombre: 'Daniela Guerrero',
      pacienteNuevo: {
        nombreCompleto: 'Juan Ausente',
        documentoIdentidad: '9988776655',
        fechaNacimiento: '1985-06-20',
        autorizacionDatos: true,
      },
      servicio: 'Odontología general',
      idProfesional: DR_EDUAR_ID,
      bloques: [slotTime],
      now: bookingNow,
    });

    // Marcar inasistencia a las 10:20
    const noShowRes = await noShowUseCase.execute({
      idCita: sched.data.idCita,
      idUsuarioGestor: COA_USER_ID,
      nombreUsuarioGestor: 'Daniela Guerrero',
      rolesGestor: ['ROL-COA'],
      observacion: 'El paciente no se presentó ni contestó llamadas',
      confirmado: true,
      now: pastSlotTime,
    });

    assert.strictEqual(noShowRes.data.estado, 'Inasistencia');

    // Regla RF-AGE-013: Bloques no se liberan (permanecen ocupados)
    const slotCheck = await repo.findSlotsByDates([slotTime]);
    assert.strictEqual(slotCheck[0].ocupacion, true);
  });

  it('RF-AGE-012: Seleccionar servicio y profesional (catálogo configurable)', async () => {
    const selectService = new SelectServiceUseCase(repo);
    const simulatedNow = new Date('2026-10-01T12:00:00Z');

    // Habilitar un bloque para el Dr. Eduar Leal a 10 días (dentro de 5-60 días)
    const b1 = ColombiaTime.parseColombiaSlot('2026-10-11', '08:00');
    await repo.upsertTimeSlots([
      TimeSlotEntity.create({ inicio: b1, idProfesional: DR_EDUAR_ID, estado: true, ocupacion: false }),
    ]);

    const result = await selectService.execute({
      contexto: 'PUBLICO',
      now: simulatedNow,
    });

    assert.ok(result.servicios.length >= 2);
    const odoGen = result.servicios.find((s) => s.nombre === 'Odontología general');
    assert.ok(odoGen);
    assert.strictEqual(odoGen?.profesional.idUsuario, DR_EDUAR_ID);
    assert.strictEqual(odoGen?.tieneDisponibilidad, true);

    const orto = result.servicios.find((s) => s.nombre === 'Ortodoncia');
    assert.ok(orto);
    assert.strictEqual(orto?.profesional.idUsuario, DRA_NATALIA_ID);
    assert.strictEqual(orto?.tieneDisponibilidad, false); // No le hemos creado bloques aún
  });

  it('AppointmentsModulePublicApi: Interoperabilidad con otros módulos (Regla 5 y RF-HCL-004)', async () => {
    const publicApi = new AppointmentsModulePublicApi(repo);
    const attentionUseCase = new ManageAttentionUseCase(repo, undefined, auditLogger, realtime);
    const schedule = new ScheduleAppointmentUseCase(repo, mailer, auditLogger, realtime);
    const bookingNow = new Date('2026-10-01T10:00:00Z');
    const simulatedNow = new Date('2026-10-05T20:05:00Z'); // 15:05 hora de Colombia

    const b1 = ColombiaTime.parseColombiaSlot('2026-10-05', '15:00');
    await repo.upsertTimeSlots([
      TimeSlotEntity.create({ inicio: b1, idProfesional: DR_EDUAR_ID, estado: true, ocupacion: false }),
    ]);

    const sched = await schedule.execute({
      ejecutadoPorId: COA_USER_ID,
      ejecutadoPorNombre: 'Daniela Guerrero',
      pacienteNuevo: {
        nombreCompleto: 'Sara Connor',
        documentoIdentidad: '12345678',
        fechaNacimiento: '1984-05-12',
        autorizacionDatos: true,
      },
      servicio: 'Odontología general',
      idProfesional: DR_EDUAR_ID,
      bloques: [b1],
      now: bookingNow,
    });

    // Antes de iniciar: no está En consulta
    let inConsultation = await publicApi.isPatientInActiveConsultation(sched.data.idPaciente);
    assert.strictEqual(inConsultation, false);

    // Iniciar atención
    await attentionUseCase.execute({
      accion: 'INICIAR',
      idCita: sched.data.idCita,
      idProfesionalEjecutor: DR_EDUAR_ID,
      nombreProfesionalEjecutor: 'Dr. Eduar Leal Álvarez',
      now: simulatedNow,
    });

    // Ahora está En consulta (autoriza a ROL-AUX)
    inConsultation = await publicApi.isPatientInActiveConsultation(sched.data.idPaciente);
    assert.strictEqual(inConsultation, true);

    const activeDetails = await publicApi.getActiveConsultationForPatient(sched.data.idPaciente);
    assert.strictEqual(activeDetails?.idCita, sched.data.idCita);

    // Historial de citas del paciente
    const patientHistory = await publicApi.getPatientAppointmentHistory(sched.data.idPaciente);
    assert.strictEqual(patientHistory.length, 1);
    assert.strictEqual(patientHistory[0].agendadoPorNombre, 'Daniela Guerrero');
  });
});
