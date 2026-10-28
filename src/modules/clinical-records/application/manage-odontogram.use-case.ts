import {
  ActorContext,
  AppointmentState,
  ClinicalDomainError,
  ClinicalRecordEntity,
} from '../domain/clinical-record.entity';
import {
  EvolutionRecordRow,
  IClinicalRecordRepository,
} from '../domain/clinical-record.repository.interface';
import { OdontogramEntity } from '../domain/odontogram.entity';
import {
  ClinicalEvolutionPayload,
  OdontogramDataDTO,
} from '../infrastructure/clinical-record.model';

export interface ManageOdontogramCommand {
  idPaciente: number;
  idCita: number;
  idEvolucionExistente?: number;
  estadoCita: AppointmentState | string;
  idProfesionalResponsable: number;
  esMenorDe18Anios?: boolean;
  actor: ActorContext;
  odontograma: OdontogramDataDTO;
}

export class ManageOdontogramUseCase {
  constructor(private readonly clinicalRepo: IClinicalRecordRepository) {}

  /**
   * RF-HCL-007: Devuelve el último JSON de odontograma guardado del paciente
   * o genera la estructura JSON limpia completa si es su primera consulta.
   */
  async getLatestOdontogramSnapshot(
    idPaciente: number,
    esMenorDe18Anios = false
  ): Promise<OdontogramDataDTO> {
    const history = await this.clinicalRepo.getClinicalHistoryByPatient(idPaciente);

    const lastRecordWithOdontogram = history.find(
      (row) =>
        (row.odontograma &&
          typeof row.odontograma === 'object' &&
          'cuadrantes' in (row.odontograma as any)) ||
        (row.evolucion?.odontograma &&
          typeof row.evolucion.odontograma === 'object' &&
          'cuadrantes' in row.evolucion.odontograma)
    );

    const previousOdontogram =
      (lastRecordWithOdontogram?.odontograma as OdontogramDataDTO) ||
      lastRecordWithOdontogram?.evolucion?.odontograma ||
      null;

    const odontogram = OdontogramEntity.fromPreviousOdontogram({
      previousOdontogram,
      isMinorUnder18: esMenorDe18Anios,
    });

    return odontogram.getSnapshot();
  }

  /**
   * RF-HCL-007: Parte del último odontograma, valida y aplica el nuevo JSON de odontograma
   * enviado por el Frontend, y lo guarda en la columna odontograma (JSONB) y payload de autoría.
   */
  async execute(command: ManageOdontogramCommand): Promise<EvolutionRecordRow> {
    if (!command.idPaciente || !command.idCita) {
      throw new ClinicalDomainError(
        'idPaciente e idCita son obligatorios para guardar el odontograma.',
        'BAD_REQUEST'
      );
    }

    const history = await this.clinicalRepo.getClinicalHistoryByPatient(
      command.idPaciente
    );

    const existingEvolutionRow = command.idEvolucionExistente
      ? history.find((r) => r.idEvolucion === command.idEvolucionExistente)
      : history.find((r) => r.idCita === command.idCita);

    const fechaCreacionTarget = existingEvolutionRow?.fechaRegistro
      ? new Date(existingEvolutionRow.fechaRegistro)
      : undefined;

    // Regla de Negocio 5 y 6: ODO/ESP responsable (hasta las 23:59) o AUX (mientras esté "En consulta")
    ClinicalRecordEntity.assertCanOperateInConsultation({
      actor: command.actor,
      idProfesionalResponsableCita: command.idProfesionalResponsable,
      estadoCita: command.estadoCita,
      fechaCreacionRegistro: fechaCreacionTarget,
    });

    const lastRecordWithOdontogram = history.find(
      (row) =>
        (row.odontograma &&
          typeof row.odontograma === 'object' &&
          'cuadrantes' in (row.odontograma as any)) ||
        (row.evolucion?.odontograma &&
          typeof row.evolucion.odontograma === 'object' &&
          'cuadrantes' in row.evolucion.odontograma)
    );

    const previousOdontogram =
      (lastRecordWithOdontogram?.odontograma as OdontogramDataDTO) ||
      lastRecordWithOdontogram?.evolucion?.odontograma ||
      null;

    const odontogramEntity = OdontogramEntity.fromPreviousOdontogram({
      previousOdontogram,
      isMinorUnder18: command.esMenorDe18Anios,
    });

    odontogramEntity.applyUpdatedOdontogram(command.odontograma);

    const updatedSnapshot = odontogramEntity.getSnapshot();

    const payload: ClinicalEvolutionPayload = {
      ...(existingEvolutionRow?.evolucion ?? {}),
      tipoRegistro:
        existingEvolutionRow?.evolucion?.tipoRegistro ?? 'EVOLUCION_ODONTOGRAMA',
      odontograma: updatedSnapshot,
      diligenciadoPor: {
        idUsuario: command.actor.idUsuario,
        nombreUsuario: command.actor.nombreUsuario,
        idProfesionalResponsable: command.idProfesionalResponsable,
        fechaHoraISO: ClinicalRecordEntity.getColombiaISOString(new Date()),
      },
    };

    if (existingEvolutionRow && existingEvolutionRow.idEvolucion) {
      return await this.clinicalRepo.updateEvolutionEntrySameDay(
        existingEvolutionRow.idEvolucion,
        {
          ...payload,
          odontograma: updatedSnapshot,
        }
      );
    }

    return await this.clinicalRepo.createEvolutionEntry({
      idPaciente: command.idPaciente,
      idCita: command.idCita,
      motivoConsulta: existingEvolutionRow?.motivoConsulta || 'Evolución con Odontograma',
      odontograma: updatedSnapshot,
      payload,
    });
  }
}
