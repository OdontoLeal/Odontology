import {
  ActorContext,
  AntecedentsMap,
  ClinicalDomainError,
  ClinicalRecordEntity,
} from '../domain/clinical-record.entity';
import {
  EvolutionRecordRow,
  IClinicalRecordRepository,
} from '../domain/clinical-record.repository.interface';

export interface UpdateClinicalRecordCommand {
  idPaciente: number;
  idEvolucion: number;
  actor: ActorContext;
  motivoConsulta?: string;
  antecedentes?: AntecedentsMap;
}

export class UpdateClinicalRecordUseCase {
  constructor(private readonly clinicalRepo: IClinicalRecordRepository) {}

  async execute(command: UpdateClinicalRecordCommand): Promise<EvolutionRecordRow> {
    if (!command.idPaciente || !command.idEvolucion) {
      throw new ClinicalDomainError(
        'idPaciente e idEvolucion son obligatorios para editar la historia clínica.',
        'BAD_REQUEST'
      );
    }

    const historyRows = await this.clinicalRepo.getClinicalHistoryByPatient(
      command.idPaciente
    );

    const targetRow = historyRows.find(
      (row) => row.idEvolucion === command.idEvolucion
    );

    if (!targetRow || !targetRow.evolucion || !targetRow.fechaRegistro || !targetRow.idCita) {
      throw new ClinicalDomainError(
        'Registro de historia clínica no encontrado para el paciente.',
        'NOT_FOUND'
      );
    }

    const existingPayload = targetRow.evolucion;
    const idProfesionalResponsableCita =
      existingPayload.diligenciadoPor?.idProfesionalResponsable ?? 1;

    // Validar que el usuario sea el profesional responsable y esté dentro del mismo día en Colombia (UTC-5)
    const entity = new ClinicalRecordEntity(
      command.idPaciente,
      targetRow.idCita,
      existingPayload.motivoConsulta ?? '',
      existingPayload.antecedentes ?? {},
      existingPayload.diligenciadoPor,
      new Date(targetRow.fechaRegistro),
      existingPayload.odontograma,
      existingPayload.procedimientoRealizado,
      existingPayload.notaEvolucion,
      targetRow.idEvolucion ?? undefined
    );

    const updatedPayload = entity.updateClinicalData({
      actor: command.actor,
      idProfesionalResponsableCita,
      motivoConsulta: command.motivoConsulta,
      antecedentes: command.antecedentes,
    });

    return await this.clinicalRepo.updateEvolutionEntrySameDay(
      command.idEvolucion,
      {
        ...updatedPayload,
        motivoConsulta: updatedPayload.motivoConsulta,
        antecedentesClinicos: updatedPayload.antecedentes,
      }
    );
  }
}
