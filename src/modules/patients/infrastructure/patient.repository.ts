// src/modules/patients/infrastructure/patient.repository.ts
import { db } from '../../../shared/infrastructure/database/database';
import { auditLog } from '../../../shared/infrastructure/audit/audit-log.service';
import { Patient, PatientSex } from '../domain/patient.entity';
import {
  CreatedPatientResult,
  HolderAuthorizationRecord,
  HolderDataRecord,
  IPatientRepository,
  PatientAuditActor,
  PatientProfileRecord,
  PatientSearchItem,
} from '../domain/patient.repository.interface';
import { PatientRow } from './patient.model';

/**
 * Persistencia de pacientes. Todos los datos viven en `public.paciente`
 * (antes había un almacén paralelo en `storage/patients_metadata.json` que se
 * perdía en cada despliegue: DEF-23). Crear y editar se auditan dentro de la
 * misma transacción (RQNF-SEG-009).
 */
export class PatientRepository implements IPatientRepository {
  private formatDateOnly(value: string | Date): string {
    if (value instanceof Date) return value.toISOString().split('T')[0];
    return String(value).split('T')[0];
  }

  private mapRowToEntity(row: PatientRow): Patient {
    return Patient.reconstitute({
      idPaciente: row.id_paciente,
      nombreCompleto: row.nombre_completo,
      documentoIdentidad: row.documento_identidad,
      correo: row.correo,
      telefono: row.telefono,
      fechaNacimiento: this.formatDateOnly(row.fecha_nacimiento),
      sexo: (row.sexo as PatientSex) ?? null,
    });
  }

  // RF-HCL-001: paciente + historia clínica vacía + auditoría, todo o nada
  public async createPatient(patient: Patient, actor?: PatientAuditActor): Promise<CreatedPatientResult> {
    return db.withTransaction(async (client) => {
      const patientRes = await client.query<PatientRow>(
        `INSERT INTO public.paciente
           (nombre_completo, documento_identidad, correo, telefono, fecha_nacimiento, sexo)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *;`,
        [
          patient.nombreCompleto,
          patient.documentoIdentidad,
          patient.correo,
          patient.telefono,
          patient.fechaNacimiento,
          patient.sexo,
        ]
      );
      const row = patientRes.rows[0];

      const hcRes = await client.query<{ id_historia: number; fecha_creacion: Date }>(
        `INSERT INTO public.historia_clinica (id_paciente) VALUES ($1)
         RETURNING id_historia, fecha_creacion;`,
        [row.id_paciente]
      );

      const saved = this.mapRowToEntity(row).toPrimitives();
      await auditLog.record(
        {
          idUsuario: actor?.idUsuario ?? null,
          actor: actor?.actor ?? 'Desconocido',
          accion: 'CREAR',
          entidad: 'paciente',
          idRegistro: row.id_paciente,
          valorNuevo: saved,
          detalle: { idHistoria: hcRes.rows[0].id_historia },
        },
        client
      );

      return { patient: saved, historiaClinicaBase: hcRes.rows[0] };
    });
  }

  // RF-HCL-002: guarda valor anterior y nuevo en la auditoría (misma transacción)
  public async updatePatient(
    idPaciente: number,
    patient: Patient,
    auditMeta?: { idUsuarioActor?: number; actor?: string; valorAnterior?: Record<string, unknown> }
  ): Promise<ReturnType<Patient['toPrimitives']> | null> {
    return db.withTransaction(async (client) => {
      const { rows } = await client.query<PatientRow>(
        `UPDATE public.paciente
            SET nombre_completo = $1,
                documento_identidad = $2,
                correo = $3,
                telefono = $4,
                fecha_nacimiento = $5,
                sexo = $6
          WHERE id_paciente = $7
          RETURNING *;`,
        [
          patient.nombreCompleto,
          patient.documentoIdentidad,
          patient.correo,
          patient.telefono,
          patient.fechaNacimiento,
          patient.sexo,
          idPaciente,
        ]
      );
      if (rows.length === 0) return null;

      const updated = this.mapRowToEntity(rows[0]).toPrimitives();
      await auditLog.record(
        {
          idUsuario: auditMeta?.idUsuarioActor ?? null,
          actor: auditMeta?.actor ?? 'Desconocido',
          accion: 'MODIFICAR',
          entidad: 'paciente',
          idRegistro: idPaciente,
          valorAnterior: auditMeta?.valorAnterior,
          valorNuevo: updated,
        },
        client
      );
      return updated;
    });
  }

  public async findById(idPaciente: number): Promise<Patient | null> {
    const { rows } = await db.query<PatientRow>(
      `SELECT * FROM public.paciente WHERE id_paciente = $1 LIMIT 1;`,
      [idPaciente]
    );
    return rows.length ? this.mapRowToEntity(rows[0]) : null;
  }

  public async findByDocument(documentoIdentidad: string): Promise<Patient | null> {
    const { rows } = await db.query<PatientRow>(
      `SELECT * FROM public.paciente WHERE documento_identidad = $1 LIMIT 1;`,
      [documentoIdentidad]
    );
    return rows.length ? this.mapRowToEntity(rows[0]) : null;
  }

  public async hasActiveConsultation(idPaciente: number): Promise<boolean> {
    const { rows } = await db.query(
      `SELECT 1 FROM public.cita WHERE id_paciente = $1 AND estado = 'En consulta' LIMIT 1;`,
      [idPaciente]
    );
    return rows.length > 0;
  }

  // RF-HCL-003: documento exacto o nombre parcial sin distinguir mayúsculas ni tildes
  public async searchPatients(query?: string): Promise<PatientSearchItem[]> {
    const params: unknown[] = [];
    let where = '';
    if (query) {
      params.push(query, `%${query}%`);
      where = `
        WHERE documento_identidad = $1
           OR TRANSLATE(LOWER(nombre_completo), 'áéíóúäëïöüàèìòù', 'aeiouaeiouaeiou')
              LIKE TRANSLATE(LOWER($2), 'áéíóúäëïöüàèìòù', 'aeiouaeiouaeiou')`;
    }
    const { rows } = await db.query<PatientRow>(
      `SELECT id_paciente, nombre_completo, documento_identidad, correo, telefono, fecha_nacimiento, sexo
         FROM public.paciente
         ${where}
        ORDER BY nombre_completo ASC;`,
      params
    );
    return rows.map((row) => {
      const entity = this.mapRowToEntity(row);
      return {
        idPaciente: row.id_paciente,
        nombreCompleto: entity.nombreCompleto,
        documentoIdentidad: entity.documentoIdentidad,
        correo: entity.correo,
        telefono: entity.telefono,
        fechaNacimiento: entity.fechaNacimiento,
        sexo: entity.sexo,
        datosIncompletos: entity.datosIncompletos,
      };
    });
  }

  // RF-HCL-004: ficha con historial de citas (más reciente primero), con fecha,
  // hora, profesional, estado y "Agendado por" (DEF-16)
  public async getPatientProfileByIdOrDoc(identifier: {
    idPaciente?: number;
    documento?: string;
  }): Promise<PatientProfileRecord | null> {
    const param = identifier.idPaciente ?? identifier.documento;
    const condition = identifier.idPaciente ? 'p.id_paciente = $1' : 'p.documento_identidad = $1';

    const { rows } = await db.query<PatientRow & { id_historia: number | null }>(
      `SELECT p.*, hc.id_historia
         FROM public.paciente p
         LEFT JOIN public.historia_clinica hc ON hc.id_paciente = p.id_paciente
        WHERE ${condition};`,
      [param]
    );
    if (rows.length === 0) return null;

    const row = rows[0];
    const entity = this.mapRowToEntity(row);
    const historialCitas = await this.getAppointmentsOfPatient(row.id_paciente);
    const primitives = entity.toPrimitives();

    return {
      idPaciente: row.id_paciente,
      nombreCompleto: entity.nombreCompleto,
      documentoIdentidad: entity.documentoIdentidad,
      correo: entity.correo,
      telefono: entity.telefono,
      fechaNacimiento: entity.fechaNacimiento,
      edad: primitives.edad ?? 0,
      esMenorDeEdad: primitives.esMenorDeEdad,
      sexo: entity.sexo,
      datosIncompletos: entity.datosIncompletos,
      idHistoria: row.id_historia ?? null,
      historialCitas,
    };
  }

  private async getAppointmentsOfPatient(idPaciente: number) {
    const { rows } = await db.query<{
      idCita: number;
      titulo: string;
      estado: string;
      profesional: string;
      fechaHoraInicio: string | null;
      agendadoPor: string | null;
    }>(
      `SELECT c.id_cita AS "idCita",
              c.titulo,
              c.estado,
              u.nombre_completo AS profesional,
              to_char(MIN(bc.id_bloque), 'YYYY-MM-DD HH24:MI') AS "fechaHoraInicio",
              (SELECT ug.nombre_completo
                 FROM public.historial_cita h
                 JOIN public.usuario ug ON ug.id_usuario = h.id_usuario_gestor
                WHERE h.id_cita = c.id_cita
                ORDER BY h.id_cambio_cita ASC
                LIMIT 1) AS "agendadoPor"
         FROM public.cita c
         JOIN public.usuario u ON u.id_usuario = c.id_usuario
         LEFT JOIN public.bloques_citas bc ON bc.id_cita = c.id_cita
        WHERE c.id_paciente = $1
        GROUP BY c.id_cita, u.nombre_completo
        ORDER BY MIN(bc.id_bloque) DESC NULLS LAST, c.id_cita DESC;`,
      [idPaciente]
    );
    return rows.map((r) => ({ ...r, agendadoPor: r.agendadoPor ?? 'Sin registro' }));
  }

  /**
   * RF-HCL-010 y RQNF-SEG-007 (ERS v1.3): datos del titular como paciente o
   * solicitante (ya no como acudiente), sus autorizaciones —consentimientos
   * firmados del Módulo D y aceptaciones de la plantilla vigente en solicitudes
   * públicas— y sus citas, sin datos clínicos.
   */
  public async getHolderDataByDocument(documentoIdentidad: string): Promise<HolderDataRecord | null> {
    const patientEntity = await this.findByDocument(documentoIdentidad);

    const solicitudesRes = await db.query<any>(
      `SELECT sc.id_solicitud AS "idSolicitud",
              sc.nombre_solicitante AS "nombreSolicitante",
              sc.documento_solicitante AS "documentoSolicitante",
              sc.correo_solicitante AS "correoSolicitante",
              sc.telefono_solicitante AS "telefonoSolicitante",
              to_char(sc.bloque_solicitado, 'YYYY-MM-DD HH24:MI') AS "bloqueSolicitado",
              sc.descripcion,
              CASE WHEN sc.estado THEN 'Solicitada' ELSE 'Gestionada' END AS "estadoSolicitud",
              pc.nombre AS "plantillaAutorizacion",
              sc.version_plantilla_autorizacion AS "versionPlantillaAutorizacion",
              to_char(sc.fecha_aceptacion_autorizacion, 'YYYY-MM-DD HH24:MI') AS "fechaAceptacion"
         FROM public.solicitud_cita sc
         LEFT JOIN public.plantilla_consentimiento pc ON pc.id_consentimiento = sc.id_plantilla_autorizacion
        WHERE sc.documento_solicitante = $1
        ORDER BY sc.id_solicitud DESC;`,
      [documentoIdentidad]
    );

    if (!patientEntity && solicitudesRes.rows.length === 0) return null;

    const autorizaciones: HolderAuthorizationRecord[] = [];
    let citasRegistradas: HolderDataRecord['citasRegistradas'] = [];

    if (patientEntity?.idPaciente) {
      const consentRes = await db.query<any>(
        `SELECT pc.nombre AS plantilla, cf.version_plantilla AS version,
                to_char(cf.fecha, 'YYYY-MM-DD HH24:MI') AS fecha,
                cf.firma_por_acudiente AS "firmadoPorAcudiente",
                u.nombre_completo AS "diligenciadoPor"
           FROM public.consentimiento_firmado cf
           JOIN public.plantilla_consentimiento pc ON pc.id_consentimiento = cf.id_consentimiento
           LEFT JOIN public.usuario u ON u.id_usuario = cf.id_usuario_diligencio
          WHERE cf.id_paciente = $1 AND pc.tipo IN ('AUTORIZACION_DATOS', 'MENORES')
          ORDER BY cf.fecha DESC;`,
        [patientEntity.idPaciente]
      );
      for (const c of consentRes.rows) {
        autorizaciones.push({
          tipo: 'CONSENTIMIENTO_FIRMADO',
          plantilla: c.plantilla,
          versionPlantilla: Number(c.version),
          fechaHora: c.fecha,
          firmadoPorAcudiente: Boolean(c.firmadoPorAcudiente),
          diligenciadoPor: c.diligenciadoPor ?? null,
        });
      }
      citasRegistradas = (await this.getAppointmentsOfPatient(patientEntity.idPaciente)).map((c) => ({
        idCita: c.idCita,
        titulo: c.titulo,
        estado: c.estado,
        profesional: c.profesional,
        fechaHora: c.fechaHoraInicio,
      }));
    }

    for (const s of solicitudesRes.rows) {
      if (s.fechaAceptacion) {
        autorizaciones.push({
          tipo: 'ACEPTACION_SOLICITUD',
          plantilla: s.plantillaAutorizacion ?? 'Autorización de tratamiento de datos personales',
          versionPlantilla: s.versionPlantillaAutorizacion ? Number(s.versionPlantillaAutorizacion) : null,
          fechaHora: s.fechaAceptacion,
        });
      }
    }

    return {
      documentoConsultado: documentoIdentidad,
      calidades: {
        comoPaciente: patientEntity?.idPaciente
          ? {
              idPaciente: patientEntity.idPaciente,
              nombreCompleto: patientEntity.nombreCompleto,
              documentoIdentidad: patientEntity.documentoIdentidad,
              correo: patientEntity.correo,
              telefono: patientEntity.telefono,
              fechaNacimiento: patientEntity.fechaNacimiento,
              sexo: patientEntity.sexo,
            }
          : null,
        comoSolicitante: solicitudesRes.rows.map((r: any) => ({
          idSolicitud: r.idSolicitud,
          nombreSolicitante: r.nombreSolicitante,
          documentoSolicitante: r.documentoSolicitante,
          correoSolicitante: r.correoSolicitante,
          telefonoSolicitante: r.telefonoSolicitante ?? null,
          bloqueSolicitado: r.bloqueSolicitado,
          descripcion: r.descripcion,
          estadoSolicitud: r.estadoSolicitud,
        })),
      },
      autorizaciones,
      citasRegistradas,
    };
  }
}
