// src/modules/clinical-records/infrastructure/clinical-record.repository.ts
import { PoolClient } from 'pg';
import { db } from '../../../shared/infrastructure/database/database';
import { auditLog } from '../../../shared/infrastructure/audit/audit-log.service';
import {
  AppointmentClinicalContext,
  ClinicalHistoryRow,
  EvolutionRecordRow,
  IClinicalRecordRepository,
} from '../domain/clinical-record.repository.interface';
import { ClinicalDomainError } from '../domain/clinical-record.entity';
import {
  ClinicalEvolutionPayload,
  ClinicalWriteActor,
  CreateEvolutionEntryDTO,
  NotaEvolucionRow,
} from './clinical-record.model';
import {
  createDefaultAntecedentesClinicos,
  createDefaultHabitosHigiene,
  createDefaultExamenEstomatognatico,
  createInitialOdontograma,
  createDefaultPlanManejo,
} from '../../../schemas';

function isNonEmptyObject(val: unknown): boolean {
  return Boolean(val && typeof val === 'object' && Object.keys(val as object).length > 0);
}

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Campos de la apertura de la consulta: solo los escribe el profesional responsable. */
const OPENING_COLUMNS = [
  'motivo_consulta',
  'enfermedad_actual',
  'antecedentes_clinicos',
  'habitos_higiene',
  'examen_estomatognatico',
  'examen_fisico_observaciones',
  'procedimiento_realizado',
  'diagnostico_generado',
  'acciones_a_realizar',
  'hallazgos_observaciones',
  'plan_manejo',
] as const;

const JSON_COLUMNS = new Set(['antecedentes_clinicos', 'habitos_higiene', 'examen_estomatognatico', 'plan_manejo', 'odontograma']);

const EVOLUTION_SELECT = `
  e.id_evolucion, e.id_historia, e.fecha, e.id_cita, e.motivo_consulta, e.enfermedad_actual,
  e.antecedentes_clinicos, e.habitos_higiene, e.examen_estomatognatico, e.examen_fisico_observaciones,
  e.odontograma, e.procedimiento_realizado, e.diagnostico_generado, e.acciones_a_realizar,
  e.hallazgos_observaciones, e.plan_manejo, e.id_usuario_diligencio,
  c.estado AS estado_cita, c.id_usuario AS id_profesional,
  up.nombre_completo AS profesional_responsable, up.firma_base64 AS profesional_firma,
  ud.nombre_completo AS diligenciado_por_nombre,
  COALESCE((
    SELECT json_agg(json_build_object(
             'idNota', n.id_nota,
             'tipo', n.tipo,
             'procedimientoRealizado', n.procedimiento_realizado,
             'texto', n.texto,
             'fecha', to_char(n.fecha, 'YYYY-MM-DD"T"HH24:MI:SS'),
             'diligenciadoPor', json_build_object('idUsuario', un.id_usuario, 'nombreUsuario', un.nombre_completo)
           ) ORDER BY n.fecha)
      FROM public.nota_evolucion n
      JOIN public.usuario un ON un.id_usuario = n.id_usuario_diligencio
     WHERE n.id_evolucion = e.id_evolucion
  ), '[]') AS notas
`;

const EVOLUTION_FROM = `
  FROM public.evolucion e
  JOIN public.cita c ON c.id_cita = e.id_cita
  JOIN public.usuario up ON up.id_usuario = c.id_usuario
  LEFT JOIN public.usuario ud ON ud.id_usuario = e.id_usuario_diligencio
`;

function mapEvolucionRow(row: any): EvolutionRecordRow {
  const motivoConsulta = row.motivo_consulta ?? '';
  const antecedentesClinicos = isNonEmptyObject(row.antecedentes_clinicos)
    ? row.antecedentes_clinicos
    : createDefaultAntecedentesClinicos();
  const habitosHigiene = isNonEmptyObject(row.habitos_higiene) ? row.habitos_higiene : createDefaultHabitosHigiene();
  const examenEstomatognatico = isNonEmptyObject(row.examen_estomatognatico)
    ? row.examen_estomatognatico
    : createDefaultExamenEstomatognatico();
  const odontograma = isNonEmptyObject(row.odontograma) ? row.odontograma : createInitialOdontograma();
  const planManejo = isNonEmptyObject(row.plan_manejo) ? row.plan_manejo : createDefaultPlanManejo();
  const notas: NotaEvolucionRow[] = row.notas ?? [];

  // "Diligenciado por" de la apertura: quien la registró (no el profesional de la cita por defecto)
  const diligenciadoPor = {
    idUsuario: Number(row.id_usuario_diligencio ?? row.id_profesional),
    nombreUsuario: String(row.diligenciado_por_nombre ?? row.profesional_responsable ?? ''),
    idProfesionalResponsable: Number(row.id_profesional),
    firmaBase64: row.profesional_firma ?? null,
    fechaHoraISO: row.fecha ? new Date(row.fecha).toISOString() : new Date().toISOString(),
  };

  const evolucion: ClinicalEvolutionPayload = {
    tipoRegistro: 'APERTURA_CONSULTA',
    motivoConsulta,
    enfermedadActual: row.enfermedad_actual ?? undefined,
    antecedentes: antecedentesClinicos,
    antecedentesClinicos,
    habitosHigiene,
    examenEstomatognatico,
    examenFisicoObservaciones: row.examen_fisico_observaciones ?? undefined,
    odontograma,
    procedimientoRealizado: row.procedimiento_realizado ?? undefined,
    notaEvolucion: notas.length ? notas[notas.length - 1].texto : undefined,
    diagnostico: row.diagnostico_generado ?? undefined,
    diagnosticoGenerado: row.diagnostico_generado ?? undefined,
    accionesARealizar: row.acciones_a_realizar ?? undefined,
    observaciones: row.hallazgos_observaciones ?? undefined,
    hallazgosObservaciones: row.hallazgos_observaciones ?? undefined,
    planManejo,
    diligenciadoPor,
  };

  return {
    idEvolucion: Number(row.id_evolucion),
    idHistoria: Number(row.id_historia),
    fecha: row.fecha,
    idCita: Number(row.id_cita),
    motivoConsulta,
    enfermedadActual: row.enfermedad_actual ?? null,
    antecedentesClinicos,
    habitosHigiene,
    examenEstomatognatico,
    examenFisicoObservaciones: row.examen_fisico_observaciones ?? null,
    odontograma,
    procedimientoRealizado: row.procedimiento_realizado ?? null,
    diagnosticoGenerado: row.diagnostico_generado ?? null,
    accionesARealizar: row.acciones_a_realizar ?? null,
    hallazgosObservaciones: row.hallazgos_observaciones ?? null,
    planManejo,
    evolucion,
    diligenciadoPor,
    estadoCita: row.estado_cita ?? null,
    notas,
  };
}

/** Valores de la apertura recibidos del cliente (solo los que vienen informados). */
function openingValuesFrom(dto: Partial<CreateEvolutionEntryDTO> & Record<string, any>): Record<string, unknown> {
  const p = dto.payload ?? ({} as any);
  const candidates: Record<string, unknown> = {
    motivo_consulta: dto.motivoConsulta ?? p.motivoConsulta,
    enfermedad_actual: dto.enfermedadActual ?? p.enfermedadActual,
    antecedentes_clinicos: dto.antecedentesClinicos ?? p.antecedentesClinicos ?? p.antecedentes,
    habitos_higiene: dto.habitosHigiene ?? p.habitosHigiene,
    examen_estomatognatico: dto.examenEstomatognatico ?? p.examenEstomatognatico,
    examen_fisico_observaciones: dto.examenFisicoObservaciones ?? p.examenFisicoObservaciones,
    procedimiento_realizado: dto.procedimientoRealizado ?? p.procedimientoRealizado,
    diagnostico_generado: dto.diagnosticoGenerado ?? p.diagnosticoGenerado ?? p.diagnostico,
    acciones_a_realizar: dto.accionesARealizar ?? p.accionesARealizar,
    hallazgos_observaciones: dto.hallazgosObservaciones ?? p.hallazgosObservaciones ?? p.observaciones,
    plan_manejo: dto.planManejo ?? p.planManejo,
  };
  const values: Record<string, unknown> = {};
  for (const [col, val] of Object.entries(candidates)) {
    if (JSON_COLUMNS.has(col) ? isNonEmptyObject(val) : nonEmpty(val)) values[col] = val;
  }
  return values;
}

export class ClinicalRecordRepository implements IClinicalRecordRepository {
  async getAppointmentContext(idCita: number): Promise<AppointmentClinicalContext | null> {
    const { rows } = await db.query(
      `SELECT c.id_cita, c.id_paciente, c.id_usuario, c.estado, u.nombre_completo
         FROM public.cita c JOIN public.usuario u ON u.id_usuario = c.id_usuario
        WHERE c.id_cita = $1;`,
      [idCita]
    );
    if (!rows[0]) return null;
    return {
      idCita: rows[0].id_cita,
      idPaciente: rows[0].id_paciente,
      idProfesional: rows[0].id_usuario,
      nombreProfesional: rows[0].nombre_completo,
      estado: rows[0].estado,
    };
  }

  private async findForUpdate(client: PoolClient, where: string, param: number): Promise<any | null> {
    const { rows } = await client.query(`SELECT * FROM public.evolucion e WHERE ${where} FOR UPDATE;`, [param]);
    return rows[0] ?? null;
  }

  private async loadById(executor: { query: PoolClient['query'] }, idEvolucion: number): Promise<EvolutionRecordRow> {
    const { rows } = await executor.query(`SELECT ${EVOLUTION_SELECT} ${EVOLUTION_FROM} WHERE e.id_evolucion = $1;`, [
      idEvolucion,
    ]);
    return mapEvolucionRow(rows[0]);
  }

  private async insertNote(
    client: PoolClient,
    idEvolucion: number,
    actor: ClinicalWriteActor,
    tipo: 'EVOLUCION' | 'NOTA_ACLARATORIA',
    texto: string,
    procedimiento?: string | null
  ): Promise<NotaEvolucionRow | null> {
    // Evita duplicar la misma nota cuando la pantalla vuelve a enviar el formulario completo
    const last = await client.query(
      `SELECT texto, procedimiento_realizado FROM public.nota_evolucion
        WHERE id_evolucion = $1 AND id_usuario_diligencio = $2 AND tipo = $3
        ORDER BY fecha DESC LIMIT 1;`,
      [idEvolucion, actor.idUsuario, tipo]
    );
    if (
      last.rows[0] &&
      last.rows[0].texto === texto.trim() &&
      (last.rows[0].procedimiento_realizado ?? null) === (procedimiento?.trim() || null)
    ) {
      return null;
    }
    const { rows } = await client.query(
      `INSERT INTO public.nota_evolucion (id_evolucion, tipo, procedimiento_realizado, texto, id_usuario_diligencio)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_nota, tipo, procedimiento_realizado, texto, to_char(fecha, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha;`,
      [idEvolucion, tipo, procedimiento?.trim() || null, texto.trim(), actor.idUsuario]
    );
    await auditLog.record(
      {
        idUsuario: actor.idUsuario,
        actor: actor.correo,
        accion: 'CREAR',
        entidad: 'nota_evolucion',
        idRegistro: rows[0].id_nota,
        valorNuevo: { idEvolucion, tipo, texto: texto.trim(), procedimiento: procedimiento ?? null },
      },
      client
    );
    return {
      idNota: rows[0].id_nota,
      tipo: rows[0].tipo,
      procedimientoRealizado: rows[0].procedimiento_realizado,
      texto: rows[0].texto,
      fecha: rows[0].fecha,
      diligenciadoPor: { idUsuario: actor.idUsuario, nombreUsuario: actor.nombreUsuario },
    };
  }

  /**
   * RF-HCL-005, RF-HCL-007, RF-HCL-009 (ERS v1.3).
   * - Sin apertura: solo el profesional responsable la crea, con motivo de consulta.
   * - Con apertura: el profesional la edita (RF-HCL-006, con valor anterior y nuevo);
   *   la auxiliar solo actualiza el odontograma. Las evoluciones nunca pisan la apertura (D-28).
   * - La nota de evolución se guarda en `nota_evolucion` con su autor.
   * Las reglas de la cita (En consulta, paciente de la cita, rol) las valida el controlador.
   */
  async createEvolutionEntry(dto: CreateEvolutionEntryDTO): Promise<EvolutionRecordRow> {
    const actor = dto.actor;
    if (!actor) {
      throw new ClinicalDomainError('No se identificó al usuario que diligencia el registro.', 'FORBIDDEN');
    }

    return db.withTransaction(async (client) => {
      const hcRes = await client.query<{ id_historia: number }>(
        `SELECT id_historia FROM public.historia_clinica WHERE id_paciente = $1;`,
        [dto.idPaciente]
      );
      if (hcRes.rows.length === 0) {
        throw new ClinicalDomainError('El paciente no tiene historia clínica (RF-HCL-001).', 'NOT_FOUND');
      }
      const idHistoria = hcRes.rows[0].id_historia;

      const existing = await this.findForUpdate(client, 'e.id_cita = $1', dto.idCita);
      const opening = openingValuesFrom(dto as any);
      const odontograma = isNonEmptyObject(dto.odontograma ?? dto.payload?.odontograma)
        ? (dto.odontograma ?? dto.payload?.odontograma)
        : null;

      let idEvolucion: number;

      if (!existing) {
        if (!actor.esProfesionalResponsable) {
          throw new ClinicalDomainError(
            'El profesional responsable debe registrar primero la apertura de la consulta (motivo de consulta).',
            'BAD_REQUEST'
          );
        }
        if (!nonEmpty(opening.motivo_consulta)) {
          throw new ClinicalDomainError('Falta registrar el motivo de consulta.', 'BAD_REQUEST');
        }
        const ins = await client.query<{ id_evolucion: number }>(
          `INSERT INTO public.evolucion (
             id_historia, id_cita, motivo_consulta, enfermedad_actual, antecedentes_clinicos, habitos_higiene,
             examen_estomatognatico, examen_fisico_observaciones, odontograma, procedimiento_realizado,
             diagnostico_generado, acciones_a_realizar, hallazgos_observaciones, plan_manejo, id_usuario_diligencio)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9::jsonb, $10, $11, $12, $13, $14::jsonb, $15)
           RETURNING id_evolucion;`,
          [
            idHistoria,
            dto.idCita,
            String(opening.motivo_consulta).trim().slice(0, 250),
            (opening.enfermedad_actual as string) ?? 'N/A',
            JSON.stringify(opening.antecedentes_clinicos ?? createDefaultAntecedentesClinicos()),
            JSON.stringify(opening.habitos_higiene ?? createDefaultHabitosHigiene()),
            JSON.stringify(opening.examen_estomatognatico ?? createDefaultExamenEstomatognatico()),
            (opening.examen_fisico_observaciones as string) ?? null,
            JSON.stringify(odontograma ?? createInitialOdontograma()),
            (opening.procedimiento_realizado as string) ?? null,
            (opening.diagnostico_generado as string) ?? null,
            (opening.acciones_a_realizar as string) ?? null,
            (opening.hallazgos_observaciones as string) ?? null,
            JSON.stringify(opening.plan_manejo ?? createDefaultPlanManejo()),
            actor.idUsuario,
          ]
        );
        idEvolucion = ins.rows[0].id_evolucion;
        await auditLog.record(
          {
            idUsuario: actor.idUsuario,
            actor: actor.correo,
            accion: 'CREAR',
            entidad: 'evolucion',
            idRegistro: idEvolucion,
            valorNuevo: { idCita: dto.idCita, ...opening, odontograma: Boolean(odontograma) },
          },
          client
        );
      } else {
        idEvolucion = existing.id_evolucion;
        const changes: Record<string, unknown> = {};
        if (actor.esProfesionalResponsable) Object.assign(changes, opening);
        if (odontograma) changes.odontograma = odontograma;
        await this.applyChanges(client, existing, changes, actor);
      }

      // Nota de evolución (RF-HCL-009): texto libre y procedimiento con su autor
      const notaTexto = dto.nota?.texto;
      if (nonEmpty(notaTexto)) {
        await this.insertNote(client, idEvolucion, actor, 'EVOLUCION', notaTexto, dto.nota?.procedimientoRealizado);
      }

      return this.loadById(client, idEvolucion);
    });
  }

  /** Aplica cambios a la fila existente guardando valor anterior y nuevo (RQNF-SEG-009). */
  private async applyChanges(
    client: PoolClient,
    existing: any,
    changes: Record<string, unknown>,
    actor: ClinicalWriteActor
  ): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const anterior: Record<string, unknown> = {};
    const nuevo: Record<string, unknown> = {};

    for (const [col, value] of Object.entries(changes)) {
      if (![...OPENING_COLUMNS, 'odontograma'].includes(col as any)) continue;
      const before = existing[col];
      const same = JSON.stringify(before ?? null) === JSON.stringify(value ?? null);
      if (same) continue;
      params.push(JSON_COLUMNS.has(col) ? JSON.stringify(value) : value);
      sets.push(`${col} = $${params.length}${JSON_COLUMNS.has(col) ? '::jsonb' : ''}`);
      anterior[col] = before ?? null;
      nuevo[col] = value;
    }
    if (sets.length === 0) return;

    params.push(existing.id_evolucion);
    await client.query(`UPDATE public.evolucion SET ${sets.join(', ')} WHERE id_evolucion = $${params.length};`, params);
    await auditLog.record(
      {
        idUsuario: actor.idUsuario,
        actor: actor.correo,
        accion: 'MODIFICAR',
        entidad: 'evolucion',
        idRegistro: existing.id_evolucion,
        valorAnterior: anterior,
        valorNuevo: nuevo,
      },
      client
    );
  }

  /**
   * RF-HCL-006 y RQNF-FUN-001 (ERS v1.3): la historia se modifica solo mientras la
   * cita está En consulta; después queda en solo lectura y solo admite notas aclaratorias.
   */
  async updateEvolutionEntry(
    idEvolucion: number,
    nuevoPayload: ClinicalEvolutionPayload | Partial<EvolutionRecordRow>,
    actor?: ClinicalWriteActor
  ): Promise<EvolutionRecordRow> {
    if (!actor) {
      throw new ClinicalDomainError('No se identificó al usuario que modifica el registro.', 'FORBIDDEN');
    }
    return db.withTransaction(async (client) => {
      const existing = await this.findForUpdate(client, 'e.id_evolucion = $1', idEvolucion);
      if (!existing) throw new ClinicalDomainError('Registro de evolución no encontrado.', 'NOT_FOUND');

      const cita = await client.query<{ estado: string }>(`SELECT estado FROM public.cita WHERE id_cita = $1;`, [
        existing.id_cita,
      ]);
      if (cita.rows[0]?.estado !== 'En consulta') {
        throw new ClinicalDomainError(
          'La historia clínica de una consulta finalizada es de solo lectura. Registre una nota aclaratoria.',
          'FORBIDDEN'
        );
      }

      const payload = nuevoPayload as any;
      const changes: Record<string, unknown> = {};
      if (actor.esProfesionalResponsable) Object.assign(changes, openingValuesFrom(payload));
      if (isNonEmptyObject(payload.odontograma)) changes.odontograma = payload.odontograma;

      const before = mapEvolucionRow({ ...existing });
      await this.applyChanges(client, existing, changes, actor);

      const notaTexto = payload.notaEvolucion;
      if (nonEmpty(notaTexto)) {
        await this.insertNote(client, idEvolucion, actor, 'EVOLUCION', notaTexto, payload.procedimientoRealizado);
      }

      const after = await this.loadById(client, idEvolucion);
      return { ...after, valorAnterior: before, valorNuevo: after };
    });
  }

  /** RF-HCL-006/009: corrección posterior al cierre como "Nota aclaratoria". */
  async addClarificationNote(idEvolucion: number, texto: string, actor: ClinicalWriteActor): Promise<NotaEvolucionRow> {
    if (!nonEmpty(texto)) throw new ClinicalDomainError('El texto de la nota aclaratoria es obligatorio.', 'BAD_REQUEST');
    return db.withTransaction(async (client) => {
      const existing = await this.findForUpdate(client, 'e.id_evolucion = $1', idEvolucion);
      if (!existing) throw new ClinicalDomainError('Registro de evolución no encontrado.', 'NOT_FOUND');
      const nota = await this.insertNote(client, idEvolucion, actor, 'NOTA_ACLARATORIA', texto, null);
      if (!nota) throw new ClinicalDomainError('La nota aclaratoria ya fue registrada.', 'BAD_REQUEST');
      return nota;
    });
  }

  // RF-HCL-008: historial del paciente, de la más reciente a la más antigua
  async getClinicalHistoryByPatient(idPaciente: number): Promise<ClinicalHistoryRow[]> {
    const hc = await db.query<{ id_historia: number; fecha_creacion: string }>(
      `SELECT id_historia, fecha_creacion FROM public.historia_clinica WHERE id_paciente = $1;`,
      [idPaciente]
    );
    if (hc.rows.length === 0) return [];
    const { rows } = await db.query(
      `SELECT ${EVOLUTION_SELECT} ${EVOLUTION_FROM}
        WHERE e.id_historia = $1
        ORDER BY e.fecha DESC;`,
      [hc.rows[0].id_historia]
    );

    if (rows.length === 0) {
      return [
        {
          idHistoria: hc.rows[0].id_historia,
          idPaciente,
          fechaAperturaExpediente: hc.rows[0].fecha_creacion,
          idEvolucion: null,
          fechaRegistro: null,
          idCita: null,
          estadoCita: null,
          profesionalResponsable: null,
          evolucion: null,
        },
      ];
    }

    return rows.map((r: any) => {
      const evo = mapEvolucionRow(r);
      return {
        idHistoria: evo.idHistoria,
        idPaciente,
        fechaAperturaExpediente: hc.rows[0].fecha_creacion,
        idEvolucion: evo.idEvolucion,
        fechaRegistro: evo.fecha,
        idCita: evo.idCita,
        estadoCita: r.estado_cita,
        profesionalResponsable: r.profesional_responsable,
        profesionalFirma: r.profesional_firma,
        motivoConsulta: evo.motivoConsulta,
        enfermedadActual: evo.enfermedadActual,
        antecedentesClinicos: evo.antecedentesClinicos,
        habitosHigiene: evo.habitosHigiene,
        examenEstomatognatico: evo.examenEstomatognatico,
        examenFisicoObservaciones: evo.examenFisicoObservaciones,
        odontograma: evo.odontograma,
        procedimientoRealizado: evo.procedimientoRealizado,
        diagnosticoGenerado: evo.diagnosticoGenerado,
        accionesARealizar: evo.accionesARealizar,
        hallazgosObservaciones: evo.hallazgosObservaciones,
        planManejo: evo.planManejo,
        evolucion: evo.evolucion,
        notas: evo.notas,
      } as ClinicalHistoryRow;
    });
  }

  // Registro de la consulta de una cita (uq_evolucion_cita)
  async findEvolutionByCitaId(idCita: number): Promise<EvolutionRecordRow | null> {
    const { rows } = await db.query(`SELECT ${EVOLUTION_SELECT} ${EVOLUTION_FROM} WHERE e.id_cita = $1;`, [idCita]);
    return rows[0] ? mapEvolucionRow(rows[0]) : null;
  }

  // RF-HCL-008: las inasistencias aparecen en el historial (no crean historia clínica)
  async getNoShowsByPatient(idPaciente: number) {
    const { rows } = await db.query<{
      idCita: number;
      fechaHora: string;
      profesionalResponsable: string;
      observacion: string | null;
    }>(
      `SELECT c.id_cita AS "idCita",
              to_char(MIN(bc.id_bloque), 'YYYY-MM-DD"T"HH24:MI:SS') AS "fechaHora",
              u.nombre_completo AS "profesionalResponsable",
              (SELECT h.motivo FROM public.historial_cita h WHERE h.id_cita = c.id_cita
                ORDER BY h.id_cambio_cita DESC LIMIT 1) AS observacion
         FROM public.cita c
         JOIN public.usuario u ON u.id_usuario = c.id_usuario
         LEFT JOIN public.bloques_citas bc ON bc.id_cita = c.id_cita
        WHERE c.id_paciente = $1 AND c.estado = 'Inasistencia'
        GROUP BY c.id_cita, u.nombre_completo;`,
      [idPaciente]
    );
    return rows.map((r) => ({ ...r, observacion: r.observacion ?? undefined }));
  }
}
