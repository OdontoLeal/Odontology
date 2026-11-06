// src/modules/consents/infrastructure/consent.repository.ts
import { db } from '../../../shared/infrastructure/database/database';
import { auditLog } from '../../../shared/infrastructure/audit/audit-log.service';
import {
  CreateConsentTemplateDTO,
  SignConsentDTO,
  UpdateConsentTemplateDTO,
} from '../application/consent.dtos';
import {
  ConsentTemplate,
  ConsentTemplateType,
  PatientSignedConsentDetail,
  SignedConsent,
} from '../domain/consent.entity';
import { IConsentRepository } from '../domain/consent.repository.port';

export class ConsentRepository implements IConsentRepository {
  // RF-CON-004: Crear plantilla de consentimiento guardándola como texto en BD
  public async createTemplate(dto: CreateConsentTemplateDTO): Promise<ConsentTemplate> {
    const sql = `
      INSERT INTO public.plantilla_consentimiento (
        nombre, texto_plantilla, version, estado, id_usuario_modificador, fecha_modificacion, tipo
      )
      VALUES ($1, $2, $3, TRUE, $4, CURRENT_TIMESTAMP, $5)
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [
      dto.nombre,
      dto.textoPlantilla ?? '',
      dto.version ?? 1,
      dto.idUsuarioModificador ?? null,
      dto.tipo ?? 'PROCEDIMIENTO',
    ]);

    return this.mapToTemplateEntity(rows[0]);
  }

  public async findTemplateById(idConsentimiento: number): Promise<ConsentTemplate | null> {
    const sql = `
      SELECT *
      FROM public.plantilla_consentimiento
      WHERE id_consentimiento = $1;
    `;
    const { rows } = await db.query(sql, [idConsentimiento]);
    return rows[0] ? this.mapToTemplateEntity(rows[0]) : null;
  }

  // RF-CON-007: Actualizar plantilla incrementando automáticamente la versión (+1)
  public async updateTemplateVersion(
    idConsentimiento: number,
    dto: UpdateConsentTemplateDTO
  ): Promise<ConsentTemplate | null> {
    const texto = dto.textoPlantilla ?? null;
    const sql = `
      UPDATE public.plantilla_consentimiento
      SET 
        nombre = COALESCE($1, nombre),
        texto_plantilla = COALESCE($2, texto_plantilla),
        version = version + 1,
        id_usuario_modificador = COALESCE($3, id_usuario_modificador),
        fecha_modificacion = CURRENT_TIMESTAMP
      WHERE id_consentimiento = $4
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [
      dto.nombre ?? null,
      texto,
      dto.idUsuarioModificador ?? null,
      idConsentimiento,
    ]);

    return rows[0] ? this.mapToTemplateEntity(rows[0]) : null;
  }

  // RF-CON-008: Cambiar estado Activa / Inactiva (sin eliminarla)
  public async toggleTemplateStatus(
    idConsentimiento: number,
    estado: boolean
  ): Promise<ConsentTemplate | null> {
    const sql = `
      UPDATE public.plantilla_consentimiento
      SET estado = $1, fecha_modificacion = CURRENT_TIMESTAMP
      WHERE id_consentimiento = $2
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [estado, idConsentimiento]);

    return rows[0] ? this.mapToTemplateEntity(rows[0]) : null;
  }

  public async findAllTemplates(onlyActive = false): Promise<ConsentTemplate[]> {
    const where = onlyActive ? 'WHERE estado = TRUE' : '';
    const sql = `
      SELECT *
      FROM public.plantilla_consentimiento
      ${where}
      ORDER BY id_consentimiento ASC;
    `;
    const { rows } = await db.query(sql);

    return rows.map((row: any) => this.mapToTemplateEntity(row));
  }

  // RQNF-SEG-005/006: plantilla activa de un tipo especial (autorización de datos o menores)
  public async findActiveTemplateByType(tipo: ConsentTemplateType): Promise<ConsentTemplate | null> {
    const { rows } = await db.query(
      `SELECT * FROM public.plantilla_consentimiento WHERE tipo = $1 AND estado = TRUE ORDER BY id_consentimiento LIMIT 1;`,
      [tipo]
    );
    return rows[0] ? this.mapToTemplateEntity(rows[0]) : null;
  }

  // RF-CON-002: registra el consentimiento firmado (texto, versión y firma como texto) y lo audita
  public async recordSignedConsent(dto: SignConsentDTO): Promise<SignedConsent> {
    return db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO public.consentimiento_firmado (
           id_consentimiento, id_paciente, version_plantilla, texto_firmado, firma_base64,
           firma_por_acudiente, nombre_documento_acudiente, id_usuario_diligencio)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *;`,
        [
          dto.idConsentimiento,
          dto.idPaciente,
          dto.versionPlantilla ?? 1,
          dto.textoFirmado ?? '',
          dto.firmaBase64 ?? '',
          Boolean(dto.firmaPorAcudiente),
          dto.firmaPorAcudiente ? dto.nombreDocumentoAcudiente?.trim() || null : null,
          dto.idUsuarioDiligencio ?? null,
        ]
      );
      const signed = this.mapToSignedConsentEntity(rows[0]);
      await auditLog.record(
        {
          idUsuario: dto.idUsuarioDiligencio ?? null,
          actor: dto.actorCorreo ?? 'Desconocido',
          accion: 'FIRMAR_CONSENTIMIENTO',
          entidad: 'consentimiento_firmado',
          idRegistro: signed.idConsentimientoFirmado ?? null,
          valorNuevo: {
            idPaciente: dto.idPaciente,
            idPlantilla: dto.idConsentimiento,
            version: dto.versionPlantilla,
            firmaPorAcudiente: Boolean(dto.firmaPorAcudiente),
          },
        },
        client
      );
      return signed;
    });
  }

  // RF-CON-003: Consultar consentimientos firmados de un paciente (más reciente a más antiguo)
  public async getSignedConsentsByPatient(
    idPaciente: number
  ): Promise<PatientSignedConsentDetail[]> {
    const sql = `
      SELECT 
        cf.id_consentimiento_firmado AS "idConsentimientoFirmado",
        cf.id_consentimiento AS "idConsentimiento",
        pc.nombre AS "nombrePlantilla",
        pc.tipo AS "tipoPlantilla",
        cf.version_plantilla AS "versionPlantilla",
        pc.version AS "versionActualPlantilla",
        cf.id_paciente AS "idPaciente",
        p.nombre_completo AS "pacienteNombre",
        p.documento_identidad AS "pacienteDocumento",
        cf.fecha,
        cf.texto_firmado AS "textoFirmado",
        cf.firma_base64 AS "firmaBase64",
        cf.firma_por_acudiente AS "firmaPorAcudiente",
        cf.nombre_documento_acudiente AS "nombreDocumentoAcudiente",
        cf.id_usuario_diligencio AS "idUsuarioDiligencio",
        u.nombre_completo AS "usuarioDiligencioNombre"
      FROM public.consentimiento_firmado cf
      INNER JOIN public.plantilla_consentimiento pc ON cf.id_consentimiento = pc.id_consentimiento
      LEFT JOIN public.paciente p ON cf.id_paciente = p.id_paciente
      LEFT JOIN public.usuario u ON cf.id_usuario_diligencio = u.id_usuario
      WHERE cf.id_paciente = $1
      ORDER BY cf.fecha DESC;
    `;
    const { rows } = await db.query(sql, [idPaciente]);
    return rows.map((r) => ({
      ...r,
      idConsentimientoFirmado: Number(r.idConsentimientoFirmado),
      idConsentimiento: Number(r.idConsentimiento),
      versionPlantilla: Number(r.versionPlantilla),
      versionActualPlantilla: Number(r.versionActualPlantilla),
      idPaciente: Number(r.idPaciente),
      fecha: new Date(r.fecha),
      firmaPorAcudiente: Boolean(r.firmaPorAcudiente),
    }));
  }

  public async findSignedConsentById(
    idConsentimientoFirmado: number
  ): Promise<PatientSignedConsentDetail | null> {
    const sql = `
      SELECT 
        cf.id_consentimiento_firmado AS "idConsentimientoFirmado",
        cf.id_consentimiento AS "idConsentimiento",
        pc.nombre AS "nombrePlantilla",
        pc.tipo AS "tipoPlantilla",
        cf.version_plantilla AS "versionPlantilla",
        pc.version AS "versionActualPlantilla",
        cf.id_paciente AS "idPaciente",
        p.nombre_completo AS "pacienteNombre",
        p.documento_identidad AS "pacienteDocumento",
        cf.fecha,
        cf.texto_firmado AS "textoFirmado",
        cf.firma_base64 AS "firmaBase64",
        cf.firma_por_acudiente AS "firmaPorAcudiente",
        cf.nombre_documento_acudiente AS "nombreDocumentoAcudiente",
        cf.id_usuario_diligencio AS "idUsuarioDiligencio",
        u.nombre_completo AS "usuarioDiligencioNombre"
      FROM public.consentimiento_firmado cf
      INNER JOIN public.plantilla_consentimiento pc ON cf.id_consentimiento = pc.id_consentimiento
      LEFT JOIN public.paciente p ON cf.id_paciente = p.id_paciente
      LEFT JOIN public.usuario u ON cf.id_usuario_diligencio = u.id_usuario
      WHERE cf.id_consentimiento_firmado = $1;
    `;
    const { rows } = await db.query(sql, [idConsentimientoFirmado]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      idConsentimientoFirmado: Number(r.idConsentimientoFirmado),
      idConsentimiento: Number(r.idConsentimiento),
      versionPlantilla: Number(r.versionPlantilla),
      versionActualPlantilla: Number(r.versionActualPlantilla),
      idPaciente: Number(r.idPaciente),
      fecha: new Date(r.fecha),
      firmaPorAcudiente: Boolean(r.firmaPorAcudiente),
    };
  }

  public async findPatientBirthDate(idPaciente: number): Promise<string | null> {
    const { rows } = await db.query<{ fecha_nacimiento: string }>(
      `SELECT fecha_nacimiento::text AS fecha_nacimiento FROM public.paciente WHERE id_paciente = $1;`,
      [idPaciente]
    );
    return rows[0]?.fecha_nacimiento ?? null;
  }

  private mapToTemplateEntity(row: any): ConsentTemplate {
    return new ConsentTemplate({
      idConsentimiento: Number(row.id_consentimiento),
      nombre: row.nombre,
      textoPlantilla: row.texto_plantilla ?? row.plantilla_url ?? '',
      version: Number(row.version),
      estado: Boolean(row.estado),
      idUsuarioModificador: row.id_usuario_modificador ? Number(row.id_usuario_modificador) : null,
      fechaModificacion: row.fecha_modificacion ? new Date(row.fecha_modificacion) : undefined,
      tipo: row.tipo ?? 'PROCEDIMIENTO',
    });
  }

  private mapToSignedConsentEntity(row: any): SignedConsent {
    return new SignedConsent({
      idConsentimientoFirmado: Number(row.id_consentimiento_firmado ?? 0),
      idConsentimiento: Number(row.id_consentimiento),
      idPaciente: Number(row.id_paciente),
      versionPlantilla: Number(row.version_plantilla ?? 1),
      textoFirmado: row.texto_firmado ?? '',
      firmaBase64: row.firma_base64 ?? '',
      firmaPorAcudiente: Boolean(row.firma_por_acudiente),
      nombreDocumentoAcudiente: row.nombre_documento_acudiente ?? null,
      idUsuarioDiligencio: row.id_usuario_diligencio ? Number(row.id_usuario_diligencio) : null,
      fecha: row.fecha ? new Date(row.fecha) : undefined,
    });
  }
}
