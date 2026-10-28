import { IClinicalRecordRepository } from './domain/clinical-record.repository.interface';
import { IClinicalRecordCheckerPort } from '../appointments/domain/appointment.repository.interface';

export * from './domain/clinical-record.entity';
export * from './domain/odontogram.entity';
export * from './domain/evolution-note.entity';
export * from './domain/clinical-record.repository.interface';

export * from './application/create-clinical-record.use-case';
export * from './application/update-clinical-record.use-case';
export * from './application/manage-odontogram.use-case';
export * from './application/get-clinical-history.use-case';
export * from './application/register-evolution.use-case';

export class ClinicalRecordsModulePublicApi implements IClinicalRecordCheckerPort {
  constructor(private readonly clinicalRepo: IClinicalRecordRepository) {}

  /**
   * RF-AGE-009 & RF-HCL-005: Verifica que la cita "En consulta" tenga el motivo de consulta guardado
   * antes de permitir al profesional finalizar la atención y pasar la cita a estado "Atendida".
   * Implementa IClinicalRecordCheckerPort del módulo de agendamiento.
   */
  async hasConsultationReasonRegistered(idCita: number): Promise<boolean> {
    const evo = await this.clinicalRepo.findEvolutionByCitaId(idCita);
    if (!evo) {
      return false;
    }
    const motivo = evo.motivoConsulta || evo.evolucion?.motivoConsulta;
    return typeof motivo === 'string' && motivo.trim().length > 0;
  }

  async hasRegisteredConsultationReason(
    idPaciente: number,
    idCita: number
  ): Promise<boolean> {
    const history = await this.clinicalRepo.getClinicalHistoryByPatient(idPaciente);

    return history.some((row) => {
      if (row.idCita !== idCita) return false;
      const motivo = row.motivoConsulta || row.evolucion?.motivoConsulta;
      return typeof motivo === 'string' && motivo.trim().length > 0;
    });
  }

  async assertConsultationReasonRegistered(
    idPaciente: number,
    idCita: number
  ): Promise<void> {
    const hasReason = await this.hasRegisteredConsultationReason(idPaciente, idCita);
    if (!hasReason) {
      throw new Error('Falta registrar el motivo de consulta');
    }
  }
}
