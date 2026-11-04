import { db } from '../../../shared/infrastructure/database/database';
import {
  ClinicalHistoryRow,
  EvolutionRecordRow,
  IClinicalRecordRepository,
} from '../domain/clinical-record.repository.interface';
import {
  ClinicalEvolutionPayload,
  CreateEvolutionEntryDTO,
} from './clinical-record.model';
import {
  createDefaultAntecedentesClinicos,
  createDefaultHabitosHigiene,
  createDefaultExamenEstomatognatico,
  createInitialOdontograma,
  createDefaultPlanManejo,
} from '../../../schemas';

function isNonEmptyObject(val: unknown): boolean {
  return Boolean(val && typeof val === 'object' && Object.keys(val).length > 0);
}

function mapEvolucionRowToEntity(row: any, fallbackDiligenciadoPor?: any): EvolutionRecordRow {
  const motivoConsulta =
    row.motivo_consulta ?? row.motivoConsulta ?? 'Consulta Odontológica';
  const enfermedadActual =
    row.enfermedad_actual ?? row.enfermedadActual ?? null;
  const rawAntecedentes = row.antecedentes_clinicos ?? row.antecedentesClinicos;
  const antecedentesClinicos = isNonEmptyObject(rawAntecedentes)
    ? rawAntecedentes
    : createDefaultAntecedentesClinicos();
  const rawHabitos = row.habitos_higiene ?? row.habitosHigiene;
  const habitosHigiene = isNonEmptyObject(rawHabitos)
    ? rawHabitos
    : createDefaultHabitosHigiene();
  const rawExamen = row.examen_estomatognatico ?? row.examenEstomatognatico;
  const examenEstomatognatico = isNonEmptyObject(rawExamen)
    ? rawExamen
    : createDefaultExamenEstomatognatico();
  const examenFisicoObservaciones =
    row.examen_fisico_observaciones ?? row.examenFisicoObservaciones ?? null;
  const rawOdontograma = row.odontograma;
  const odontograma = isNonEmptyObject(rawOdontograma)
    ? rawOdontograma
    : createInitialOdontograma();
  const procedimientoRealizado =
    row.procedimiento_realizado ?? row.procedimientoRealizado ?? null;
  const diagnosticoGenerado =
    row.diagnostico_generado ?? row.diagnosticoGenerado ?? null;
  const accionesARealizar =
    row.acciones_a_realizar ?? row.accionesARealizar ?? null;
  const hallazgosObservaciones =
    row.hallazgos_observaciones ?? row.hallazgosObservaciones ?? null;
  const rawPlan = row.plan_manejo ?? row.planManejo;
  const planManejo = isNonEmptyObject(rawPlan)
    ? rawPlan
    : createDefaultPlanManejo();

  const diligenciadoPor = fallbackDiligenciadoPor ?? {
    idUsuario: Number(row.id_usuario ?? row.idUsuario ?? 1),
    nombreUsuario: String(
      row.profesionalResponsable ?? row.profesional_responsable ?? 'Personal Clínico'
    ),
    idProfesionalResponsable: Number(row.id_usuario ?? row.idUsuario ?? 1),
    firmaBase64: row.profesionalFirma ?? row.firma_base64 ?? null,
    fechaHoraISO: row.fecha ? new Date(row.fecha).toISOString() : new Date().toISOString(),
  };

  const sintetizadaEvolucion: ClinicalEvolutionPayload = {
    tipoRegistro: 'EVOLUCION_ODONTOGRAMA',
    motivoConsulta,
    enfermedadActual: enfermedadActual ?? undefined,
    antecedentes: antecedentesClinicos,
    antecedentesClinicos,
    habitosHigiene,
    examenEstomatognatico,
    examenFisicoObservaciones: examenFisicoObservaciones ?? undefined,
    odontograma,
    procedimientoRealizado: procedimientoRealizado ?? undefined,
    notaEvolucion: procedimientoRealizado ?? hallazgosObservaciones ?? motivoConsulta,
    diagnostico: diagnosticoGenerado ?? undefined,
    diagnosticoGenerado: diagnosticoGenerado ?? undefined,
    accionesARealizar: accionesARealizar ?? undefined,
    observaciones: hallazgosObservaciones ?? undefined,
    hallazgosObservaciones: hallazgosObservaciones ?? undefined,
    planManejo,
    diligenciadoPor,
  };

  return {
    idEvolucion: Number(row.id_evolucion ?? row.idEvolucion),
    idHistoria: Number(row.id_historia ?? row.idHistoria),
    fecha: row.fecha,
    idCita: Number(row.id_cita ?? row.idCita),
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
    evolucion: sintetizadaEvolucion,
    diligenciadoPor,
  };
}

export class ClinicalRecordRepository implements IClinicalRecordRepository {
  // RF-HCL-005, RF-HCL-007, RF-HCL-009: Registrar o actualizar entrada clínica en tabla evolucion
  async createEvolutionEntry(dto: CreateEvolutionEntryDTO): Promise<EvolutionRecordRow> {
    const hcRes = await db.query<{ id_historia: number }>(
      `SELECT id_historia FROM public.historia_clinica WHERE id_paciente = $1;`,
      [dto.idPaciente]
    );

    let idHistoria: number;
    if (hcRes.rows.length === 0) {
      // Auto-crear expediente clínico base si aún no existe (RF-HCL-001)
      const newHc = await db.query<{ id_historia: number }>(
        `INSERT INTO public.historia_clinica (id_paciente) VALUES ($1) RETURNING id_historia;`,
        [dto.idPaciente]
      );
      idHistoria = newHc.rows[0].id_historia;
    } else {
      idHistoria = hcRes.rows[0].id_historia;
    }

    const hasExplicitMotivo = Boolean(
      (dto.motivoConsulta && dto.motivoConsulta !== 'Consulta Odontológica' && dto.motivoConsulta !== 'Plan de Manejo y Conducta') ||
      (dto.payload?.motivoConsulta && dto.payload?.motivoConsulta !== 'Consulta Odontológica' && dto.payload?.motivoConsulta !== 'Plan de Manejo y Conducta')
    );

    const motivoConsulta =
      dto.motivoConsulta ??
      dto.payload?.motivoConsulta ??
      'Consulta Odontológica';

    const enfermedadActual =
      dto.enfermedadActual ??
      dto.payload?.enfermedadActual ??
      'N/A';

    const hasExplicitAntecedentes = Boolean(
      isNonEmptyObject(dto.antecedentesClinicos) ||
      isNonEmptyObject(dto.payload?.antecedentesClinicos) ||
      isNonEmptyObject(dto.payload?.antecedentes)
    );

    const rawAntecedentes =
      dto.antecedentesClinicos ??
      dto.payload?.antecedentesClinicos ??
      dto.payload?.antecedentes;
    const antecedentesClinicos = isNonEmptyObject(rawAntecedentes)
      ? rawAntecedentes
      : createDefaultAntecedentesClinicos();

    const rawHabitos =
      dto.habitosHigiene ?? dto.payload?.habitosHigiene;
    const habitosHigiene = isNonEmptyObject(rawHabitos)
      ? rawHabitos
      : createDefaultHabitosHigiene();

    const rawExamen =
      dto.examenEstomatognatico ?? dto.payload?.examenEstomatognatico;
    const examenEstomatognatico = isNonEmptyObject(rawExamen)
      ? rawExamen
      : createDefaultExamenEstomatognatico();

    const examenFisicoObservaciones =
      dto.examenFisicoObservaciones ??
      dto.payload?.examenFisicoObservaciones ??
      null;

    const rawOdontograma =
      dto.odontograma ?? dto.payload?.odontograma;
    const odontograma = isNonEmptyObject(rawOdontograma)
      ? rawOdontograma
      : createInitialOdontograma();

    const procedimientoRealizado =
      dto.procedimientoRealizado ??
      dto.payload?.procedimientoRealizado ??
      dto.payload?.notaEvolucion ??
      null;

    const diagnosticoGenerado =
      dto.diagnosticoGenerado ??
      dto.payload?.diagnosticoGenerado ??
      dto.payload?.diagnostico ??
      null;

    const accionesARealizar =
      dto.accionesARealizar ??
      dto.payload?.accionesARealizar ??
      null;

    const hallazgosObservaciones =
      dto.hallazgosObservaciones ??
      dto.payload?.hallazgosObservaciones ??
      dto.payload?.observaciones ??
      null;

    const rawPlan =
      dto.planManejo ?? dto.payload?.planManejo;
    const planManejo = isNonEmptyObject(rawPlan)
      ? rawPlan
      : createDefaultPlanManejo();

    const sql = `
      INSERT INTO public.evolucion (
        id_historia,
        id_cita,
        motivo_consulta,
        enfermedad_actual,
        antecedentes_clinicos,
        habitos_higiene,
        examen_estomatognatico,
        examen_fisico_observaciones,
        odontograma,
        procedimiento_realizado,
        diagnostico_generado,
        acciones_a_realizar,
        hallazgos_observaciones,
        plan_manejo,
        fecha
      )
      VALUES (
        $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9::jsonb, $10, $11, $12, $13, $14::jsonb, COALESCE($15, CURRENT_TIMESTAMP)
      )
      ON CONFLICT (id_cita) DO UPDATE SET
        -- D-24 & D-28: Si la fila existente tiene motivo de apertura y la nueva entrada no especifica uno explícito, preservar el original
        motivo_consulta = CASE 
          WHEN public.evolucion.motivo_consulta = 'Plan de Manejo y Conducta' THEN EXCLUDED.motivo_consulta
          WHEN public.evolucion.motivo_consulta IS NOT NULL AND public.evolucion.motivo_consulta <> '' AND $16 = false THEN public.evolucion.motivo_consulta
          ELSE EXCLUDED.motivo_consulta
        END,
        enfermedad_actual = CASE WHEN EXCLUDED.enfermedad_actual IS NOT NULL AND EXCLUDED.enfermedad_actual <> 'N/A' THEN EXCLUDED.enfermedad_actual ELSE public.evolucion.enfermedad_actual END,
        -- D-28: No sobrescribir antecedentes previos con defaults si la nueva entrada no los envía explícitamente
        antecedentes_clinicos = CASE 
          WHEN public.evolucion.antecedentes_clinicos IS NOT NULL AND public.evolucion.antecedentes_clinicos <> '{}'::jsonb AND $17 = false THEN public.evolucion.antecedentes_clinicos
          WHEN EXCLUDED.antecedentes_clinicos <> '{}'::jsonb THEN EXCLUDED.antecedentes_clinicos 
          ELSE public.evolucion.antecedentes_clinicos 
        END,
        habitos_higiene = CASE WHEN EXCLUDED.habitos_higiene <> '{}'::jsonb THEN EXCLUDED.habitos_higiene ELSE public.evolucion.habitos_higiene END,
        examen_estomatognatico = CASE WHEN EXCLUDED.examen_estomatognatico <> '{}'::jsonb THEN EXCLUDED.examen_estomatognatico ELSE public.evolucion.examen_estomatognatico END,
        examen_fisico_observaciones = COALESCE(EXCLUDED.examen_fisico_observaciones, public.evolucion.examen_fisico_observaciones),
        odontograma = CASE WHEN EXCLUDED.odontograma <> '{}'::jsonb THEN EXCLUDED.odontograma ELSE public.evolucion.odontograma END,
        procedimiento_realizado = COALESCE(EXCLUDED.procedimiento_realizado, public.evolucion.procedimiento_realizado),
        diagnostico_generado = COALESCE(EXCLUDED.diagnostico_generado, public.evolucion.diagnostico_generado),
        acciones_a_realizar = COALESCE(EXCLUDED.acciones_a_realizar, public.evolucion.acciones_a_realizar),
        hallazgos_observaciones = COALESCE(EXCLUDED.hallazgos_observaciones, public.evolucion.hallazgos_observaciones),
        plan_manejo = CASE WHEN EXCLUDED.plan_manejo <> '{}'::jsonb THEN public.evolucion.plan_manejo || EXCLUDED.plan_manejo ELSE public.evolucion.plan_manejo END
      RETURNING *;
    `;

    const { rows } = await db.query(sql, [
      idHistoria,
      dto.idCita,
      motivoConsulta,
      enfermedadActual,
      JSON.stringify(antecedentesClinicos),
      JSON.stringify(habitosHigiene),
      JSON.stringify(examenEstomatognatico),
      examenFisicoObservaciones,
      JSON.stringify(odontograma),
      procedimientoRealizado,
      diagnosticoGenerado,
      accionesARealizar,
      hallazgosObservaciones,
      JSON.stringify(planManejo),
      dto.fecha ?? null,
      hasExplicitMotivo,
      hasExplicitAntecedentes,
    ]);

    return mapEvolucionRowToEntity(rows[0], dto.payload?.diligenciadoPor);
  }

  // RF-HCL-006 & RQNF-FUN-001: Editar registro clínico solo hasta las 23:59 del mismo día en Colombia
  async updateEvolutionEntrySameDay(
    idEvolucion: number,
    nuevoPayload: ClinicalEvolutionPayload | Partial<EvolutionRecordRow>
  ): Promise<EvolutionRecordRow> {
    const checkSql = `
      SELECT 
        id_evolucion,
        id_historia,
        id_cita,
        fecha,
        motivo_consulta,
        enfermedad_actual,
        antecedentes_clinicos,
        habitos_higiene,
        examen_estomatognatico,
        examen_fisico_observaciones,
        odontograma,
        procedimiento_realizado,
        diagnostico_generado,
        acciones_a_realizar,
        hallazgos_observaciones,
        plan_manejo,
        ((fecha AT TIME ZONE 'America/Bogota')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date) AS "esMismoDia"
      FROM public.evolucion
      WHERE id_evolucion = $1;
    `;
    const { rows } = await db.query(checkSql, [idEvolucion]);
    if (rows.length === 0) {
      throw new Error('Registro de evolución no encontrado.');
    }

    if (!rows[0].esMismoDia) {
      throw new Error('La historia clínica solo se puede editar el día en que fue creada');
    }

    const previousRow = rows[0];
    const valorAnterior = {
      motivoConsulta: previousRow.motivo_consulta,
      enfermedadActual: previousRow.enfermedad_actual,
      antecedentesClinicos: previousRow.antecedentes_clinicos,
      habitosHigiene: previousRow.habitos_higiene,
      examenEstomatognatico: previousRow.examen_estomatognatico,
      examenFisicoObservaciones: previousRow.examen_fisico_observaciones,
      odontograma: previousRow.odontograma,
      procedimientoRealizado: previousRow.procedimiento_realizado,
      diagnosticoGenerado: previousRow.diagnostico_generado,
      accionesARealizar: previousRow.acciones_a_realizar,
      hallazgosObservaciones: previousRow.hallazgos_observaciones,
      planManejo: previousRow.plan_manejo,
    };

    const payload = nuevoPayload as any;
    const motivoConsulta = payload.motivoConsulta ?? null;
    const enfermedadActual = payload.enfermedadActual ?? null;
    const antecedentesClinicos =
      payload.antecedentesClinicos ?? payload.antecedentes ?? null;
    const habitosHigiene = payload.habitosHigiene ?? null;
    const examenEstomatognatico = payload.examenEstomatognatico ?? null;
    const examenFisicoObservaciones = payload.examenFisicoObservaciones ?? null;
    const odontograma = payload.odontograma ?? null;
    const procedimientoRealizado =
      payload.procedimientoRealizado ?? payload.notaEvolucion ?? null;
    const diagnosticoGenerado =
      payload.diagnosticoGenerado ?? payload.diagnostico ?? null;
    const accionesARealizar = payload.accionesARealizar ?? null;
    const hallazgosObservaciones =
      payload.hallazgosObservaciones ?? payload.observaciones ?? null;
    const planManejo = payload.planManejo ?? null;

    const updateSql = `
      UPDATE public.evolucion
      SET 
        motivo_consulta = COALESCE($1, motivo_consulta),
        enfermedad_actual = COALESCE($2, enfermedad_actual),
        antecedentes_clinicos = CASE WHEN $3::text IS NOT NULL THEN $3::jsonb ELSE antecedentes_clinicos END,
        habitos_higiene = CASE WHEN $4::text IS NOT NULL THEN $4::jsonb ELSE habitos_higiene END,
        examen_estomatognatico = CASE WHEN $5::text IS NOT NULL THEN $5::jsonb ELSE examen_estomatognatico END,
        examen_fisico_observaciones = COALESCE($6, examen_fisico_observaciones),
        odontograma = CASE WHEN $7::text IS NOT NULL THEN $7::jsonb ELSE odontograma END,
        procedimiento_realizado = COALESCE($8, procedimiento_realizado),
        diagnostico_generado = COALESCE($9, diagnostico_generado),
        acciones_a_realizar = COALESCE($10, acciones_a_realizar),
        hallazgos_observaciones = COALESCE($11, hallazgos_observaciones),
        plan_manejo = CASE WHEN $12::text IS NOT NULL THEN plan_manejo || $12::jsonb ELSE plan_manejo END
      WHERE id_evolucion = $13
      RETURNING *;
    `;

    const updated = await db.query(updateSql, [
      motivoConsulta,
      enfermedadActual,
      antecedentesClinicos ? JSON.stringify(antecedentesClinicos) : null,
      habitosHigiene ? JSON.stringify(habitosHigiene) : null,
      examenEstomatognatico ? JSON.stringify(examenEstomatognatico) : null,
      examenFisicoObservaciones,
      odontograma ? JSON.stringify(odontograma) : null,
      procedimientoRealizado,
      diagnosticoGenerado,
      accionesARealizar,
      hallazgosObservaciones,
      planManejo ? JSON.stringify(planManejo) : null,
      idEvolucion,
    ]);

    const updatedRow = updated.rows[0];
    const valorNuevo = {
      motivoConsulta: updatedRow.motivo_consulta,
      enfermedadActual: updatedRow.enfermedad_actual,
      antecedentesClinicos: updatedRow.antecedentes_clinicos,
      habitosHigiene: updatedRow.habitos_higiene,
      examenEstomatognatico: updatedRow.examen_estomatognatico,
      examenFisicoObservaciones: updatedRow.examen_fisico_observaciones,
      odontograma: updatedRow.odontograma,
      procedimientoRealizado: updatedRow.procedimiento_realizado,
      diagnosticoGenerado: updatedRow.diagnostico_generado,
      accionesARealizar: updatedRow.acciones_a_realizar,
      hallazgosObservaciones: updatedRow.hallazgos_observaciones,
      planManejo: updatedRow.plan_manejo,
    };

    // Intentar registrar en auditoria_historia_clinica (no fallar si tabla aún no creada en BD)
    try {
      await db.query(
        `INSERT INTO public.auditoria_historia_clinica (
          id_evolucion, id_usuario_modificador, campo_modificado, valor_anterior, valor_nuevo, fecha_modificacion
        ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, CURRENT_TIMESTAMP)`,
        [
          idEvolucion,
          payload.diligenciadoPor?.idUsuario ?? 1,
          'evolucion_completa',
          JSON.stringify(valorAnterior),
          JSON.stringify(valorNuevo),
        ]
      );
    } catch {
      // Operación resiliente: no falla la actualización clínica principal
    }

    const entity = mapEvolucionRowToEntity(updatedRow, payload.diligenciadoPor);
    return {
      ...entity,
      valorAnterior,
      valorNuevo,
    };
  }

  // RF-HCL-008: Consultar historial clínico completo de un paciente (orden cronológico inverso por fecha)
  // Aprovecha el índice compuesto idx_evolucion_historia_fecha (id_historia asc, fecha desc)
  async getClinicalHistoryByPatient(idPaciente: number): Promise<ClinicalHistoryRow[]> {
    const sql = `
      SELECT 
        hc.id_historia AS "idHistoria",
        hc.id_paciente AS "idPaciente",
        hc.fecha_creacion AS "fechaAperturaExpediente",
        e.id_evolucion AS "idEvolucion",
        e.fecha AS "fechaRegistro",
        e.id_cita AS "idCita",
        c.estado AS "estadoCita",
        u.nombre_completo AS "profesionalResponsable",
        u.id_usuario AS "idUsuario",
        u.firma_base64 AS "profesionalFirma",
        e.motivo_consulta AS "motivoConsulta",
        e.enfermedad_actual AS "enfermedadActual",
        e.antecedentes_clinicos AS "antecedentesClinicos",
        e.habitos_higiene AS "habitosHigiene",
        e.examen_estomatognatico AS "examenEstomatognatico",
        e.examen_fisico_observaciones AS "examenFisicoObservaciones",
        e.odontograma,
        e.procedimiento_realizado AS "procedimientoRealizado",
        e.diagnostico_generado AS "diagnosticoGenerado",
        e.acciones_a_realizar AS "accionesARealizar",
        e.hallazgos_observaciones AS "hallazgosObservaciones",
        e.plan_manejo AS "planManejo"
      FROM public.historia_clinica hc
      LEFT JOIN public.evolucion e ON hc.id_historia = e.id_historia
      LEFT JOIN public.cita c ON e.id_cita = c.id_cita
      LEFT JOIN public.usuario u ON c.id_usuario = u.id_usuario
      WHERE hc.id_paciente = $1
      ORDER BY e.fecha DESC NULLS LAST;
    `;
    const { rows } = await db.query(sql, [idPaciente]);
    return rows.map((r: any) => {
      const evoEntity = r.idEvolucion ? mapEvolucionRowToEntity(r) : null;
      return {
        idHistoria: Number(r.idHistoria),
        idPaciente: Number(r.idPaciente),
        fechaAperturaExpediente: r.fechaAperturaExpediente,
        idEvolucion: r.idEvolucion ? Number(r.idEvolucion) : null,
        fechaRegistro: r.fechaRegistro,
        idCita: r.idCita ? Number(r.idCita) : null,
        estadoCita: r.estadoCita,
        profesionalResponsable: r.profesionalResponsable,
        profesionalFirma: r.profesionalFirma,
        motivoConsulta: r.motivoConsulta,
        enfermedadActual: r.enfermedadActual,
        antecedentesClinicos: r.antecedentesClinicos,
        habitosHigiene: r.habitosHigiene,
        examenEstomatognatico: r.examenEstomatognatico,
        examenFisicoObservaciones: r.examenFisicoObservaciones,
        odontograma: r.odontograma,
        procedimientoRealizado: r.procedimientoRealizado,
        diagnosticoGenerado: r.diagnosticoGenerado,
        accionesARealizar: r.accionesARealizar,
        hallazgosObservaciones: r.hallazgosObservaciones,
        planManejo: r.planManejo,
        evolucion: evoEntity ? evoEntity.evolucion : null,
      };
    });
  }

  // Buscar última evolución registrada para una cita específica (utiliza uq_evolucion_cita)
  async findEvolutionByCitaId(idCita: number): Promise<EvolutionRecordRow | null> {
    const sql = `
      SELECT 
        e.id_evolucion AS "idEvolucion", 
        e.id_historia AS "idHistoria", 
        e.fecha, 
        e.id_cita AS "idCita", 
        e.motivo_consulta AS "motivoConsulta",
        e.enfermedad_actual AS "enfermedadActual",
        e.antecedentes_clinicos AS "antecedentesClinicos",
        e.habitos_higiene AS "habitosHigiene",
        e.examen_estomatognatico AS "examenEstomatognatico",
        e.examen_fisico_observaciones AS "examenFisicoObservaciones",
        e.odontograma,
        e.procedimiento_realizado AS "procedimientoRealizado",
        e.diagnostico_generado AS "diagnosticoGenerado",
        e.acciones_a_realizar AS "accionesARealizar",
        e.hallazgos_observaciones AS "hallazgosObservaciones",
        e.plan_manejo AS "planManejo",
        c.estado AS "estadoCita",
        u.nombre_completo AS "profesionalResponsable",
        u.id_usuario AS "idUsuario",
        u.firma_base64 AS "profesionalFirma"
      FROM public.evolucion e
      LEFT JOIN public.cita c ON e.id_cita = c.id_cita
      LEFT JOIN public.usuario u ON c.id_usuario = u.id_usuario
      WHERE e.id_cita = $1
      ORDER BY e.fecha DESC
      LIMIT 1;
    `;
    const { rows } = await db.query(sql, [idCita]);
    return rows[0] ? mapEvolucionRowToEntity(rows[0]) : null;
  }
}
