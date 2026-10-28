import {
  ActorContext,
  AntecedentsMap,
  AuthorshipMetadata,
  ClinicalRecordEntity,
} from '../domain/clinical-record.entity';
import { IClinicalRecordRepository } from '../domain/clinical-record.repository.interface';
import { OdontogramDataDTO } from '../infrastructure/clinical-record.model';

export interface ClinicalHistoryConsultationItem {
  idCita: number;
  estadoCita: string;
  esInasistencia: boolean;
  fechaHoraRegistro: string | null;
  profesionalResponsable: string | null;
  motivoConsulta: string | null;
  enfermedadActual?: string | null;
  antecedentes: AntecedentsMap | null;
  habitosHigiene?: any;
  examenEstomatognatico?: any;
  examenFisicoObservaciones?: string | null;
  odontograma: OdontogramDataDTO | null;
  procedimientoRealizado?: string | null;
  diagnosticoGenerado?: string | null;
  accionesARealizar?: string | null;
  hallazgosObservaciones?: string | null;
  planManejo?: any;
  notasEvolucion: Array<{
    idEvolucion: number;
    tipoRegistro: string;
    procedimientoRealizado?: string;
    notaEvolucion?: string;
    diligenciadoPor: AuthorshipMetadata;
    editableHoy: boolean;
  }>;
}

export interface ClinicalHistoryResponse {
  idHistoria: number | null;
  idPaciente: number;
  mensaje?: string;
  historial: ClinicalHistoryConsultationItem[];
}

export class GetClinicalHistoryUseCase {
  public static readonly EMPTY_HISTORY_MESSAGE =
    'El paciente no tiene historias clínicas registradas';

  constructor(private readonly clinicalRepo: IClinicalRecordRepository) {}

  async execute(params: {
    idPaciente: number;
    actor: ActorContext;
    inasistenciasPaciente?: Array<{
      idCita: number;
      fechaHora: string;
      profesionalResponsable: string;
      observacion?: string;
    }>;
  }): Promise<ClinicalHistoryResponse> {
    // Regla de Negocio 5 y RF-HCL-008: Solo ROL-ODO y ROL-ESP pueden consultar el historial clínico
    ClinicalRecordEntity.assertCanViewClinicalHistory(params.actor);

    const rows = await this.clinicalRepo.getClinicalHistoryByPatient(
      params.idPaciente
    );

    const validEvolutionRows = rows.filter((r) => r.idEvolucion !== null);
    const inasistencias = params.inasistenciasPaciente ?? [];

    if (validEvolutionRows.length === 0 && inasistencias.length === 0) {
      return {
        idHistoria: rows[0]?.idHistoria ?? null,
        idPaciente: params.idPaciente,
        mensaje: GetClinicalHistoryUseCase.EMPTY_HISTORY_MESSAGE,
        historial: [],
      };
    }

    const todayColombiaKey = ClinicalRecordEntity.toColombiaDateKey(new Date());
    const consultationsByCita = new Map<number, ClinicalHistoryConsultationItem>();

    for (const row of validEvolutionRows) {
      if (!row.idCita) continue;

      const fechaDate = row.fechaRegistro ? new Date(row.fechaRegistro) : new Date();
      const isSameDay =
        ClinicalRecordEntity.toColombiaDateKey(fechaDate) === todayColombiaKey;

      if (!consultationsByCita.has(row.idCita)) {
        consultationsByCita.set(row.idCita, {
          idCita: row.idCita,
          estadoCita: row.estadoCita ?? 'Atendida',
          esInasistencia: row.estadoCita === 'Inasistencia',
          fechaHoraRegistro: row.fechaRegistro
            ? new Date(row.fechaRegistro).toISOString()
            : row.evolucion?.diligenciadoPor?.fechaHoraISO ?? new Date().toISOString(),
          profesionalResponsable: row.profesionalResponsable,
          motivoConsulta: null,
          enfermedadActual: null,
          antecedentes: null,
          habitosHigiene: null,
          examenEstomatognatico: null,
          examenFisicoObservaciones: null,
          odontograma: null,
          procedimientoRealizado: null,
          diagnosticoGenerado: null,
          accionesARealizar: null,
          hallazgosObservaciones: null,
          planManejo: null,
          notasEvolucion: [],
        });
      }

      const item = consultationsByCita.get(row.idCita)!;

      const motivo = row.motivoConsulta || row.evolucion?.motivoConsulta;
      if (motivo && !item.motivoConsulta) {
        item.motivoConsulta = motivo;
      }

      const enfActual = row.enfermedadActual || row.evolucion?.enfermedadActual;
      if (enfActual && !item.enfermedadActual) {
        item.enfermedadActual = enfActual;
      }

      const antec = row.antecedentesClinicos || row.evolucion?.antecedentes;
      if (antec && !item.antecedentes) {
        item.antecedentes = antec;
      }

      const habitos = row.habitosHigiene || row.evolucion?.habitosHigiene;
      if (habitos && !item.habitosHigiene) {
        item.habitosHigiene = habitos;
      }

      const examen = row.examenEstomatognatico || row.evolucion?.examenEstomatognatico;
      if (examen && !item.examenEstomatognatico) {
        item.examenEstomatognatico = examen;
      }

      const examObs = row.examenFisicoObservaciones || row.evolucion?.examenFisicoObservaciones;
      if (examObs && !item.examenFisicoObservaciones) {
        item.examenFisicoObservaciones = examObs;
      }

      let odonto = row.odontograma || row.evolucion?.odontograma;
      if (typeof odonto === 'string') {
        try {
          odonto = JSON.parse(odonto);
        } catch {}
      }
      if (odonto && (odonto as any).cuadrantes && !item.odontograma) {
        item.odontograma = odonto;
      }

      const proc = row.procedimientoRealizado || row.evolucion?.procedimientoRealizado;
      if (proc && !item.procedimientoRealizado) {
        item.procedimientoRealizado = proc;
      }

      const diag =
        row.diagnosticoGenerado ||
        row.evolucion?.diagnosticoGenerado ||
        row.evolucion?.diagnostico;
      if (diag && !item.diagnosticoGenerado) {
        item.diagnosticoGenerado = diag;
      }

      const acciones = row.accionesARealizar || row.evolucion?.accionesARealizar;
      if (acciones && !item.accionesARealizar) {
        item.accionesARealizar = acciones;
      }

      const hallazgos =
        row.hallazgosObservaciones ||
        row.evolucion?.hallazgosObservaciones ||
        row.evolucion?.observaciones;
      if (hallazgos && !item.hallazgosObservaciones) {
        item.hallazgosObservaciones = hallazgos;
      }

      const plan = row.planManejo || row.evolucion?.planManejo;
      if (plan && !item.planManejo) {
        item.planManejo = plan;
      }

      item.notasEvolucion.push({
        idEvolucion: row.idEvolucion!,
        tipoRegistro: row.evolucion?.tipoRegistro ?? 'EVOLUCION_CLINICA',
        procedimientoRealizado: proc ?? undefined,
        notaEvolucion:
          row.evolucion?.notaEvolucion ??
          proc ??
          hallazgos ??
          motivo ??
          'Atención odontológica realizada.',
        diligenciadoPor: row.evolucion?.diligenciadoPor ?? {
          idUsuario: 1,
          nombreUsuario: row.profesionalResponsable ?? 'Personal Clínico',
          idProfesionalResponsable: 1,
          fechaHoraISO: row.fechaRegistro
            ? new Date(row.fechaRegistro).toISOString()
            : new Date().toISOString(),
        },
        editableHoy: isSameDay,
      });
    }

    for (const inasistencia of inasistencias) {
      if (!consultationsByCita.has(inasistencia.idCita)) {
        consultationsByCita.set(inasistencia.idCita, {
          idCita: inasistencia.idCita,
          estadoCita: 'Inasistencia',
          esInasistencia: true,
          fechaHoraRegistro: inasistencia.fechaHora,
          profesionalResponsable: inasistencia.profesionalResponsable,
          motivoConsulta: inasistencia.observacion ?? 'Inasistencia a la cita',
          antecedentes: null,
          odontograma: null,
          notasEvolucion: [],
        });
      }
    }

    const sortedHistory = Array.from(consultationsByCita.values()).sort((a, b) => {
      const timeA = a.fechaHoraRegistro ? new Date(a.fechaHoraRegistro).getTime() : 0;
      const timeB = b.fechaHoraRegistro ? new Date(b.fechaHoraRegistro).getTime() : 0;
      return timeB - timeA;
    });

    return {
      idHistoria: rows[0]?.idHistoria ?? null,
      idPaciente: params.idPaciente,
      historial: sortedHistory,
    };
  }
}
