import { db } from '../../../shared/infrastructure/database/database';
import { DataAuthorizationVO } from '../domain/data-authorization.vo';
import {
  BackupContactInfo,
  GuardianInfo,
  Patient,
  PatientSex,
} from '../domain/patient.entity';
import {
  CreatedPatientResult,
  HolderDataRecord,
  IPatientRepository,
  PatientProfileRecord,
  PatientSearchItem,
} from '../domain/patient.repository.interface';
import { PatientRow } from './patient.model';

interface ExtendedPatientMetadata {
  acudiente?: GuardianInfo | null;
  contactoRespaldo?: BackupContactInfo | null;
  autorizacionDatos?: ReturnType<DataAuthorizationVO['toPrimitives']> | null;
}

export class PatientRepository implements IPatientRepository {
  // Almacén auxiliar en memoria para metadatos extendidos si la tabla física `paciente`
  // aún no tiene las columnas JSONB de acudiente/autorizacionDatos en dll.txt
  private readonly metadataStore = new Map<number, ExtendedPatientMetadata>();

  private formatDateOnly(value: string | Date): string {
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    return String(value).split('T')[0];
  }

  private mapRowToEntity(row: PatientRow): Patient {
    const extra = this.metadataStore.get(row.id_paciente);
    const authVO = extra?.autorizacionDatos
      ? DataAuthorizationVO.create({
          autorizado: extra.autorizacionDatos.autorizado,
          fechaHora: extra.autorizacionDatos.fechaHora,
          medio: extra.autorizacionDatos.medio,
          versionAvisoPrivacidad:
            extra.autorizacionDatos.versionAvisoPrivacidad,
          idUsuarioRegistro: extra.autorizacionDatos.idUsuarioRegistro,
          firmadoPorAcudiente: extra.autorizacionDatos.firmadoPorAcudiente,
        })
      : null;

    return Patient.reconstitute({
      idPaciente: row.id_paciente,
      nombreCompleto: row.nombre_completo,
      documentoIdentidad: row.documento_identidad,
      correo: row.correo,
      telefono: row.telefono,
      fechaNacimiento: this.formatDateOnly(row.fecha_nacimiento),
      sexo: (row.sexo as PatientSex) ?? null,
      acudiente: extra?.acudiente ?? null,
      contactoRespaldo: extra?.contactoRespaldo ?? null,
      autorizacionDatos: authVO,
      creadoDesdeSolicitud: !row.sexo,
    });
  }

  // RF-HCL-001: Crear paciente y asociar historia_clinica vacía automáticamente
  public async createPatient(patient: Patient): Promise<CreatedPatientResult> {
    return db.withTransaction(async (client) => {
      const insertPatientSql = `
        INSERT INTO public.paciente 
          (nombre_completo, documento_identidad, correo, telefono, fecha_nacimiento, sexo)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const patientRes = await client.query<PatientRow>(insertPatientSql, [
        patient.nombreCompleto,
        patient.documentoIdentidad,
        patient.correo,
        patient.telefono,
        patient.fechaNacimiento,
        patient.sexo,
      ]);
      const row = patientRes.rows[0];

      const hcRes = await client.query<{
        id_historia: number;
        fecha_creacion: Date;
      }>(
        `INSERT INTO public.historia_clinica (id_paciente) VALUES ($1) RETURNING id_historia, fecha_creacion;`,
        [row.id_paciente]
      );

      this.metadataStore.set(row.id_paciente, {
        acudiente: patient.acudiente,
        contactoRespaldo: patient.contactoRespaldo,
        autorizacionDatos: patient.autorizacionDatos
          ? patient.autorizacionDatos.toPrimitives()
          : null,
      });

      const savedEntity = this.mapRowToEntity(row);

      return {
        patient: savedEntity.toPrimitives(),
        historiaClinicaBase: hcRes.rows[0],
      };
    });
  }

  // RF-HCL-002: Editar paciente
  public async updatePatient(
    idPaciente: number,
    patient: Patient
  ): Promise<ReturnType<Patient['toPrimitives']> | null> {
    const sql = `
      UPDATE public.paciente
      SET 
        nombre_completo = $1,
        documento_identidad = $2,
        correo = $3,
        telefono = $4,
        fecha_nacimiento = $5,
        sexo = $6
      WHERE id_paciente = $7
      RETURNING *;
    `;
    const { rows } = await db.query<PatientRow>(sql, [
      patient.nombreCompleto,
      patient.documentoIdentidad,
      patient.correo,
      patient.telefono,
      patient.fechaNacimiento,
      patient.sexo,
      idPaciente,
    ]);

    if (rows.length === 0) return null;

    const currentMeta = this.metadataStore.get(idPaciente) ?? {};
    this.metadataStore.set(idPaciente, {
      ...currentMeta,
      acudiente: patient.acudiente,
      contactoRespaldo: patient.contactoRespaldo,
    });

    const updatedEntity = this.mapRowToEntity(rows[0]);
    return updatedEntity.toPrimitives();
  }

  public async findById(idPaciente: number): Promise<Patient | null> {
    const sql = `SELECT * FROM public.paciente WHERE id_paciente = $1 LIMIT 1;`;
    const { rows } = await db.query<PatientRow>(sql, [idPaciente]);
    if (rows.length === 0) return null;
    return this.mapRowToEntity(rows[0]);
  }

  public async findByDocument(
    documentoIdentidad: string
  ): Promise<Patient | null> {
    const sql = `SELECT * FROM public.paciente WHERE documento_identidad = $1 LIMIT 1;`;
    const { rows } = await db.query<PatientRow>(sql, [documentoIdentidad]);
    if (rows.length === 0) return null;
    return this.mapRowToEntity(rows[0]);
  }

  // RF-HCL-003: Buscar pacientes por documento exacto o nombre parcial sin distinguir mayúsculas ni tildes
  public async searchPatients(query?: string): Promise<PatientSearchItem[]> {
    const params: any[] = [];
    let where = '';
    if (query) {
      params.push(query, `%${query}%`);
      where = `
        WHERE documento_identidad = $1 
           OR TRANSLATE(LOWER(nombre_completo), 'áéíóúäëïöüàèìòù', 'aeiouaeiouaeiou') 
              ILIKE TRANSLATE(LOWER($2), 'áéíóúäëïöüàèìòù', 'aeiouaeiouaeiou')
      `;
    }
    const sql = `
      SELECT 
        id_paciente,
        nombre_completo,
        documento_identidad,
        correo,
        telefono,
        fecha_nacimiento,
        sexo
      FROM public.paciente
      ${where}
      ORDER BY nombre_completo ASC;
    `;
    const { rows } = await db.query<PatientRow>(sql, params);
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

  // RF-HCL-004: Visualizar ficha de paciente con su historial de citas (sin datos clínicos)
  public async getPatientProfileByIdOrDoc(identifier: {
    idPaciente?: number;
    documento?: string;
  }): Promise<PatientProfileRecord | null> {
    const param = identifier.idPaciente ?? identifier.documento;
    const condition = identifier.idPaciente
      ? 'p.id_paciente = $1'
      : 'p.documento_identidad = $1';

    const sql = `
      SELECT 
        p.id_paciente AS "idPaciente",
        p.nombre_completo AS "nombreCompleto",
        p.documento_identidad AS "documentoIdentidad",
        p.correo,
        p.telefono,
        p.fecha_nacimiento AS "fechaNacimiento",
        p.sexo,
        hc.id_historia AS "idHistoria",
        COALESCE(
          json_agg(
            json_build_object(
              'idCita', c.id_cita,
              'titulo', c.titulo,
              'estado', c.estado,
              'profesional', u.nombre_completo
            ) ORDER BY c.id_cita DESC
          ) FILTER (WHERE c.id_cita IS NOT NULL), '[]'
        ) AS "historialCitas"
      FROM public.paciente p
      LEFT JOIN public.historia_clinica hc ON p.id_paciente = hc.id_paciente
      LEFT JOIN public.cita c ON p.id_paciente = c.id_paciente
      LEFT JOIN public.usuario u ON c.id_usuario = u.id_usuario
      WHERE ${condition}
      GROUP BY p.id_paciente, hc.id_historia;
    `;
    const { rows } = await db.query<any>(sql, [param]);
    if (rows.length === 0) return null;

    const raw = rows[0];
    const entity = this.mapRowToEntity({
      id_paciente: raw.idPaciente,
      nombre_completo: raw.nombreCompleto,
      documento_identidad: raw.documentoIdentidad,
      correo: raw.correo,
      telefono: raw.telefono,
      fecha_nacimiento: raw.fechaNacimiento,
      sexo: raw.sexo,
    });

    const extra = this.metadataStore.get(raw.idPaciente);

    return {
      idPaciente: raw.idPaciente,
      nombreCompleto: entity.nombreCompleto,
      documentoIdentidad: entity.documentoIdentidad,
      correo: entity.correo,
      telefono: entity.telefono,
      fechaNacimiento: entity.fechaNacimiento,
      sexo: entity.sexo,
      datosIncompletos: entity.datosIncompletos,
      idHistoria: raw.idHistoria ?? null,
      acudiente: extra?.acudiente ?? null,
      contactoRespaldo: extra?.contactoRespaldo ?? null,
      autorizacionDatos: extra?.autorizacionDatos ?? null,
      historialCitas: raw.historialCitas ?? [],
    };
  }

  // RF-HCL-010 & RQNF-SEG-007: Consultar datos del titular (como paciente, acudiente o solicitante)
  public async getHolderDataByDocument(
    documentoIdentidad: string
  ): Promise<HolderDataRecord | null> {
    const patientEntity = await this.findByDocument(documentoIdentidad);

    // Buscar como solicitante en public.solicitud_cita
    const solicitudesSql = `
      SELECT 
        id_solicitud AS "idSolicitud",
        nombre_solicitante AS "nombreSolicitante",
        documento_solicitante AS "documentoSolicitante",
        correo_solicitante AS "correoSolicitante",
        bloque_solicitado AS "bloqueSolicitado",
        descripcion,
        CASE WHEN estado = true THEN 'Solicitada' ELSE 'Gestionada' END AS "estadoSolicitud"
      FROM public.solicitud_cita
      WHERE documento_solicitante = $1
      ORDER BY id_solicitud DESC;
    `;
    const solicitudesRes = await db.query<any>(solicitudesSql, [
      documentoIdentidad,
    ]);

    // Buscar si figura como acudiente de algún menor en metadataStore
    const comoAcudiente: HolderDataRecord['calidades']['comoAcudiente'] = [];
    for (const [idPac, meta] of this.metadataStore.entries()) {
      if (meta.acudiente?.documentoIdentidad === documentoIdentidad) {
        const minorEntity = await this.findById(idPac);
        if (minorEntity) {
          // RQNF-SEG-007: Solo incluye el nombre y el parentesco del menor que representa
          comoAcudiente.push({
            nombreAcudiente: meta.acudiente.nombreCompleto,
            documentoAcudiente: meta.acudiente.documentoIdentidad,
            telefonoAcudiente: meta.acudiente.telefono,
            nombreMenorRepresentado: minorEntity.nombreCompleto,
            parentescoConMenor: meta.acudiente.parentesco,
          });
        }
      }
    }

    // Si no existe ni como paciente, ni como acudiente, ni como solicitante
    if (
      !patientEntity &&
      comoAcudiente.length === 0 &&
      solicitudesRes.rows.length === 0
    ) {
      return null;
    }

    let citasRegistradas: HolderDataRecord['citasRegistradas'] = [];
    const autorizaciones: HolderDataRecord['autorizaciones'] = [];

    if (patientEntity && patientEntity.idPaciente) {
      const profile = await this.getPatientProfileByIdOrDoc({
        idPaciente: patientEntity.idPaciente,
      });
      citasRegistradas = (profile?.historialCitas ?? []).map((c) => ({
        idCita: c.idCita,
        titulo: c.titulo,
        estado: c.estado,
        profesional: c.profesional,
        fechaHora: c.fechaHoraInicio ?? null,
      }));

      if (profile?.autorizacionDatos) {
        autorizaciones.push({
          fechaHora: profile.autorizacionDatos.fechaHora,
          medio: profile.autorizacionDatos.medio,
          versionAvisoPrivacidad:
            profile.autorizacionDatos.versionAvisoPrivacidad,
          calidad: 'PACIENTE',
        });
      }
    }

    return {
      documentoConsultado: documentoIdentidad,
      calidades: {
        comoPaciente:
          patientEntity && patientEntity.idPaciente
            ? {
                idPaciente: patientEntity.idPaciente,
                nombreCompleto: patientEntity.nombreCompleto,
                documentoIdentidad: patientEntity.documentoIdentidad,
                correo: patientEntity.correo,
                telefono: patientEntity.telefono,
                fechaNacimiento: patientEntity.fechaNacimiento,
                sexo: patientEntity.sexo,
                contactoRespaldo: patientEntity.contactoRespaldo,
              }
            : null,
        comoAcudiente,
        comoSolicitante: solicitudesRes.rows.map((r) => ({
          idSolicitud: r.idSolicitud,
          nombreSolicitante: r.nombreSolicitante,
          documentoSolicitante: r.documentoSolicitante,
          correoSolicitante: r.correoSolicitante,
          bloqueSolicitado:
            r.bloqueSolicitado instanceof Date
              ? r.bloqueSolicitado.toISOString()
              : String(r.bloqueSolicitado),
          descripcion: r.descripcion,
          estadoSolicitud: r.estadoSolicitud,
        })),
      },
      autorizaciones,
      citasRegistradas,
    };
  }
}