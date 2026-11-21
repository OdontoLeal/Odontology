// src/modules/appointments/__tests__/consultation-timeout.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  ConsultationTimeoutPolicy,
  ActiveConsultationConflictError,
  AppointmentEntity,
  ManageAttentionUseCase,
  IAppointmentRepository,
  TimeSlotEntity,
  DentalServiceType,
} from '../index';

describe('Vigencia Temporal y Resolución de Citas En Consulta (RF-AGE-009, RF-AGE-010)', () => {
  describe('ConsultationTimeoutPolicy (Servicio de Dominio)', () => {
    it('calcula correctamente los minutos transcurridos entre dos fechas', () => {
      const from = new Date('2026-11-20T10:00:00Z');
      const to = new Date('2026-11-20T10:45:00Z');
      const elapsed = ConsultationTimeoutPolicy.calculateElapsedMinutes(from, to);
      assert.strictEqual(elapsed, 45);
    });

    it('identifica cuando no ha superado el margen de gracia (dentro de tiempo)', () => {
      const scheduledEnd = new Date('2026-11-20T10:30:00Z');
      const now = new Date('2026-11-20T11:00:00Z'); // +30 min (gracia es 45 min)
      const isExceeded = ConsultationTimeoutPolicy.isGracePeriodExceeded(scheduledEnd, now, 45);
      assert.strictEqual(isExceeded, false);
    });

    it('detecta cuando se supera el margen de gracia tras el fin programado', () => {
      const scheduledEnd = new Date('2026-11-20T10:30:00Z');
      const now = new Date('2026-11-20T11:20:00Z'); // +50 min (> 45 min)
      const isExceeded = ConsultationTimeoutPolicy.isGracePeriodExceeded(scheduledEnd, now, 45);
      assert.strictEqual(isExceeded, true);
    });

    it('detecta Hard Timeout cuando la atención supera 180 minutos continuos', () => {
      const attentionStart = new Date('2026-11-20T08:00:00Z');
      const now = new Date('2026-11-20T11:05:00Z'); // 185 min
      const isHardTimeout = ConsultationTimeoutPolicy.isHardTimeoutExceeded(attentionStart, now, 180);
      assert.strictEqual(isHardTimeout, true);
    });

    it('evaluateConsultationTimeout retorna evaluación detallada de vigencia', () => {
      const scheduledEnd = new Date('2026-11-20T09:00:00Z');
      const attentionStart = new Date('2026-11-20T08:30:00Z');
      const now = new Date('2026-11-20T09:50:00Z'); // +50 min tras fin (gracia 45)

      const evalResult = ConsultationTimeoutPolicy.evaluateConsultationTimeout({
        scheduledEndTime: scheduledEnd,
        attentionStartTime: attentionStart,
        now,
        graceMinutes: 45,
        hardTimeoutMinutes: 180,
      });

      assert.strictEqual(evalResult.isOverdue, true);
      assert.strictEqual(evalResult.reason, 'GRACE_PERIOD_EXCEEDED');
      assert.strictEqual(evalResult.elapsedMinutes, 80);
      assert.strictEqual(evalResult.overdueMinutes, 5);
    });
  });

  describe('ActiveConsultationConflictError (Error Estructurado)', () => {
    it('instancia error 409 con código ACTIVE_CONSULTATION_CONFLICT y metadatos', () => {
      const err = new ActiveConsultationConflictError('El profesional ya tiene otra cita En consulta.', {
        idCita: 105,
        idPaciente: 42,
        nombrePaciente: 'Carlos Mendoza',
        horaInicio: '2026-11-20 08:00',
        horaFin: '2026-11-20 08:30',
        minutosTranscurridos: 75,
        tiempoExcedido: true,
      });

      assert.strictEqual(err.statusCode, 409);
      assert.strictEqual(err.code, 'ACTIVE_CONSULTATION_CONFLICT');
      assert.strictEqual(err.message, 'El profesional ya tiene otra cita En consulta.');
      assert.strictEqual(err.activeAppointment?.idCita, 105);
      assert.strictEqual(err.activeAppointment?.nombrePaciente, 'Carlos Mendoza');
      assert.strictEqual(err.activeAppointment?.tiempoExcedido, true);
    });
  });

  describe('AppointmentEntity.finalizarAtencionPorTimeout', () => {
    it('permite cerrar una cita En consulta por timeout sin exigir motivo previo', () => {
      const slot = TimeSlotEntity.create({
        inicio: new Date('2026-11-20T13:00:00Z'),
        idProfesional: 1,
        estado: true,
        ocupacion: true,
      });

      const appt = AppointmentEntity.reconstitute({
        idCita: 201,
        titulo: 'Valoración inicial',
        descripcion: null,
        idPaciente: 10,
        idUsuario: 1,
        servicio: 'Odontología general' as DentalServiceType,
        estado: 'Confirmada',
        bloques: [slot.inicio],
      });

      // Pasar a En consulta
      appt.iniciarAtencion({
        idProfesionalEjecutor: 1,
        nombreProfesionalEjecutor: 'Dra. Ana López',
        now: new Date('2026-11-20T13:05:00Z'),
      });
      assert.strictEqual(appt.estado, 'En consulta');

      // Finalizar por timeout
      appt.finalizarAtencionPorTimeout({
        idUsuarioGestor: 1,
        nombreUsuarioGestor: 'Dra. Ana López',
        motivo: 'Cierre por tiempo límite excedido',
        now: new Date('2026-11-20T15:00:00Z'),
      });

      assert.strictEqual(appt.estado, 'Atendida');
      const lastHistory = appt.historialCambios[appt.historialCambios.length - 1];
      assert.strictEqual(lastHistory.estadoNuevo, 'Atendida');
      assert.strictEqual(lastHistory.motivo, 'Cierre por tiempo límite excedido');
    });

    it('rechaza finalizar por timeout si la cita no está En consulta', () => {
      const slot = TimeSlotEntity.create({
        inicio: new Date('2026-11-20T13:00:00Z'),
        idProfesional: 1,
        estado: true,
        ocupacion: true,
      });

      const appt = AppointmentEntity.reconstitute({
        idCita: 202,
        titulo: 'Valoración inicial',
        descripcion: null,
        idPaciente: 10,
        idUsuario: 1,
        servicio: 'Odontología general' as DentalServiceType,
        estado: 'Confirmada',
        bloques: [slot.inicio],
      });

      assert.throws(
        () => {
          appt.finalizarAtencionPorTimeout({
            idUsuarioGestor: 1,
            nombreUsuarioGestor: 'Dra. Ana López',
          });
        },
        /Solo se puede finalizar una cita que esté En consulta/
      );
    });
  });

  describe('ManageAttentionUseCase - Resolución de Conflicto y Traspaso de Cita', () => {
    it('lanza ActiveConsultationConflictError estructurado si no se indica forzarCierreCitaPreviaId', async () => {
      const appointments = new Map<number, AppointmentEntity>();

      const slot1 = TimeSlotEntity.create({
        inicio: new Date('2026-11-20T13:00:00Z'),
        idProfesional: 5,
        estado: true,
        ocupacion: true,
      });
      const cita1 = AppointmentEntity.reconstitute({
        idCita: 101,
        titulo: 'Cita 1',
        descripcion: null,
        idPaciente: 1,
        idUsuario: 5,
        servicio: 'Odontología general' as DentalServiceType,
        estado: 'Confirmada',
        bloques: [slot1.inicio],
      });
      cita1.iniciarAtencion({
        idProfesionalEjecutor: 5,
        nombreProfesionalEjecutor: 'Dr. Test',
        now: new Date('2026-11-20T13:02:00Z'),
      });
      appointments.set(101, cita1);

      const slot2 = TimeSlotEntity.create({
        inicio: new Date('2026-11-20T14:00:00Z'),
        idProfesional: 5,
        estado: true,
        ocupacion: true,
      });
      const cita2 = AppointmentEntity.reconstitute({
        idCita: 102,
        titulo: 'Cita 2',
        descripcion: null,
        idPaciente: 2,
        idUsuario: 5,
        servicio: 'Odontología general' as DentalServiceType,
        estado: 'Confirmada',
        bloques: [slot2.inicio],
      });
      appointments.set(102, cita2);

      const mockRepo: Partial<IAppointmentRepository> = {
        findAppointmentById: async (id: number) => appointments.get(id) ?? null,
        findActiveConsultationByProfessional: async (idProfesional: number) => {
          return Array.from(appointments.values()).find(
            (a) => a.idUsuario === idProfesional && a.estado === 'En consulta'
          ) ?? null;
        },
        updateAppointment: async (appt: AppointmentEntity) => {
          appointments.set(appt.idCita!, appt);
          return appt;
        },
      };

      const useCase = new ManageAttentionUseCase(mockRepo as IAppointmentRepository);

      await assert.rejects(
        async () => {
          await useCase.execute({
            accion: 'INICIAR',
            idCita: 102,
            idProfesionalEjecutor: 5,
            nombreProfesionalEjecutor: 'Dr. Test',
            now: new Date('2026-11-20T14:05:00Z'),
          });
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 409);
          assert.strictEqual(err.code, 'ACTIVE_CONSULTATION_CONFLICT');
          assert.strictEqual(err.activeAppointment?.idCita, 101);
          return true;
        }
      );
    });

    it('cierra la cita previa e inicia la nueva cuando se envía forzarCierreCitaPreviaId', async () => {
      const appointments = new Map<number, AppointmentEntity>();

      const slot1 = TimeSlotEntity.create({
        inicio: new Date('2026-11-20T13:00:00Z'),
        idProfesional: 5,
        estado: true,
        ocupacion: true,
      });
      const cita1 = AppointmentEntity.reconstitute({
        idCita: 101,
        titulo: 'Cita 1',
        descripcion: null,
        idPaciente: 1,
        idUsuario: 5,
        servicio: 'Odontología general' as DentalServiceType,
        estado: 'Confirmada',
        bloques: [slot1.inicio],
      });
      cita1.iniciarAtencion({
        idProfesionalEjecutor: 5,
        nombreProfesionalEjecutor: 'Dr. Test',
        now: new Date('2026-11-20T13:02:00Z'),
      });
      appointments.set(101, cita1);

      const slot2 = TimeSlotEntity.create({
        inicio: new Date('2026-11-20T14:00:00Z'),
        idProfesional: 5,
        estado: true,
        ocupacion: true,
      });
      const cita2 = AppointmentEntity.reconstitute({
        idCita: 102,
        titulo: 'Cita 2',
        descripcion: null,
        idPaciente: 2,
        idUsuario: 5,
        servicio: 'Odontología general' as DentalServiceType,
        estado: 'Confirmada',
        bloques: [slot2.inicio],
      });
      appointments.set(102, cita2);

      const mockRepo: Partial<IAppointmentRepository> = {
        findAppointmentById: async (id: number) => appointments.get(id) ?? null,
        findActiveConsultationByProfessional: async (idProfesional: number) => {
          return Array.from(appointments.values()).find(
            (a) => a.idUsuario === idProfesional && a.estado === 'En consulta'
          ) ?? null;
        },
        updateAppointment: async (appt: AppointmentEntity) => {
          appointments.set(appt.idCita!, appt);
          return appt;
        },
      };

      const useCase = new ManageAttentionUseCase(mockRepo as IAppointmentRepository);

      const res = await useCase.execute({
        accion: 'INICIAR',
        idCita: 102,
        idProfesionalEjecutor: 5,
        nombreProfesionalEjecutor: 'Dr. Test',
        forzarCierreCitaPreviaId: 101,
        motivoCierrePrevio: 'Cierre asistido al iniciar nueva atención clínica',
        now: new Date('2026-11-20T14:05:00Z'),
      });

      // La cita 2 ahora está En consulta
      assert.strictEqual(res.data.estado, 'En consulta');
      assert.strictEqual(appointments.get(102)?.estado, 'En consulta');

      // La cita 1 fue cerrada y quedó en Atendida
      const cita1Actualizada = appointments.get(101);
      assert.strictEqual(cita1Actualizada?.estado, 'Atendida');
      const lastHist = cita1Actualizada!.historialCambios[cita1Actualizada!.historialCambios.length - 1];
      assert.strictEqual(lastHist.motivo, 'Cierre asistido al iniciar nueva atención clínica');
    });
  });
});
