// src/modules/consents/infrastructure/consent.repository.ts
import { db } from '../../../shared/infrastructure/database/database';
import {
  CreateConsentTemplateDTO,
  SignConsentDTO,
  UpdateConsentTemplateDTO,
} from '../application/consent.dtos';
import {
  ConsentTemplate,
  PatientSignedConsentDetail,
  SignedConsent,
} from '../domain/consent.entity';
import { IConsentRepository } from '../domain/consent.repository.port';

interface TemplateRow {
  id_consentimiento: number;
  nombre: string;
  texto_plantilla: string;
  version: number;
  estado: boolean;
  id_usuario_modificador?: number | null;
  fecha_modificacion?: Date | string;
}

interface SignedConsentRow {
  id_consentimiento_firmado: number;
  id_consentimiento: number;
  id_paciente: number;
  fecha: Date;
  version_plantilla: number;
  texto_firmado: string;
  firma_base64: string;
  firma_por_acudiente: boolean;
  nombre_documento_acudiente: string | null;
  id_usuario_diligencio: number | null;
}

export class ConsentRepository implements IConsentRepository {
  // RF-CON-004: Crear plantilla de consentimiento guardándola como texto en BD
  public async createTemplate(dto: CreateConsentTemplateDTO): Promise<ConsentTemplate> {
    const texto = dto.textoPlantilla ?? dto.plantillaUrl ?? '';
    const sql = `
      INSERT INTO public.plantilla_consentimiento (
        nombre, texto_plantilla, version, estado, id_usuario_modificador, fecha_modificacion
      )
      VALUES ($1, $2, $3, TRUE, $4, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [
      dto.nombre,
      texto,
      dto.version ?? 1,
      dto.idUsuarioModificador ?? null,
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
    const texto = dto.textoPlantilla ?? dto.plantillaUrl ?? null;
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

    return rows.map((row: TemplateRow) => this.mapToTemplateEntity(row));
  }

  // RF-CON-002: Registrar consentimiento firmado guardando texto firmado y firma Base64
  public async recordSignedConsent(dto: SignConsentDTO): Promise<SignedConsent> {
    const texto = dto.textoFirmado ?? '';
    const firma = dto.firmaBase64 ?? dto.archivoUrl ?? '';
    const acudiente = Boolean(dto.firmaPorAcudiente);
    const nombreDocAcudiente = acudiente ? (dto.nombreDocumentoAcudiente?.trim() || null) : null;
    const idUsuarioDiligencio = dto.idUsuarioDiligencio ?? null;

    // Obtener versión vigente de la plantilla
    let version = 1;
    const tmplRes = await db.query(
      `SELECT version FROM public.plantilla_consentimiento WHERE id_consentimiento = $1;`,
      [dto.idConsentimiento]
    );
    if (tmplRes.rows[0]) {
      version = Number(tmplRes.rows[0].version);
    }

    const sql = `
      INSERT INTO public.consentimiento_firmado (
        id_consentimiento,
        id_paciente,
        version_plantilla,
        texto_firmado,
        firma_base64,
        firma_por_acudiente,
        nombre_documento_acudiente,
        id_usuario_diligencio
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [
      dto.idConsentimiento,
      dto.idPaciente,
      version,
      texto,
      firma,
      acudiente,
      nombreDocAcudiente,
      idUsuarioDiligencio,
    ]);

    return this.mapToSignedConsentEntity(rows[0]);
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
      archivoUrl: r.firmaBase64,
      idCita: 0,
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
      archivoUrl: r.firmaBase64,
      idCita: 0,
    };
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
    });
  }

  private mapToSignedConsentEntity(row: any): SignedConsent {
    return new SignedConsent({
      idConsentimientoFirmado: Number(row.id_consentimiento_firmado ?? 0),
      idConsentimiento: Number(row.id_consentimiento),
      idPaciente: Number(row.id_paciente),
      versionPlantilla: Number(row.version_plantilla ?? 1),
      textoFirmado: row.texto_firmado ?? '',
      firmaBase64: row.firma_base64 ?? row.archivo_url ?? '',
      firmaPorAcudiente: Boolean(row.firma_por_acudiente),
      nombreDocumentoAcudiente: row.nombre_documento_acudiente ?? null,
      idUsuarioDiligencio: row.id_usuario_diligencio ? Number(row.id_usuario_diligencio) : null,
      fecha: row.fecha ? new Date(row.fecha) : undefined,
    });
  }
}
