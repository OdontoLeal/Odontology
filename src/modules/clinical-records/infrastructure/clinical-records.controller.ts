import { Request, Response } from 'express';
import { CreateClinicalRecordUseCase } from '../application/create-clinical-record.use-case';
import { GetClinicalHistoryUseCase } from '../application/get-clinical-history.use-case';
import { ManageOdontogramUseCase } from '../application/manage-odontogram.use-case';
import { RegisterEvolutionUseCase } from '../application/register-evolution.use-case';
import { UpdateClinicalRecordUseCase } from '../application/update-clinical-record.use-case';
import {
  ActorContext,
  ClinicalDomainError,
} from '../domain/clinical-record.entity';
import { IClinicalRecordRepository } from '../domain/clinical-record.repository.interface';
import { OdontogramDataDTO } from './clinical-record.model';

export class ClinicalRecordsController {
  private readonly repo?: IClinicalRecordRepository;
  private readonly createClinicalRecordUseCase: CreateClinicalRecordUseCase;
  private readonly updateClinicalRecordUseCase: UpdateClinicalRecordUseCase;
  private readonly manageOdontogramUseCase: ManageOdontogramUseCase;
  private readonly getClinicalHistoryUseCase: GetClinicalHistoryUseCase;
  private readonly registerEvolutionUseCase: RegisterEvolutionUseCase;

  constructor(
    repoOrUseCase: IClinicalRecordRepository | CreateClinicalRecordUseCase,
    updateClinicalRecordUseCase?: UpdateClinicalRecordUseCase,
    manageOdontogramUseCase?: ManageOdontogramUseCase,
    getClinicalHistoryUseCase?: GetClinicalHistoryUseCase,
    registerEvolutionUseCase?: RegisterEvolutionUseCase
  ) {
    if ('createEvolutionEntry' in repoOrUseCase) {
      const repo = repoOrUseCase as IClinicalRecordRepository;
      this.repo = repo;
      this.createClinicalRecordUseCase = new CreateClinicalRecordUseCase(repo);
      this.updateClinicalRecordUseCase = new UpdateClinicalRecordUseCase(repo);
      this.manageOdontogramUseCase = new ManageOdontogramUseCase(repo);
      this.getClinicalHistoryUseCase = new GetClinicalHistoryUseCase(repo);
      this.registerEvolutionUseCase = new RegisterEvolutionUseCase(repo);
    } else {
      this.createClinicalRecordUseCase = repoOrUseCase;
      this.updateClinicalRecordUseCase = updateClinicalRecordUseCase!;
      this.manageOdontogramUseCase = manageOdontogramUseCase!;
      this.getClinicalHistoryUseCase = getClinicalHistoryUseCase!;
      this.registerEvolutionUseCase = registerEvolutionUseCase!;
    }
  }

  private extractActor(req: Request): ActorContext {
    const authUser = (req as any).user;
    return {
      idUsuario: Number(
        authUser?.idUsuario ?? req.body?.payload?.diligenciadoPor?.idUsuario ?? 1
      ),
      nombreUsuario: String(
        authUser?.nombreCompleto ??
          req.body?.payload?.diligenciadoPor?.nombreUsuario ??
          'Personal Clínico'
      ),
      roles: Array.isArray(authUser?.roles) ? authUser.roles : ['ROL-ODO'],
    };
  }

  private isOdontogramObject(value: unknown): value is OdontogramDataDTO {
    return (
      Boolean(value) &&
      typeof value === 'object' &&
      'cuadrantes' in (value as Record<string, unknown>)
    );
  }

  private handleError(error: unknown, res: Response): void {
    if (error instanceof ClinicalDomainError) {
      const statusMap = {
        BAD_REQUEST: 400,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
      } as const;
      res.status(statusMap[error.statusCode]).json({ message: error.message });
      return;
    }

    const message =
      error instanceof Error ? error.message : 'Error interno del servidor.';
    const status =
      message.includes('solo se puede editar el día') || message.includes('permiso')
        ? 403
        : 400;
    res.status(status).json({ message });
  }

  // RF-HCL-005, RF-HCL-007, RF-HCL-009: Crear entrada de historia clínica, odontograma JSON o evolución
  createEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const { idPaciente, idCita, estadoCita, esMenorDe18Anios } = req.body;
      const body = req.body;
      const payload = body.payload || {};
      const actor = this.extractActor(req);

      if (!idPaciente || !idCita) {
        res.status(400).json({
          message: 'idPaciente e idCita son obligatorios.',
        });
        return;
      }

      const idProfesionalResponsable = Number(
        body.idProfesionalResponsable ??
          payload.diligenciadoPor?.idProfesionalResponsable ??
          actor.idUsuario
      );

      let entry;

      if (payload.tipoRegistro === 'APERTURA_CONSULTA') {
        entry = await this.createClinicalRecordUseCase.execute({
          idPaciente: Number(idPaciente),
          idCita: Number(idCita),
          estadoCita: estadoCita ?? 'En consulta',
          idProfesionalResponsable,
          actor,
          motivoConsulta: payload.motivoConsulta ?? body.motivoConsulta ?? '',
          antecedentes: payload.antecedentes ?? body.antecedentesClinicos,
          marcarTodoNoAplica: Boolean(req.body.marcarTodoNoAplica),
        });
      } else if (
        payload.tipoRegistro === 'EVOLUCION_ODONTOGRAMA' &&
        this.isOdontogramObject(payload.odontograma) &&
        !payload.procedimientoRealizado &&
        !body.procedimientoRealizado
      ) {
        entry = await this.manageOdontogramUseCase.execute({
          idPaciente: Number(idPaciente),
          idCita: Number(idCita),
          estadoCita: estadoCita ?? 'En consulta',
          idProfesionalResponsable,
          esMenorDe18Anios: Boolean(esMenorDe18Anios),
          actor,
          odontograma: payload.odontograma,
        });
      } else if (this.repo) {
        // Guardado estructurado directo mapeado a las 5 pestañas de la tabla evolucion
        const motivoConsulta =
          body.motivoConsulta ?? payload.motivoConsulta ?? 'Consulta Odontológica';
        const enfermedadActual =
          body.enfermedadActual ?? payload.enfermedadActual ?? 'N/A';
        const antecedentesClinicos =
          body.antecedentesClinicos ??
          payload.antecedentesClinicos ??
          payload.antecedentes ??
          {};
        const habitosHigiene =
          body.habitosHigiene ?? payload.habitosHigiene ?? {};
        const examenEstomatognatico =
          body.examenEstomatognatico ?? payload.examenEstomatognatico ?? {};
        const examenFisicoObservaciones =
          body.examenFisicoObservaciones ?? payload.examenFisicoObservaciones ?? null;
        const odontograma =
          body.odontograma ?? payload.odontograma ?? {};
        const procedimientoRealizado =
          body.procedimientoRealizado ??
          payload.procedimientoRealizado ??
          payload.notaEvolucion ??
          null;
        const diagnosticoGenerado =
          body.diagnosticoGenerado ??
          payload.diagnosticoGenerado ??
          payload.diagnostico ??
          null;
        const accionesARealizar =
          body.accionesARealizar ?? payload.accionesARealizar ?? null;
        const hallazgosObservaciones =
          body.hallazgosObservaciones ??
          payload.hallazgosObservaciones ??
          payload.observaciones ??
          null;
        const planManejo =
          body.planManejo ?? payload.planManejo ?? {};

        entry = await this.repo.createEvolutionEntry({
          idPaciente: Number(idPaciente),
          idCita: Number(idCita),
          motivoConsulta,
          enfermedadActual,
          antecedentesClinicos,
          habitosHigiene,
          examenEstomatognatico,
          examenFisicoObservaciones,
          odontograma,
          procedimientoRealizado,
          diagnosticoGenerado,
          accionesARealizar,
          hallazgosObservaciones,
          planManejo,
          payload: {
            tipoRegistro: 'EVOLUCION_ODONTOGRAMA',
            motivoConsulta,
            enfermedadActual,
            antecedentesClinicos,
            habitosHigiene,
            examenEstomatognatico,
            examenFisicoObservaciones: examenFisicoObservaciones ?? undefined,
            odontograma,
            procedimientoRealizado: procedimientoRealizado ?? undefined,
            diagnostico: diagnosticoGenerado ?? undefined,
            accionesARealizar: accionesARealizar ?? undefined,
            observaciones: hallazgosObservaciones ?? undefined,
            planManejo,
            diligenciadoPor: {
              idUsuario: actor.idUsuario,
              nombreUsuario: actor.nombreUsuario,
              idProfesionalResponsable,
              fechaHoraISO: new Date().toISOString(),
            },
          },
        });
      } else {
        const notaEvolucionTextoLibre =
          payload.notaEvolucion ||
          body.observaciones ||
          payload.observaciones ||
          body.procedimientoRealizado ||
          payload.procedimientoRealizado ||
          (body.motivoConsulta
            ? `Atención clínica: ${body.motivoConsulta}`
            : 'Evolución clínica registrada.');

        entry = await this.registerEvolutionUseCase.execute({
          idPaciente: Number(idPaciente),
          idCita: Number(idCita),
          estadoCita: estadoCita ?? 'En consulta',
          idProfesionalResponsable,
          actor,
          procedimientoRealizado:
            body.procedimientoRealizado ||
            payload.procedimientoRealizado ||
            body.motivoConsulta ||
            'Atención Odontológica',
          notaEvolucionTextoLibre,
          plantillaCodigo: req.body.plantillaCodigo,
          camposPlantilla: req.body.camposPlantilla,
          esNotaAclaratoria: payload.tipoRegistro === 'NOTA_ACLARATORIA',
        });
      }

      res.status(201).json({
        message: 'Registro clínico guardado exitosamente.',
        data: entry,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // RF-HCL-006: Actualizar historia clínica, odontograma o campos de evolución hasta las 23:59 UTC-5
  updateEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const idEvolucion = Number(req.params.idEvolucion);
      const { idPaciente, estadoCita } = req.body;
      const body = req.body;
      const payload = body.payload || {};
      const actor = this.extractActor(req);

      let updated;

      if (payload?.tipoRegistro === 'APERTURA_CONSULTA') {
        updated = await this.updateClinicalRecordUseCase.execute({
          idPaciente: Number(idPaciente),
          idEvolucion,
          actor,
          motivoConsulta: payload.motivoConsulta ?? body.motivoConsulta,
          antecedentes: payload.antecedentes ?? body.antecedentesClinicos,
        });
      } else if (
        payload?.tipoRegistro === 'EVOLUCION_ODONTOGRAMA' &&
        this.isOdontogramObject(payload?.odontograma) &&
        !payload?.procedimientoRealizado &&
        !body.procedimientoRealizado
      ) {
        updated = await this.manageOdontogramUseCase.execute({
          idPaciente: Number(idPaciente),
          idCita: Number(req.body.idCita),
          idEvolucionExistente: idEvolucion,
          estadoCita: estadoCita ?? 'En consulta',
          idProfesionalResponsable: Number(
            payload.diligenciadoPor?.idProfesionalResponsable ?? actor.idUsuario
          ),
          actor,
          odontograma: payload.odontograma,
        });
      } else if (this.repo) {
        updated = await this.repo.updateEvolutionEntrySameDay(idEvolucion, {
          motivoConsulta: body.motivoConsulta ?? payload.motivoConsulta,
          enfermedadActual: body.enfermedadActual ?? payload.enfermedadActual,
          antecedentesClinicos:
            body.antecedentesClinicos ?? payload.antecedentesClinicos ?? payload.antecedentes,
          habitosHigiene: body.habitosHigiene ?? payload.habitosHigiene,
          examenEstomatognatico:
            body.examenEstomatognatico ?? payload.examenEstomatognatico,
          examenFisicoObservaciones:
            body.examenFisicoObservaciones ?? payload.examenFisicoObservaciones,
          odontograma: body.odontograma ?? payload.odontograma,
          procedimientoRealizado:
            body.procedimientoRealizado ?? payload.procedimientoRealizado ?? payload.notaEvolucion,
          diagnosticoGenerado:
            body.diagnosticoGenerado ?? payload.diagnosticoGenerado ?? payload.diagnostico,
          accionesARealizar: body.accionesARealizar ?? payload.accionesARealizar,
          hallazgosObservaciones:
            body.hallazgosObservaciones ?? payload.hallazgosObservaciones ?? payload.observaciones,
          planManejo: body.planManejo ?? payload.planManejo,
          evolucion: payload,
        });
      } else {
        updated = await this.registerEvolutionUseCase.updateNote({
          idPaciente: Number(idPaciente),
          idEvolucion,
          estadoCita: estadoCita ?? 'En consulta',
          actor,
          procedimientoRealizado:
            body?.procedimientoRealizado ?? payload?.procedimientoRealizado ?? '',
          notaEvolucionTextoLibre:
            body?.observaciones ?? payload?.notaEvolucion ?? payload?.observaciones,
          plantillaCodigo: req.body.plantillaCodigo,
          camposPlantilla: req.body.camposPlantilla,
        });
      }

      res.json({
        message: 'Historia clínica actualizada dentro del plazo legal.',
        data: updated,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // RF-HCL-007: Obtener el último JSON de odontograma del paciente (o plantilla limpia en 1ra consulta)
  getLatestOdontogram = async (req: Request, res: Response): Promise<void> => {
    try {
      const idPaciente = Number(req.params.idPaciente);
      const esMenorDe18Anios = req.query.esMenor === 'true';

      const odontograma =
        await this.manageOdontogramUseCase.getLatestOdontogramSnapshot(
          idPaciente,
          esMenorDe18Anios
        );

      res.json({ data: odontograma });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // RF-HCL-008: Consultar historial clínico completo de un paciente
  getHistoryByPatient = async (req: Request, res: Response): Promise<void> => {
    try {
      const idPaciente = Number(req.params.idPaciente);
      const actor = this.extractActor(req);

      const history = await this.getClinicalHistoryUseCase.execute({
        idPaciente,
        actor,
      });

      res.json({ data: history });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
