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
import {
  createDefaultAntecedentesClinicos,
  createDefaultHabitosHigiene,
  createDefaultExamenEstomatognatico,
  createInitialOdontograma,
  createDefaultPlanManejo,
  AntecedentesClinicosSchema,
  HabitosHigieneSchema,
  ExamenEstomatognaticoSchema,
  OdontogramaSchema,
  PlanManejoSchema,
} from '../../../schemas';

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

        // 1. Antecedentes Clínicos
        let antecedentesClinicos =
          body.antecedentesClinicos ??
          payload.antecedentesClinicos ??
          payload.antecedentes;
        if (
          !antecedentesClinicos ||
          (typeof antecedentesClinicos === 'object' &&
            Object.keys(antecedentesClinicos).length === 0)
        ) {
          antecedentesClinicos = createDefaultAntecedentesClinicos();
        } else if (
          typeof antecedentesClinicos === 'object' &&
          'accidentes_traumas' in antecedentesClinicos
        ) {
          const parsed = AntecedentesClinicosSchema.safeParse(antecedentesClinicos);
          if (!parsed.success) {
            res.status(400).json({
              message:
                parsed.error.issues[0]?.message ||
                'Estructura inválida de antecedentes clínicos.',
              errors: parsed.error.issues,
            });
            return;
          }
          antecedentesClinicos = parsed.data;
        }

        // 2. Hábitos de Higiene
        let habitosHigiene = body.habitosHigiene ?? payload.habitosHigiene;
        if (
          !habitosHigiene ||
          (typeof habitosHigiene === 'object' &&
            Object.keys(habitosHigiene).length === 0)
        ) {
          habitosHigiene = createDefaultHabitosHigiene();
        } else if (
          typeof habitosHigiene === 'object' &&
          'cepillado_dental' in habitosHigiene
        ) {
          const parsed = HabitosHigieneSchema.safeParse(habitosHigiene);
          if (!parsed.success) {
            res.status(400).json({
              message:
                parsed.error.issues[0]?.message ||
                'Estructura inválida de hábitos de higiene.',
              errors: parsed.error.issues,
            });
            return;
          }
          habitosHigiene = parsed.data;
        }

        // 3. Examen Estomatognático
        let examenEstomatognatico =
          body.examenEstomatognatico ?? payload.examenEstomatognatico;
        if (
          !examenEstomatognatico ||
          (typeof examenEstomatognatico === 'object' &&
            Object.keys(examenEstomatognatico).length === 0)
        ) {
          examenEstomatognatico = createDefaultExamenEstomatognatico();
        } else if (
          typeof examenEstomatognatico === 'object' &&
          'labios' in examenEstomatognatico
        ) {
          const parsed = ExamenEstomatognaticoSchema.safeParse(examenEstomatognatico);
          if (!parsed.success) {
            res.status(400).json({
              message:
                parsed.error.issues[0]?.message ||
                'Estructura inválida de examen estomatognático.',
              errors: parsed.error.issues,
            });
            return;
          }
          examenEstomatognatico = parsed.data;
        }

        const examenFisicoObservaciones =
          body.examenFisicoObservaciones ?? payload.examenFisicoObservaciones ?? null;

        // 4. Odontograma
        let odontograma = body.odontograma ?? payload.odontograma;
        if (
          !odontograma ||
          (typeof odontograma === 'object' &&
            Object.keys(odontograma).length === 0)
        ) {
          odontograma = createInitialOdontograma(Boolean(esMenorDe18Anios));
        } else if (this.isOdontogramObject(odontograma)) {
          const parsed = OdontogramaSchema.safeParse(odontograma);
          if (!parsed.success) {
            res.status(400).json({
              message:
                parsed.error.issues[0]?.message ||
                'Estructura inválida de odontograma.',
              errors: parsed.error.issues,
            });
            return;
          }
          odontograma = parsed.data;
        }

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

        // 5. Plan de Manejo
        let planManejo = body.planManejo ?? payload.planManejo;
        if (
          !planManejo ||
          (typeof planManejo === 'object' &&
            Object.keys(planManejo).length === 0)
        ) {
          planManejo = createDefaultPlanManejo();
        } else if (
          typeof planManejo === 'object' &&
          ('prescripcion_farmacologica' in planManejo ||
            'incapacidad_medica' in planManejo ||
            'remision_medica' in planManejo)
        ) {
          const parsed = PlanManejoSchema.safeParse(planManejo);
          if (!parsed.success) {
            res.status(400).json({
              message:
                parsed.error.issues[0]?.message ||
                'Estructura inválida de plan de manejo.',
              errors: parsed.error.issues,
            });
            return;
          }
          planManejo = parsed.data;
        }

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
        // Validación Zod con safeParse en actualización (Capa 2)
        const rawAntecedentes =
          body.antecedentesClinicos ??
          payload.antecedentesClinicos ??
          payload.antecedentes;
        if (
          rawAntecedentes &&
          typeof rawAntecedentes === 'object' &&
          'accidentes_traumas' in rawAntecedentes
        ) {
          const parsed = AntecedentesClinicosSchema.safeParse(rawAntecedentes);
          if (!parsed.success) {
            res.status(400).json({
              message:
                parsed.error.issues[0]?.message ||
                'Estructura inválida de antecedentes clínicos.',
              errors: parsed.error.issues,
            });
            return;
          }
        }

        const rawHabitos = body.habitosHigiene ?? payload.habitosHigiene;
        if (
          rawHabitos &&
          typeof rawHabitos === 'object' &&
          'cepillado_dental' in rawHabitos
        ) {
          const parsed = HabitosHigieneSchema.safeParse(rawHabitos);
          if (!parsed.success) {
            res.status(400).json({
              message:
                parsed.error.issues[0]?.message ||
                'Estructura inválida de hábitos de higiene.',
              errors: parsed.error.issues,
            });
            return;
          }
        }

        const rawExamen =
          body.examenEstomatognatico ?? payload.examenEstomatognatico;
        if (
          rawExamen &&
          typeof rawExamen === 'object' &&
          'labios' in rawExamen
        ) {
          const parsed = ExamenEstomatognaticoSchema.safeParse(rawExamen);
          if (!parsed.success) {
            res.status(400).json({
              message:
                parsed.error.issues[0]?.message ||
                'Estructura inválida de examen estomatognático.',
              errors: parsed.error.issues,
            });
            return;
          }
        }

        const rawOdontograma = body.odontograma ?? payload.odontograma;
        if (this.isOdontogramObject(rawOdontograma)) {
          const parsed = OdontogramaSchema.safeParse(rawOdontograma);
          if (!parsed.success) {
            res.status(400).json({
              message:
                parsed.error.issues[0]?.message ||
                'Estructura inválida de odontograma.',
              errors: parsed.error.issues,
            });
            return;
          }
        }

        const rawPlan = body.planManejo ?? payload.planManejo;
        if (
          rawPlan &&
          typeof rawPlan === 'object' &&
          ('prescripcion_farmacologica' in rawPlan ||
            'incapacidad_medica' in rawPlan ||
            'remision_medica' in rawPlan)
        ) {
          const parsed = PlanManejoSchema.safeParse(rawPlan);
          if (!parsed.success) {
            res.status(400).json({
              message:
                parsed.error.issues[0]?.message ||
                'Estructura inválida de plan de manejo.',
              errors: parsed.error.issues,
            });
            return;
          }
        }

        updated = await this.repo.updateEvolutionEntrySameDay(idEvolucion, {
          motivoConsulta: body.motivoConsulta ?? payload.motivoConsulta,
          enfermedadActual: body.enfermedadActual ?? payload.enfermedadActual,
          antecedentesClinicos: rawAntecedentes,
          habitosHigiene: rawHabitos,
          examenEstomatognatico: rawExamen,
          examenFisicoObservaciones:
            body.examenFisicoObservaciones ?? payload.examenFisicoObservaciones,
          odontograma: rawOdontograma,
          procedimientoRealizado:
            body.procedimientoRealizado ?? payload.procedimientoRealizado ?? payload.notaEvolucion,
          diagnosticoGenerado:
            body.diagnosticoGenerado ?? payload.diagnosticoGenerado ?? payload.diagnostico,
          accionesARealizar: body.accionesARealizar ?? payload.accionesARealizar,
          hallazgosObservaciones:
            body.hallazgosObservaciones ?? payload.hallazgosObservaciones ?? payload.observaciones,
          planManejo: rawPlan,
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
