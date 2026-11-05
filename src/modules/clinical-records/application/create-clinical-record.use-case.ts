import {
  ActorContext,
  AntecedentsMap,
  AppointmentState,
  ClinicalDomainError,
  ClinicalRecordEntity,
} from '../domain/clinical-record.entity';
import {
  EvolutionRecordRow,
  IClinicalRecordRepository,
} from '../domain/clinical-record.repository.interface';
import { ClinicalWriteActor } from '../infrastructure/clinical-record.model';

export interface CreateClinicalRecordCommand {
  idPaciente: number;
  idCita: number;
  estadoCita?: AppointmentState | string;
  idProfesionalResponsable: number;
  actor: ActorContext;
  /** Usuario de la sesión que diligencia la apertura (se guarda como "Diligenciado por"). */
  writer?: ClinicalWriteActor;
  motivoConsulta: string;
  antecedentes?: AntecedentsMap;
  marcarTodoNoAplica?: boolean;
  catalogoAntecedentes?: string[];
}

export class CreateClinicalRecordUseCase {
  public static readonly DEFAULT_ANTECEDENTS_CATALOG: string[] = [
    'hipertension_arterial',
    'diabetes',
    'cardiopatias',
    'alergias_medicamentos',
    'alteraciones_coagulacion',
    'embarazo',
    'antecedentes_familiares_relevantes',
  ];

  constructor(private readonly clinicalRepo: IClinicalRecordRepository) {}

  async execute(command: CreateClinicalRecordCommand): Promise<EvolutionRecordRow> {
    if (!command.idPaciente || !command.idCita) {
      throw new ClinicalDomainError(
        'idPaciente e idCita son obligatorios para crear la historia clínica.',
        'BAD_REQUEST'
      );
    }

    // Una sola historia (apertura) por cita (uq_evolucion_cita)
    const existingForAppointment = await this.clinicalRepo.findEvolutionByCitaId(command.idCita);
    if (existingForAppointment) {
      throw new ClinicalDomainError(
        'Ya existe una apertura de historia clínica registrada para esta cita.',
        'BAD_REQUEST'
      );
    }

    const historyRows = await this.clinicalRepo.getClinicalHistoryByPatient(command.idPaciente);

    // Buscar antecedentes de la última historia clínica registrada para precargar (desde la 2da consulta)
    const lastOpeningRecord = historyRows.find(
      (row) =>
        (row.antecedentesClinicos && Object.keys(row.antecedentesClinicos).length > 0) ||
        (row.evolucion?.tipoRegistro === 'APERTURA_CONSULTA' && row.evolucion?.antecedentes)
    );

    const estadoCitaActual = command.estadoCita ?? 'En consulta';

    const antecedentesPrevios =
      (lastOpeningRecord?.antecedentesClinicos as AntecedentsMap) ||
      lastOpeningRecord?.evolucion?.antecedentes;

    const clinicalRecord = ClinicalRecordEntity.createForConsultation({
      idPaciente: command.idPaciente,
      idCita: command.idCita,
      estadoCita: estadoCitaActual,
      idProfesionalResponsableCita: command.idProfesionalResponsable,
      actor: command.actor,
      motivoConsulta: command.motivoConsulta,
      antecedentesInput: command.antecedentes,
      marcarTodoNoAplica: command.marcarTodoNoAplica,
      catalogoAntecedentes:
        command.catalogoAntecedentes ??
        CreateClinicalRecordUseCase.DEFAULT_ANTECEDENTS_CATALOG,
      antecedentesPrevios,
    });

    const payload = clinicalRecord.toEvolutionPayload();

    return await this.clinicalRepo.createEvolutionEntry({
      idPaciente: command.idPaciente,
      idCita: command.idCita,
      motivoConsulta: payload.motivoConsulta,
      antecedentesClinicos: payload.antecedentes,
      payload,
      actor: command.writer,
    });
  }
}
