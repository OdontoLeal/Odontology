// src/modules/clinical-records/infrastructure/clinical-records.controller.ts
import { Request, Response } from 'express';
import { handleRequestError } from '../../../shared/infrastructure/http/http-error.handler';
import { getSessionUser, SessionUser } from '../../../shared/infrastructure/security/access-control';
import { CreateClinicalRecordUseCase } from '../application/create-clinical-record.use-case';
import { GetClinicalHistoryUseCase } from '../application/get-clinical-history.use-case';
import { ManageOdontogramUseCase } from '../application/manage-odontogram.use-case';
import { ClinicalAccessPolicy } from '../application/clinical-access.policy';
import { ActorContext, ClinicalDomainError, UserRoleCode } from '../domain/clinical-record.entity';
import {
  AppointmentClinicalContext,
  IClinicalRecordRepository,
} from '../domain/clinical-record.repository.interface';
import {
  AntecedentesClinicosSchema,
  HabitosHigieneSchema,
  ExamenEstomatognaticoSchema,
  OdontogramaSchema,
  PlanManejoSchema,
} from '../../../schemas';

type ZodLike = { safeParse(v: unknown): { success: boolean; data?: any; error?: any } };

/** Valida un bloque JSONB con su esquema Zod (contratos de la Capa 2) si viene informado. */
function validateJson(value: unknown, schema: ZodLike, marker: string, label: string): unknown {
  if (!value || typeof value !== 'object' || Object.keys(value as object).length === 0) return undefined;
  if (!(marker in (value as object))) return value;
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ClinicalDomainError(
      parsed.error?.issues?.[0]?.message || `Estructura inválida de ${label}.`,
      'BAD_REQUEST'
    );
  }
  return parsed.data;
}

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

export class ClinicalRecordsController {
  private readonly createClinicalRecordUseCase: CreateClinicalRecordUseCase;
  private readonly manageOdontogramUseCase: ManageOdontogramUseCase;
  private readonly getClinicalHistoryUseCase: GetClinicalHistoryUseCase;

  constructor(private readonly repo: IClinicalRecordRepository) {
    this.createClinicalRecordUseCase = new CreateClinicalRecordUseCase(repo);
    this.manageOdontogramUseCase = new ManageOdontogramUseCase(repo);
    this.getClinicalHistoryUseCase = new GetClinicalHistoryUseCase(repo);
  }

  /** El actor siempre sale de la sesión (antes se aceptaban cabeceras x-user-role). */
  private actorContext(user: SessionUser): ActorContext {
    return {
      idUsuario: user.idUsuario,
      nombreUsuario: user.nombreCompleto,
      roles: user.roles as UserRoleCode[],
    };
  }

  private async loadCita(idCita: number): Promise<AppointmentClinicalContext> {
    const cita = this.repo.getAppointmentContext ? await this.repo.getAppointmentContext(idCita) : null;
    if (!cita) throw new ClinicalDomainError('Cita no encontrada.', 'NOT_FOUND');
    return cita;
  }

  /** Extrae y valida los datos estructurados de la consulta (5 pestañas). */
  private structuredData(body: any) {
    const p = body.payload ?? {};
    return {
      motivoConsulta: text(body.motivoConsulta ?? p.motivoConsulta),
      enfermedadActual: text(body.enfermedadActual ?? p.enfermedadActual),
      antecedentesClinicos: validateJson(
        body.antecedentesClinicos ?? p.antecedentesClinicos ?? p.antecedentes,
        AntecedentesClinicosSchema,
        'accidentes_traumas',
        'antecedentes clínicos'
      ),
      habitosHigiene: validateJson(body.habitosHigiene ?? p.habitosHigiene, HabitosHigieneSchema, 'cepillado_dental', 'hábitos de higiene'),
      examenEstomatognatico: validateJson(
        body.examenEstomatognatico ?? p.examenEstomatognatico,
        ExamenEstomatognaticoSchema,
        'labios',
        'examen estomatognático'
      ),
      examenFisicoObservaciones: text(body.examenFisicoObservaciones ?? p.examenFisicoObservaciones),
      odontograma: validateJson(body.odontograma ?? p.odontograma, OdontogramaSchema, 'cuadrantes', 'odontograma') as any,
      procedimientoRealizado: text(body.procedimientoRealizado ?? p.procedimientoRealizado),
      diagnosticoGenerado: text(body.diagnosticoGenerado ?? p.diagnosticoGenerado ?? p.diagnostico),
      accionesARealizar: text(body.accionesARealizar ?? p.accionesARealizar),
      hallazgosObservaciones: text(body.hallazgosObservaciones ?? p.hallazgosObservaciones ?? p.observaciones),
      planManejo: validateJson(body.planManejo ?? p.planManejo, PlanManejoSchema, 'prescripcion_farmacologica', 'plan de manejo'),
    };
  }

  // RF-HCL-005, RF-HCL-007, RF-HCL-009: registrar en la historia de la consulta en curso
  createEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = getSessionUser(req)!;
      const body = req.body ?? {};
      const idPaciente = Number(body.idPaciente);
      const idCita = Number(body.idCita);
      if (!idPaciente || !idCita) {
        throw new ClinicalDomainError('idPaciente e idCita son obligatorios.', 'BAD_REQUEST');
      }

      const cita = await this.loadCita(idCita);
      // D-25: la cita debe ser del paciente indicado
      if (cita.idPaciente !== idPaciente) {
        throw new ClinicalDomainError('La cita indicada no corresponde al paciente especificado.', 'BAD_REQUEST');
      }

      const tipo = body.payload?.tipoRegistro ?? body.tipoRegistro;

      // RF-HCL-006/009: corrección posterior al cierre como nota aclaratoria
      if (tipo === 'NOTA_ACLARATORIA') {
        const autor = ClinicalAccessPolicy.resolveClarificationAuthor(user, cita);
        const evolucion = await this.repo.findEvolutionByCitaId(idCita);
        if (!evolucion) throw new ClinicalDomainError('La consulta no tiene historia clínica registrada.', 'NOT_FOUND');
        const nota = await this.repo.addClarificationNote!(
          evolucion.idEvolucion,
          String(body.notaAclaratoria ?? body.notaEvolucion ?? body.payload?.notaEvolucion ?? ''),
          autor
        );
        res.status(201).json({ message: 'Nota aclaratoria registrada.', data: nota });
        return;
      }

      const writer = ClinicalAccessPolicy.resolveWriter(user, cita);
      let entry;

      if (tipo === 'APERTURA_CONSULTA') {
        // Apertura con catálogo de antecedentes ("No aplica" para todos y "Sí" con observación)
        if (!writer.esProfesionalResponsable) throw new ClinicalDomainError('Solo el profesional responsable abre la historia clínica.', 'FORBIDDEN');
        entry = await this.createClinicalRecordUseCase.execute({
          idPaciente,
          idCita,
          estadoCita: cita.estado,
          idProfesionalResponsable: cita.idProfesional,
          actor: this.actorContext(user),
          writer,
          motivoConsulta: body.payload?.motivoConsulta ?? body.motivoConsulta ?? '',
          antecedentes: body.payload?.antecedentes ?? body.antecedentesClinicos,
          marcarTodoNoAplica: Boolean(body.marcarTodoNoAplica),
        });
      } else {
        const data = this.structuredData(body);
        // La auxiliar no escribe la apertura: lo que diligencia queda como nota de evolución con su nombre.
        const notaTexto = text(body.notaEvolucion) ??
          (writer.esProfesionalResponsable ? undefined : data.hallazgosObservaciones ?? data.procedimientoRealizado);

        entry = await this.repo.createEvolutionEntry({
          idPaciente,
          idCita,
          ...data,
          actor: writer,
          nota: notaTexto
            ? { texto: notaTexto, procedimientoRealizado: writer.esProfesionalResponsable ? undefined : data.procedimientoRealizado }
            : undefined,
        });
      }

      res.status(201).json({ message: 'Registro clínico guardado.', data: entry });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };

  // RF-HCL-006: editar la historia de la consulta mientras está En consulta
  updateEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = getSessionUser(req)!;
      const idEvolucion = Number(req.params.idEvolucion);
      const body = req.body ?? {};
      const idCita = Number(body.idCita);
      if (!idEvolucion || !idCita) {
        throw new ClinicalDomainError('idEvolucion e idCita son obligatorios.', 'BAD_REQUEST');
      }
      const cita = await this.loadCita(idCita);
      const evolucion = await this.repo.findEvolutionByCitaId(idCita);
      if (!evolucion || evolucion.idEvolucion !== idEvolucion) {
        throw new ClinicalDomainError('El registro no corresponde a la cita indicada.', 'BAD_REQUEST');
      }
      const writer = ClinicalAccessPolicy.resolveWriter(user, cita);
      const data = this.structuredData(body);
      const updated = await this.repo.updateEvolutionEntry(
        idEvolucion,
        { ...data, notaEvolucion: text(body.notaEvolucion) } as any,
        writer
      );
      res.json({ message: 'Historia clínica actualizada.', data: updated });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };

  // Historia de la consulta de una cita (vista de la consulta en curso)
  getConsultationRecord = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = getSessionUser(req)!;
      const cita = await this.loadCita(Number(req.params.idCita));
      ClinicalAccessPolicy.assertCanViewConsultation(user, cita);
      const evolucion = await this.repo.findEvolutionByCitaId(cita.idCita);
      res.json({
        data: {
          cita,
          registro: evolucion,
          mensaje: evolucion ? null : 'La consulta aún no tiene apertura de historia clínica.',
        },
      });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };

  // RF-HCL-007: último odontograma del paciente (o uno en blanco en la primera consulta)
  getLatestOdontogram = async (req: Request, res: Response): Promise<void> => {
    try {
      const odontograma = await this.manageOdontogramUseCase.getLatestOdontogramSnapshot(
        Number(req.params.idPaciente),
        req.query.esMenor === 'true'
      );
      res.json({ data: odontograma });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };

  // RF-HCL-008: historial clínico completo (solo ROL-ODO y ROL-ESP), con inasistencias
  getHistoryByPatient = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = getSessionUser(req)!;
      ClinicalAccessPolicy.assertCanViewHistory(user);
      const idPaciente = Number(req.params.idPaciente);
      const inasistencias = this.repo.getNoShowsByPatient ? await this.repo.getNoShowsByPatient(idPaciente) : [];
      const history = await this.getClinicalHistoryUseCase.execute({
        idPaciente,
        actor: this.actorContext(user),
        inasistenciasPaciente: inasistencias,
      });
      res.json({ data: history });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };
}
