import {
  ActorContext,
  AppointmentState,
  ClinicalDomainError,
} from '../domain/clinical-record.entity';
import {
  EvolutionNoteEntity,
  EvolutionTemplateCode,
} from '../domain/evolution-note.entity';
import {
  EvolutionRecordRow,
  IClinicalRecordRepository,
} from '../domain/clinical-record.repository.interface';

export interface RegisterEvolutionCommand {
  idPaciente: number;
  idCita: number;
  estadoCita: AppointmentState | string;
  idProfesionalResponsable: number;
  actor: ActorContext;
  procedimientoRealizado: string;
  notaEvolucionTextoLibre?: string;
  plantillaCodigo?: EvolutionTemplateCode;
  camposPlantilla?: Record<string, string>;
  esNotaAclaratoria?: boolean;
}

export interface UpdateEvolutionNoteCommand {
  idPaciente: number;
  idEvolucion: number;
  estadoCita: AppointmentState | string;
  actor: ActorContext;
  procedimientoRealizado: string;
  notaEvolucionTextoLibre?: string;
  plantillaCodigo?: EvolutionTemplateCode;
  camposPlantilla?: Record<string, string>;
}

export class RegisterEvolutionUseCase {
  constructor(private readonly clinicalRepo: IClinicalRecordRepository) {}

  // Registrar nueva nota de evolución o Nota Aclaratoria
  async execute(command: RegisterEvolutionCommand): Promise<EvolutionRecordRow> {
    if (!command.idPaciente || !command.idCita) {
      throw new ClinicalDomainError(
        'idPaciente e idCita son obligatorios para registrar la evolución.',
        'BAD_REQUEST'
      );
    }

    const payload = EvolutionNoteEntity.createEvolutionPayload({
      actor: command.actor,
      idProfesionalResponsableCita: command.idProfesionalResponsable,
      estadoCita: command.estadoCita,
      esNotaAclaratoria: command.esNotaAclaratoria,
      procedimientoRealizado: command.procedimientoRealizado,
      notaEvolucionTextoLibre: command.notaEvolucionTextoLibre,
      plantillaCodigo: command.plantillaCodigo,
      camposPlantilla: command.camposPlantilla,
    });

    return await this.clinicalRepo.createEvolutionEntry({
      idPaciente: command.idPaciente,
      idCita: command.idCita,
      motivoConsulta: payload.motivoConsulta || 'Evolución clínica',
      procedimientoRealizado: command.procedimientoRealizado,
      hallazgosObservaciones: command.notaEvolucionTextoLibre,
      payload,
    });
  }

  // Editar nota de evolución existente (ROL-AUX solo las propias en consulta; ODO/ESP hasta las 23:59)
  async updateNote(command: UpdateEvolutionNoteCommand): Promise<EvolutionRecordRow> {
    const historyRows = await this.clinicalRepo.getClinicalHistoryByPatient(
      command.idPaciente
    );

    const targetRow = historyRows.find(
      (row) => row.idEvolucion === command.idEvolucion
    );

    if (!targetRow || !targetRow.evolucion || !targetRow.fechaRegistro) {
      throw new ClinicalDomainError(
        'La nota de evolución solicitada no existe.',
        'NOT_FOUND'
      );
    }

    const idProfesionalResponsableCita =
      targetRow.evolucion.diligenciadoPor?.idProfesionalResponsable ?? 1;

    const updatedPayload = EvolutionNoteEntity.updateExistingEvolutionPayload({
      actor: command.actor,
      idProfesionalResponsableCita,
      estadoCita: command.estadoCita,
      fechaCreacionNota: new Date(targetRow.fechaRegistro),
      existingPayload: targetRow.evolucion,
      procedimientoRealizado: command.procedimientoRealizado,
      notaEvolucionTextoLibre: command.notaEvolucionTextoLibre,
      plantillaCodigo: command.plantillaCodigo,
      camposPlantilla: command.camposPlantilla,
    });

    return await this.clinicalRepo.updateEvolutionEntrySameDay(
      command.idEvolucion,
      {
        ...updatedPayload,
        procedimientoRealizado: command.procedimientoRealizado,
        hallazgosObservaciones: command.notaEvolucionTextoLibre,
      }
    );
  }
}
