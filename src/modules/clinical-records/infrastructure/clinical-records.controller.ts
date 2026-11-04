import { Request, Response } from 'express';
import { db } from '../../../shared/infrastructure/database/database';
import { CreateClinicalRecordUseCase } from '../application/create-clinical-record.use-case';
import { GetClinicalHistoryUseCase } from '../application/get-clinical-history.use-case';
import { ManageOdontogramUseCase } from '../application/manage-odontogram.use-case';
import { RegisterEvolutionUseCase } from '../application/register-evolution.use-case';
import { UpdateClinicalRecordUseCase } from '../application/update-clinical-record.use-case';
import {
  ActorContext,
  ClinicalDomainError,
  UserRoleCode,
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
    const headerRole = (req.headers['x-user-role'] || req.headers['x-user-roles']) as string;
    let roles: UserRoleCode[] = [];

    if (Array.isArray(authUser?.roles) && authUser.roles.length > 0) {
      roles = authUser.roles.map((r: any) => (typeof r === 'string' ? r : r.codigoRol || r.nombreRol));
    } else if (headerRole) {
      roles = headerRole.split(',').map((r) => r.trim() as UserRoleCode);
    }

    const idUsuario = Number(
      authUser?.idUsuario ??
        req.headers['x-user-id'] ??
        req.body?.payload?.diligenciadoPor?.idUsuario ??
        req.body?.diligenciadoPor?.idUsuario ??
        (roles.includes('ROL-AUX') ? 5 : 1)
    );

    const nombreUsuario = String(
      authUser?.nombreCompleto ??
        req.headers['x-user-name'] ??
        req.body?.payload?.diligenciadoPor?.nombreUsuario ??
        req.body?.diligenciadoPor?.nombreUsuario ??
        (roles.includes('ROL-AUX') ? 'Milena' : 'Personal Clínico')
    );

    return {
      idUsuario,
      nombreUsuario,
      roles,
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

      // DEF-13 & CPS-HCL-005-03: Validar estado de la cita directamente en la BD (public.cita)
      const citaRes = await db.query<{ estado: string; id_usuario: number; id_paciente: number; profesional_nombre?: string }>(
        `SELECT c.estado, c.id_usuario, c.id_paciente, u.nombre_completo as profesional_nombre
         FROM public.cita c
         LEFT JOIN public.usuario u ON u.id_usuario = c.id_usuario
         WHERE c.id_cita = $1;`,
        [idCita]
      );

      if (citaRes.rows.length === 0) {
        res.status(404).json({ message: 'Cita no encontrada.' });
        return;
      }

      const citaDb = citaRes.rows[0];

      // I5-002 (RF-HCL-009, D-25): Validar que la cita pertenezca al paciente especificado
      if (Number(citaDb.id_paciente) !== Number(idPaciente)) {
        res.status(400).json({
          field: 'idCita',
          message: 'La cita indicada no corresponde al paciente especificado.',
        });
        return;
      }

      if (citaDb.estado !== 'En consulta') {
        res.status(409).json({
          message: 'Solo se puede crear o abrir la historia clínica cuando la cita está "En consulta".',
        });
        return;
      }

      // DEF-01: Coordinadora no tiene permisos clínicos
      if (
        actor.roles.includes('ROL-COA') &&
        !actor.roles.includes('ROL-ADM') &&
        !actor.roles.includes('ROL-ODO') &&
        !actor.roles.includes('ROL-ESP')
      ) {
        res.status(403).json({ message: 'No tiene permiso para realizar esta acción' });
        return;
      }

      const idProfesionalResponsable = Number(
        citaDb.id_usuario ??
          body.idProfesionalResponsable ??
          payload.diligenciadoPor?.idProfesionalResponsable ??
          actor.idUsuario
      );

      let entry;

      if (payload.tipoRegistro === 'APERTURA_CONSULTA') {
        entry = await this.createClinicalRecordUseCase.execute({
          idPaciente: Number(idPaciente),
          idCita: Number(idCita),
          estadoCita: 'En consulta',
          idProfesionalResponsable,
          actor,
          motivoConsulta: payload.motivoConsulta ?? body.motivoConsulta ?? '',
          antecedentes: payload.antecedentes ?? body.antecedentesClinicos,
          marcarTodoNoAplica: Boolean(req.body.marcarTodoNoAplica),
        });
      } else if (
        (payload.tipoRegistro === 'EVOLUCION_ODONTOGRAMA' || this.isOdontogramObject(body.odontograma)) &&
        this.isOdontogramObject(payload.odontograma || body.odontograma) &&
        !payload.procedimientoRealizado &&
        !body.procedimientoRealizado
      ) {
        entry = await this.manageOdontogramUseCase.execute({
          idPaciente: Number(idPaciente),
          idCita: Number(idCita),
          estadoCita: 'En consulta',
          idProfesionalResponsable,
          esMenorDe18Anios: Boolean(esMenorDe18Anios),
          actor,
          odontograma: payload.odontograma || body.odontograma,
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

        const diligenciadoPor = {
          idUsuario: actor.idUsuario,
          nombreUsuario: actor.nombreUsuario,
          idProfesionalResponsable,
          fechaHoraISO: new Date().toISOString(),
        };

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
            diligenciadoPor,
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
          estadoCita: 'En consulta',
          idProfesionalResponsable,
          actor,
          procedimientoRealizado:
            body.procedimientoRealizado ||
            payload.procedimientoRealizado ||
            'Atención odontológica en consulta',
          notaEvolucionTextoLibre,
          plantillaCodigo: req.body.plantillaCodigo,
          camposPlantilla: req.body.camposPlantilla,
          esNotaAclaratoria: Boolean(req.body.esNotaAclaratoria),
        });
      }

      res.status(201).json({
        message: 'Entrada clínica registrada exitosamente.',
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
          diligenciadoPor: {
            idUsuario: actor.idUsuario,
            nombreUsuario: actor.nombreUsuario,
            idProfesionalResponsable: Number(payload.diligenciadoPor?.idProfesionalResponsable ?? actor.idUsuario),
            fechaHoraISO: new Date().toISOString(),
          },
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
      const authUser = (req as any).user;
      if (!authUser && !req.headers['x-user-role'] && !req.headers['authorization']) {
        res.status(401).json({
          message: 'Se requiere iniciar sesión para consultar el expediente clínico.',
        });
        return;
      }

      const actor = this.extractActor(req);
      let isAllowed =
        actor.roles.includes('ROL-ODO') ||
        actor.roles.includes('ROL-ESP') ||
        actor.roles.includes('ROL-ADM');

      const idPaciente = Number(req.params.idPaciente);

      // I5-006 (RQNF-SEG-003, Regla de Negocio 5, D-26):
      // Rol auxiliar (ROL-AUX) puede consultar la historia del paciente exclusivamente si tiene cita activa "En consulta"
      if (!isAllowed && actor.roles.includes('ROL-AUX')) {
        const enConsultaRes = await db.query<{ id_cita: number }>(
          `SELECT id_cita FROM public.cita WHERE id_paciente = $1 AND estado = 'En consulta' LIMIT 1;`,
          [idPaciente]
        );
        if (enConsultaRes.rows.length > 0) {
          isAllowed = true;
        }
      }

      if (!isAllowed) {
        // I2-009 & RQNF-SEG-009: Registrar en auditoría intento no autorizado
        try {
          await db.query(
            `INSERT INTO log_auditoria (usuario, accion, registro_afectado, detalle) VALUES ($1, $2, $3, $4)`,
            [
              actor.nombreUsuario || 'Desconocido',
              'Intento no autorizado de consulta de historia clínica',
              `paciente:${idPaciente}`,
              JSON.stringify({ ruta: req.originalUrl, metodo: req.method, roles: actor.roles }),
            ]
          );
        } catch (_) {}

        // I2-009 & I5-006 (D-18): Mensaje canónico ERS v1.2
        res.status(403).json({
          message: 'No tiene permiso para realizar esta acción',
        });
        return;
      }
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
