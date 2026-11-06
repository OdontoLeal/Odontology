import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  ActorContext,
  ClinicalDomainError,
  ClinicalRecordEntity,
} from '../domain/clinical-record.entity';
import { OdontogramEntity } from '../domain/odontogram.entity';
import {
  ClinicalHistoryRow,
  EvolutionRecordRow,
  IClinicalRecordRepository,
} from '../domain/clinical-record.repository.interface';
import {
  ClinicalEvolutionPayload,
  ClinicalWriteActor,
  CreateEvolutionEntryDTO,
  NotaEvolucionRow,
  OdontogramDataDTO,
} from '../infrastructure/clinical-record.model';
import { CreateClinicalRecordUseCase } from '../application/create-clinical-record.use-case';
import { ManageOdontogramUseCase } from '../application/manage-odontogram.use-case';
import { GetClinicalHistoryUseCase } from '../application/get-clinical-history.use-case';
import { ClinicalAccessPolicy } from '../application/clinical-access.policy';
import { ClinicalRecordsModulePublicApi } from '../index';
import { ClinicalCatalogsRepository } from '../infrastructure/catalogs.repository';

// Repositorio en memoria para pruebas
class InMemoryClinicalRecordRepository implements IClinicalRecordRepository {
  public evoluciones: Map<number, EvolutionRecordRow> = new Map();
  public historiaIdSeq = 100;
  public evolucionIdSeq = 1;
  public pacienteHistoriaMap: Map<number, number> = new Map();
  /** Estado de cada cita (por defecto En consulta). */
  public citaEstado: Map<number, string> = new Map();
  public notas: Map<number, NotaEvolucionRow[]> = new Map();

  async createEvolutionEntry(dto: CreateEvolutionEntryDTO): Promise<EvolutionRecordRow> {
    if (!this.pacienteHistoriaMap.has(dto.idPaciente)) {
      this.pacienteHistoriaMap.set(dto.idPaciente, this.historiaIdSeq++);
    }
    const idHistoria = this.pacienteHistoriaMap.get(dto.idPaciente)!;
    const idEvolucion = this.evolucionIdSeq++;

    const motivoConsulta =
      dto.motivoConsulta ?? dto.payload?.motivoConsulta ?? 'Consulta Odontológica';
    const enfermedadActual =
      dto.enfermedadActual ?? dto.payload?.enfermedadActual ?? 'N/A';
    const antecedentesClinicos =
      dto.antecedentesClinicos ?? dto.payload?.antecedentesClinicos ?? dto.payload?.antecedentes ?? {};
    const habitosHigiene =
      dto.habitosHigiene ?? dto.payload?.habitosHigiene ?? {};
    const examenEstomatognatico =
      dto.examenEstomatognatico ?? dto.payload?.examenEstomatognatico ?? {};
    const examenFisicoObservaciones =
      dto.examenFisicoObservaciones ?? dto.payload?.examenFisicoObservaciones ?? null;
    const odontograma =
      dto.odontograma ?? dto.payload?.odontograma ?? null;
    const procedimientoRealizado =
      dto.procedimientoRealizado ?? dto.payload?.procedimientoRealizado ?? dto.payload?.notaEvolucion ?? null;
    const diagnosticoGenerado =
      dto.diagnosticoGenerado ?? dto.payload?.diagnosticoGenerado ?? dto.payload?.diagnostico ?? null;
    const accionesARealizar =
      dto.accionesARealizar ?? dto.payload?.accionesARealizar ?? null;
    const hallazgosObservaciones =
      dto.hallazgosObservaciones ?? dto.payload?.hallazgosObservaciones ?? dto.payload?.observaciones ?? null;
    const planManejo =
      dto.planManejo ?? dto.payload?.planManejo ?? {};

    const payload = dto.payload ? structuredClone(dto.payload) : {
      tipoRegistro: 'EVOLUCION_ODONTOGRAMA',
      motivoConsulta,
      enfermedadActual,
      antecedentes: antecedentesClinicos,
      odontograma,
      procedimientoRealizado,
      diagnostico: diagnosticoGenerado,
      observaciones: hallazgosObservaciones,
      diligenciadoPor: {
        idUsuario: 1,
        nombreUsuario: 'Dr. Eduar Leal Álvarez',
        idProfesionalResponsable: 1,
        fechaHoraISO: new Date().toISOString(),
      },
    };

    const row: EvolutionRecordRow = {
      idEvolucion,
      idHistoria,
      fecha: new Date(),
      idCita: dto.idCita,
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
      evolucion: payload as any,
    };
    this.evoluciones.set(idEvolucion, row);
    return row;
  }

  async updateEvolutionEntry(
    idEvolucion: number,
    nuevoPayload: ClinicalEvolutionPayload | Partial<EvolutionRecordRow>,
    actor?: ClinicalWriteActor
  ): Promise<EvolutionRecordRow> {
    const existing = this.evoluciones.get(idEvolucion);
    if (!existing) throw new Error('Registro de evolución no encontrado.');
    // RF-HCL-006 (v1.3): solo mientras la cita está En consulta
    if ((this.citaEstado.get(existing.idCita) ?? 'En consulta') !== 'En consulta') {
      throw new ClinicalDomainError('La historia clínica de una consulta finalizada es de solo lectura.', 'FORBIDDEN');
    }
    const p = nuevoPayload as any;
    if (actor?.esProfesionalResponsable !== false && p.motivoConsulta) existing.motivoConsulta = p.motivoConsulta;
    if (p.odontograma) existing.odontograma = p.odontograma;
    existing.evolucion = { ...existing.evolucion, ...structuredClone(p) };
    return existing;
  }

  async addClarificationNote(idEvolucion: number, texto: string, actor: ClinicalWriteActor): Promise<NotaEvolucionRow> {
    const nota: NotaEvolucionRow = {
      idNota: Date.now(),
      tipo: 'NOTA_ACLARATORIA',
      procedimientoRealizado: null,
      texto,
      fecha: new Date().toISOString(),
      diligenciadoPor: { idUsuario: actor.idUsuario, nombreUsuario: actor.nombreUsuario },
    };
    this.notas.set(idEvolucion, [...(this.notas.get(idEvolucion) ?? []), nota]);
    return nota;
  }

  async getClinicalHistoryByPatient(idPaciente: number): Promise<ClinicalHistoryRow[]> {
    const idHistoria = this.pacienteHistoriaMap.get(idPaciente);
    if (!idHistoria) {
      return [];
    }

    const rows: ClinicalHistoryRow[] = [];
    for (const evo of this.evoluciones.values()) {
      if (evo.idHistoria === idHistoria) {
        rows.push({
          idHistoria: evo.idHistoria,
          idPaciente,
          fechaAperturaExpediente: new Date(),
          idEvolucion: evo.idEvolucion,
          fechaRegistro: evo.fecha,
          idCita: evo.idCita,
          estadoCita: 'Atendida',
          profesionalResponsable: 'Dr. Eduar Leal Álvarez',
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
          notas: this.notas.get(evo.idEvolucion) ?? [],
        });
      }
    }

    return rows.sort((a, b) => {
      const timeA = a.fechaRegistro ? new Date(a.fechaRegistro).getTime() : 0;
      const timeB = b.fechaRegistro ? new Date(b.fechaRegistro).getTime() : 0;
      return timeB - timeA;
    });
  }

  async findEvolutionByCitaId(idCita: number): Promise<EvolutionRecordRow | null> {
    for (const evo of this.evoluciones.values()) {
      if (evo.idCita === idCita) {
        return evo;
      }
    }
    return null;
  }
}

describe('MÓDULO C (Parte 2): Historia Clínica, Odontograma y Evolución (RF-HCL-005 a RF-HCL-009)', () => {
  let repo: InMemoryClinicalRecordRepository;
  let odontogramaJsonSample: OdontogramDataDTO;

  const DR_LEAL: ActorContext = {
    idUsuario: 10,
    nombreUsuario: 'Dr. Eduar Leal Álvarez',
    roles: ['ROL-ODO', 'ROL-ADM'],
  };

  const DRA_DIAZ: ActorContext = {
    idUsuario: 20,
    nombreUsuario: 'Dra. Natalia Díaz',
    roles: ['ROL-ESP'],
  };

  const AUX_MILENA: ActorContext = {
    idUsuario: 30,
    nombreUsuario: 'Milena Torres',
    roles: ['ROL-AUX'],
  };

  const COA_DANIELA: ActorContext = {
    idUsuario: 40,
    nombreUsuario: 'Daniela Guerrero',
    roles: ['ROL-COA'],
  };

  beforeEach(() => {
    repo = new InMemoryClinicalRecordRepository();

    // Cargar muestra de odontograma.json portable
    const localAsset = path.resolve(__dirname, '../../../schemas/assets/odontograma.json');
    const jsonPath = fs.existsSync(localAsset) ? localAsset : path.resolve('d:/Descargas/odontograma.json');
    const rawJson = fs.readFileSync(jsonPath, 'utf-8');
    odontogramaJsonSample = JSON.parse(rawJson);
  });

  it('Validar e instanciar el JSON del odontograma oficial (odontograma.json)', () => {
    assert.ok(odontogramaJsonSample.cuadrantes);
    assert.ok(odontogramaJsonSample.cuadrantes.cuadrante_1);
    assert.ok(odontogramaJsonSample.cuadrantes.cuadrante_2);
    assert.ok(odontogramaJsonSample.cuadrantes.cuadrante_3);
    assert.ok(odontogramaJsonSample.cuadrantes.cuadrante_4);

    // Cargar entidad desde el JSON suministrado
    const entity = OdontogramEntity.fromPreviousOdontogram({
      previousOdontogram: odontogramaJsonSample,
    });

    const snapshot = entity.getSnapshot();
    assert.strictEqual(snapshot.cuadrantes.cuadrante_1.id_cuadrante, 1);

    // Verificar hallazgo en pieza 16 (caries_activa en oclusal_incisal con nota clínica)
    const pieza16 = snapshot.cuadrantes.cuadrante_1.piezas['16'];
    assert.ok(pieza16);
    assert.strictEqual(pieza16.caras.oclusal_incisal.caries_activa, true);
    assert.strictEqual(pieza16.caras.vestibular.caries_activa, false);
    assert.strictEqual(pieza16.nota_clinica?.zona_afectada, 'Cara Oclusal');

    // Verificar puente en piezas 47, 46, 45
    const pieza47 = snapshot.cuadrantes.cuadrante_4.piezas['47'];
    assert.strictEqual(pieza47.simbolos_tecnicos.puente, true);
    assert.deepStrictEqual(pieza47.relacion_puente?.piezas_conectadas, [47, 46, 45]);
    assert.strictEqual(pieza47.relacion_puente?.rol_estimado, 'pilar_distal');

    // Verificar corona en pieza 35
    const pieza35 = snapshot.cuadrantes.cuadrante_3.piezas['35'];
    assert.strictEqual(pieza35.simbolos_tecnicos.corona, true);

    // Verificar diente extraído en pieza 38
    const pieza38 = snapshot.cuadrantes.cuadrante_3.piezas['38'];
    assert.strictEqual(pieza38.simbolos_tecnicos.diente_extraido, true);
  });

  it('RF-HCL-007: Crear odontograma en blanco idéntico en estructura para primera consulta', () => {
    const blank = OdontogramEntity.createBlankOdontogramJSON(false);
    assert.ok(blank.cuadrantes.cuadrante_1);
    assert.ok(blank.cuadrantes.cuadrante_2);
    assert.ok(blank.cuadrantes.cuadrante_3);
    assert.ok(blank.cuadrantes.cuadrante_4);

    // Todas las piezas deben tener 5 caras con flags en false
    const p11 = blank.cuadrantes.cuadrante_1.piezas['11'];
    assert.strictEqual(p11.codigo_fdi, 11);
    assert.strictEqual(p11.caras.vestibular.caries_activa, false);
    if ('palatina' in p11.caras) {
      assert.strictEqual(p11.caras.palatina.restauracion_resina, false);
    }
    assert.strictEqual(p11.simbolos_tecnicos.diente_extraido, false);
  });

  it('RF-HCL-007: Rechazar odontograma con más de un hallazgo activo en la misma cara dental', () => {
    const invalidJson = structuredClone(odontogramaJsonSample);
    // En pieza 16 cara oclusal_incisal activamos tanto caries como resina
    invalidJson.cuadrantes.cuadrante_1.piezas['16'].caras.oclusal_incisal.restauracion_resina = true;

    assert.throws(
      () => {
        OdontogramEntity.fromPreviousOdontogram({ previousOdontogram: invalidJson });
      },
      /Cada superficie dental puede tener un solo hallazgo vigente/
    );
  });

  it('RF-HCL-005: Crear historia clínica al iniciar atención con "No aplica" y precarga en 2da consulta', async () => {
    const useCase = new CreateClinicalRecordUseCase(repo);

    // Caso 1: Intentar crear historia cuando la cita no está "En consulta" -> Debe fallar
    await assert.rejects(
      async () => {
        await useCase.execute({
          idPaciente: 101,
          idCita: 501,
          estadoCita: 'Confirmada',
          idProfesionalResponsable: DR_LEAL.idUsuario,
          actor: DR_LEAL,
          motivoConsulta: 'Dolor en molar superior',
          marcarTodoNoAplica: true,
        });
      },
      /Solo se puede crear o abrir la historia clínica cuando la cita está "En consulta"/
    );

    // Caso 2: Intento por un rol no profesional (ej. auxiliar) -> Debe ser rechazado (Regla 5)
    await assert.rejects(
      async () => {
        await useCase.execute({
          idPaciente: 101,
          idCita: 501,
          estadoCita: 'En consulta',
          idProfesionalResponsable: DR_LEAL.idUsuario,
          actor: AUX_MILENA,
          motivoConsulta: 'Dolor en molar superior',
          marcarTodoNoAplica: true,
        });
      },
      /No tiene permiso para realizar esta acción/
    );

    // Caso 3: Registro exitoso con botón "No aplica" y un antecedente positivo con observación
    const entry = await useCase.execute({
      idPaciente: 101,
      idCita: 501,
      estadoCita: 'En consulta',
      idProfesionalResponsable: DR_LEAL.idUsuario,
      actor: DR_LEAL,
      motivoConsulta: 'Paciente asiste por dolor en cuadrante superior derecho',
      marcarTodoNoAplica: true,
      antecedentes: {
        hipertension_arterial: {
          aplica: true,
          observacion: 'Tratamiento controlado con Losartán 50mg',
        },
      },
    });

    assert.ok(entry.idEvolucion);
    assert.strictEqual(entry.evolucion.tipoRegistro, 'APERTURA_CONSULTA');
    assert.strictEqual(entry.evolucion.motivoConsulta, 'Paciente asiste por dolor en cuadrante superior derecho');
    assert.strictEqual(entry.evolucion.antecedentes?.['hipertension_arterial'].aplica, true);
    assert.strictEqual(entry.evolucion.antecedentes?.['diabetes'].aplica, false);
    assert.strictEqual(entry.evolucion.diligenciadoPor.nombreUsuario, 'Dr. Eduar Leal Álvarez');

    // Caso 4: En una segunda consulta (cita 502), debe precargar los antecedentes automáticamente
    const secondEntry = await useCase.execute({
      idPaciente: 101,
      idCita: 502,
      estadoCita: 'En consulta',
      idProfesionalResponsable: DR_LEAL.idUsuario,
      actor: DR_LEAL,
      motivoConsulta: 'Control de rutina',
    });

    assert.strictEqual(secondEntry.evolucion.antecedentes?.['hipertension_arterial'].aplica, true);
    assert.strictEqual(
      secondEntry.evolucion.antecedentes?.['hipertension_arterial'].observacion,
      'Tratamiento controlado con Losartán 50mg'
    );
  });

  it('RF-HCL-006 (v1.3): Se edita solo mientras la cita está En consulta y nunca se elimina', async () => {
    const entry = await new CreateClinicalRecordUseCase(repo).execute({
      idPaciente: 102,
      idCita: 601,
      estadoCita: 'En consulta',
      idProfesionalResponsable: DR_LEAL.idUsuario,
      actor: DR_LEAL,
      motivoConsulta: 'Sensibilidad al frío',
      marcarTodoNoAplica: true,
    });
    const cita = { idCita: 601, idPaciente: 102, idProfesional: DR_LEAL.idUsuario, nombreProfesional: 'Dr. Leal', estado: 'En consulta' };
    const leal: any = { idUsuario: DR_LEAL.idUsuario, correo: 'leal@x.co', nombreCompleto: DR_LEAL.nombreUsuario, roles: DR_LEAL.roles, permisos: ['RF-HCL-005', 'RF-HCL-006', 'RF-HCL-008', 'RF-HCL-009'] };
    const diaz: any = { idUsuario: DRA_DIAZ.idUsuario, correo: 'diaz@x.co', nombreCompleto: DRA_DIAZ.nombreUsuario, roles: DRA_DIAZ.roles, permisos: ['RF-HCL-005', 'RF-HCL-006'] };

    // El profesional responsable edita mientras la cita está En consulta
    const writer = ClinicalAccessPolicy.resolveWriter(leal, cita);
    const updated = await repo.updateEvolutionEntry(entry.idEvolucion, { motivoConsulta: 'Dolor al masticar' } as any, writer);
    assert.strictEqual(updated.motivoConsulta, 'Dolor al masticar');

    // Otro profesional no edita la historia de una cita ajena (Regla de Negocio 4)
    assert.throws(() => ClinicalAccessPolicy.resolveWriter(diaz, cita), /No tiene permiso para realizar esta acción/);

    // Finalizada la cita, queda en solo lectura (incluso por petición directa)
    assert.throws(() => ClinicalAccessPolicy.resolveWriter(leal, { ...cita, estado: 'Atendida' }), /En consulta/);
    repo.citaEstado.set(601, 'Atendida');
    await assert.rejects(
      () => repo.updateEvolutionEntry(entry.idEvolucion, { motivoConsulta: 'X' } as any, writer),
      /solo lectura/
    );

    // Ninguna historia se elimina (Regla de Negocio 7)
    assert.throws(
      () => new ClinicalRecordEntity(102, 601, 'Test', {}, entry.evolucion.diligenciadoPor).delete(),
      /Ninguna historia clínica guardada ni sus anexos pueden ser eliminados/
    );
  });

  it('RF-HCL-007: Guardar odontograma y permitir apoyo de ROL-AUX exclusivamente "En consulta"', async () => {
    const manageOdonto = new ManageOdontogramUseCase(repo);

    // Auxiliar Milena Torres actualiza el odontograma mientras la cita está "En consulta"
    const entry = await manageOdonto.execute({
      idPaciente: 103,
      idCita: 701,
      estadoCita: 'En consulta',
      idProfesionalResponsable: DR_LEAL.idUsuario,
      actor: AUX_MILENA,
      odontograma: odontogramaJsonSample,
    });

    assert.ok(entry.idEvolucion);
    assert.strictEqual(entry.evolucion.diligenciadoPor.nombreUsuario, 'Milena Torres');
    assert.strictEqual(entry.evolucion.diligenciadoPor.idProfesionalResponsable, DR_LEAL.idUsuario);

    // Si la cita ya pasó a "Atendida", la auxiliar pierde el acceso (Regla 5)
    await assert.rejects(
      async () => {
        await manageOdonto.execute({
          idPaciente: 103,
          idCita: 701,
          estadoCita: 'Atendida',
          idProfesionalResponsable: DR_LEAL.idUsuario,
          actor: AUX_MILENA,
          odontograma: odontogramaJsonSample,
        });
      },
      /No tiene permiso para realizar esta acción/
    );
  });

  it('RF-HCL-008: Consultar historial clínico segregado por rol e incluir inasistencias en orden cronológico', async () => {
    const createUseCase = new CreateClinicalRecordUseCase(repo);
    const historyUseCase = new GetClinicalHistoryUseCase(repo);

    // Crear consulta con Dr. Leal
    await createUseCase.execute({
      idPaciente: 104,
      idCita: 801,
      estadoCita: 'En consulta',
      idProfesionalResponsable: DR_LEAL.idUsuario,
      actor: DR_LEAL,
      motivoConsulta: 'Consulta 1: Caries',
      marcarTodoNoAplica: true,
    });

    // Coordinadora no tiene acceso a la historia clínica (Regla 5)
    await assert.rejects(
      async () => {
        await historyUseCase.execute({
          idPaciente: 104,
          actor: COA_DANIELA,
        });
      },
      /No tiene permiso para realizar esta acción/
    );

    // Dr. Leal o Dra. Díaz pueden consultar el historial con inasistencias incluidas
    const historyResult = await historyUseCase.execute({
      idPaciente: 104,
      actor: DR_LEAL,
      inasistenciasPaciente: [
        {
          idCita: 802,
          fechaHora: new Date(Date.now() + 60000).toISOString(),
          profesionalResponsable: 'Dr. Eduar Leal Álvarez',
          observacion: 'El paciente no asistió a su cita de control',
        },
      ],
    });

    assert.strictEqual(historyResult.historial.length, 2);
    // La inasistencia es más reciente y debe aparecer de primera
    assert.strictEqual(historyResult.historial[0].esInasistencia, true);
    assert.strictEqual(historyResult.historial[0].motivoConsulta, 'El paciente no asistió a su cita de control');
    assert.strictEqual(historyResult.historial[1].esInasistencia, false);
    assert.strictEqual(historyResult.historial[1].motivoConsulta, 'Consulta 1: Caries');
  });

  it('RF-HCL-009 (v1.3): La auxiliar registra notas con su nombre y las correcciones posteriores son notas aclaratorias', async () => {
    const entry = await new CreateClinicalRecordUseCase(repo).execute({
      idPaciente: 105,
      idCita: 901,
      estadoCita: 'En consulta',
      idProfesionalResponsable: DR_LEAL.idUsuario,
      actor: DR_LEAL,
      motivoConsulta: 'Control de resina',
      marcarTodoNoAplica: true,
    });
    const cita = { idCita: 901, idPaciente: 105, idProfesional: DR_LEAL.idUsuario, nombreProfesional: 'Dr. Leal', estado: 'En consulta' };
    const aux: any = { idUsuario: AUX_MILENA.idUsuario, correo: 'milena@x.co', nombreCompleto: AUX_MILENA.nombreUsuario, roles: ['ROL-AUX'], permisos: ['RF-HCL-007', 'RF-HCL-009'] };
    const leal: any = { idUsuario: DR_LEAL.idUsuario, correo: 'leal@x.co', nombreCompleto: DR_LEAL.nombreUsuario, roles: DR_LEAL.roles, permisos: ['RF-HCL-005', 'RF-HCL-006', 'RF-HCL-008', 'RF-HCL-009'] };

    // La auxiliar escribe como apoyo (no como responsable): no puede cambiar la apertura
    const auxWriter = ClinicalAccessPolicy.resolveWriter(aux, cita);
    assert.strictEqual(auxWriter.esProfesionalResponsable, false);
    // No puede tomar notas aclaratorias ni ver el historial completo
    assert.throws(() => ClinicalAccessPolicy.resolveClarificationAuthor(aux, { ...cita, estado: 'Atendida' }), /No tiene permiso/);
    assert.throws(() => ClinicalAccessPolicy.assertCanViewHistory(aux), /No tiene permiso/);

    // Después del cierre, el profesional agrega una nota aclaratoria que aparece en el historial
    const autor = ClinicalAccessPolicy.resolveClarificationAuthor(leal, { ...cita, estado: 'Atendida' });
    await repo.addClarificationNote(entry.idEvolucion, 'Se aplicó protector dentinopulpar.', autor);
    const history = await new GetClinicalHistoryUseCase(repo).execute({ idPaciente: 105, actor: DR_LEAL });
    const nota = history.historial[0].notasEvolucion.find((n) => n.tipoRegistro === 'NOTA_ACLARATORIA');
    assert.ok(nota);
    assert.strictEqual(nota!.diligenciadoPor.nombreUsuario, 'Dr. Eduar Leal Álvarez');
  });

  it('ClinicalRecordsModulePublicApi: Integración bidireccional con Appointments (IClinicalRecordCheckerPort)', async () => {
    const publicApi = new ClinicalRecordsModulePublicApi(repo);
    const createUseCase = new CreateClinicalRecordUseCase(repo);

    // Antes de registrar historia: motivoConsulta está pendiente
    const reasonBefore = await publicApi.hasConsultationReasonRegistered(1001);
    assert.strictEqual(reasonBefore, false);

    await assert.rejects(
      async () => {
        await publicApi.assertConsultationReasonRegistered(106, 1001);
      },
      /Falta registrar el motivo de consulta/
    );

    // Registrar motivo
    await createUseCase.execute({
      idPaciente: 106,
      idCita: 1001,
      estadoCita: 'En consulta',
      idProfesionalResponsable: DR_LEAL.idUsuario,
      actor: DR_LEAL,
      motivoConsulta: 'Dolor agudo en premolar',
      marcarTodoNoAplica: true,
    });

    // Ahora tiene motivo registrado -> permite a appointments finalizar atención
    const reasonAfter = await publicApi.hasConsultationReasonRegistered(1001);
    assert.strictEqual(reasonAfter, true);
  });

  it('ClinicalCatalogsRepository: Catálogo configurable de hallazgos, colores y antecedentes (RQNF-MAN-001)', () => {
    const catalogRepo = new ClinicalCatalogsRepository();

    const findings = catalogRepo.getOdontogramFindings();
    assert.ok(findings.length >= 10);
    const caries = findings.find((f) => f.codigo === 'caries_activa');
    assert.strictEqual(caries?.colorHex, '#EF4444');

    const antecedents = catalogRepo.getAntecedentsCatalog();
    assert.ok(antecedents.length >= 7);
    assert.ok(antecedents.some((a) => a.codigo === 'hipertension_arterial'));

    const templates = catalogRepo.getEvolutionTemplates();
    assert.ok(templates.length >= 6);
    assert.ok(templates.some((t) => t.codigo === 'operatoria'));
  });
});
