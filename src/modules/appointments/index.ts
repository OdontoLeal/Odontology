// src/modules/appointments/index.ts
import { AppointmentEntity, DentalServiceType } from './domain/appointment.entity';
import {
  AppointmentDTO,
  IAppointmentRepository,
} from './domain/appointment.repository.interface';

// Exportación de entidades de Dominio
export * from './domain/time-slot.entity';
export * from './domain/appointment.entity';
export * from './domain/appointment-request.entity';
export * from './domain/appointment.repository.interface';

// Exportación de Casos de Uso de Aplicación (Módulo B)
export * from './application/manage-time-slots.use-case';
export * from './application/schedule-appointment.use-case';
export * from './application/request-appointment.use-case';
export * from './application/notify-request.use-case';
export * from './application/review-request.use-case';
export * from './application/update-appointment.use-case';
export * from './application/cancel-appointment.use-case';
export * from './application/get-weekly-agenda.use-case';
export * from './application/manage-attention.use-case';
export * from './application/select-service.use-case';
export * from './application/mark-no-show.use-case';

export interface ActiveConsultationSummary {
  idCita: number;
  idUsuarioProfesional: number;
  servicio: DentalServiceType;
  horaInicio: Date;
}

/**
 * Public API del Módulo B (Appointments) para comunicación limpia y desacoplada
 * con otros módulos (Vertical Slices: Clinical Records, Consents, Patients, Users-Auth).
 */
export class AppointmentsModulePublicApi {
  constructor(private readonly appointmentRepository: IAppointmentRepository) {}

  /**
   * Regla de Negocio 5 / active-consultation.guard:
   * Verifica si el paciente tiene actualmente una cita en estado "En consulta".
   * Permite autorizar el acceso asistencial a ROL-AUX exclusivamente durante dicha consulta.
   */
  public async isPatientInActiveConsultation(idPaciente: number): Promise<boolean> {
    const active = await this.appointmentRepository.findActiveConsultationByPatient(idPaciente);
    return Boolean(active && active.isEnConsulta());
  }

  /**
   * Obtiene la cita activa "En consulta" de un paciente si existe.
   */
  public async getActiveConsultationForPatient(
    idPaciente: number
  ): Promise<ActiveConsultationSummary | null> {
    const active = await this.appointmentRepository.findActiveConsultationByPatient(idPaciente);
    if (!active || !active.isEnConsulta()) {
      return null;
    }

    return {
      idCita: active.idCita!,
      idUsuarioProfesional: active.idUsuario,
      servicio: active.servicio,
      horaInicio: active.horaInicio,
    };
  }

  /**
   * RF-HCL-004: Retorna el historial completo de citas de un paciente
   * ordenado de la más reciente a la más antigua con estado y "Agendado por".
   */
  public async getPatientAppointmentHistory(idPaciente: number): Promise<AppointmentDTO[]> {
    return this.appointmentRepository.findAppointmentsByPatient(idPaciente);
  }

  /**
   * RF-USR-002 / RF-USR-003: Valida si un profesional tiene citas activas
   * (Solicitada, Confirmada o En consulta) para impedir su inactivación o desasignación de rol.
   */
  public async hasActiveAppointmentsForProfessional(idProfesional: number): Promise<boolean> {
    const count = await this.appointmentRepository.countActiveAppointmentsByProfessional(idProfesional);
    return count > 0;
  }
}
