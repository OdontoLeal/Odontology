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
  plantilla_url: string;
  version: number;
  tipo_consentimiento: boolean;
  estado: boolean;
}

interface SignedConsentRow {
  id_consentimiento: number;
  id_paciente: number;
  id_cita: number;
  archivo_url: string;
  fecha?: Date;
}

export class ConsentRepository implements IConsentRepository {
  // RF-CON-004: Crear plantilla de consentimiento
  public async createTemplate(dto: CreateConsentTemplateDTO): Promise<ConsentTemplate> {
    const sql = `
      INSERT INTO public.plantilla_consentimiento (nombre, plantilla_url, version, tipo_consentimiento, estado)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [
      dto.nombre,
      dto.plantillaUrl,
      dto.version ?? 1,
      dto.tipoConsentimiento,
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
    const sql = `
      UPDATE public.plantilla_consentimiento
      SET 
        nombre = COALESCE($1, nombre),
        plantilla_url = COALESCE($2, plantilla_url),
        version = version + 1
      WHERE id_consentimiento = $3
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [
      dto.nombre ?? null,
      dto.plantillaUrl ?? null,
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
      SET estado = $1
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

  // RF-CON-002: Registrar consentimiento firmado en PDF inmutable
  public async recordSignedConsent(dto: SignConsentDTO): Promise<SignedConsent> {
    const sql = `
      INSERT INTO public.consentimiento_firmado (id_consentimiento, id_paciente, id_cita, archivo_url)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [
      dto.idConsentimiento,
      dto.idPaciente,
      dto.idCita,
      dto.archivoUrl,
    ]);

    return this.mapToSignedConsentEntity(rows[0]);
  }

  // RF-CON-003: Consultar consentimientos firmados de un paciente (más reciente a más antiguo)
  public async getSignedConsentsByPatient(
    idPaciente: number
  ): Promise<PatientSignedConsentDetail[]> {
    const sql = `
      SELECT 
        cf.id_consentimiento AS "idConsentimiento",
        pc.nombre AS "nombrePlantilla",
        pc.version AS "versionActualPlantilla",
        cf.id_paciente AS "idPaciente",
        cf.id_cita AS "idCita",
        cf.fecha,
        cf.archivo_url AS "archivoUrl"
      FROM public.consentimiento_firmado cf
      INNER JOIN public.plantilla_consentimiento pc ON cf.id_consentimiento = pc.id_consentimiento
      WHERE cf.id_paciente = $1
      ORDER BY cf.fecha DESC;
    `;
    const { rows } = await db.query(sql, [idPaciente]);
    return rows;
  }

  private mapToTemplateEntity(row: TemplateRow): ConsentTemplate {
    return new ConsentTemplate({
      idConsentimiento: Number(row.id_consentimiento),
      nombre: row.nombre,
      plantillaUrl: row.plantilla_url,
      version: Number(row.version),
      tipoConsentimiento: Boolean(row.tipo_consentimiento),
      estado: Boolean(row.estado),
    });
  }

  private mapToSignedConsentEntity(row: SignedConsentRow): SignedConsent {
    return new SignedConsent({
      idConsentimiento: Number(row.id_consentimiento),
      idPaciente: Number(row.id_paciente),
      idCita: Number(row.id_cita),
      archivoUrl: row.archivo_url,
      fecha: row.fecha ? new Date(row.fecha) : undefined,
    });
  }
}