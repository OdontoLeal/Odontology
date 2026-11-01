// src/modules/consents/application/consent.service.ts
import {
  ConsentTemplate,
  PatientSignedConsentDetail,
  SignedConsent,
} from '../domain/consent.entity';
import {
  ConsentConflictError,
  ConsentNotFoundError,
  ConsentValidationError,
  InactiveConsentTemplateError,
} from '../domain/consent.errors';
import { IConsentRepository } from '../domain/consent.repository.port';
import { ConsentPdfGeneratorService } from './consent-pdf-generator.service';
import {
  CreateConsentTemplateDTO,
  SignConsentDTO,
  UpdateConsentTemplateDTO,
} from './consent.dtos';

export class ConsentService {
  constructor(private readonly consentRepository: IConsentRepository) {}

  // RF-CON-004: Crear plantilla de consentimiento en versión inicial 1 y como texto en BD
  public async createTemplate(dto: CreateConsentTemplateDTO): Promise<ConsentTemplate> {
    const nombre = dto.nombre?.trim();
    const textoPlantilla = (dto.textoPlantilla ?? dto.plantillaUrl)?.trim();

    if (!nombre) {
      throw new ConsentValidationError('El nombre de la plantilla es obligatorio.');
    }

    if (!textoPlantilla) {
      throw new ConsentValidationError(
        'El texto de la plantilla (textoPlantilla) es obligatorio (RF-CON-004).'
      );
    }

    // DEF-18 & CPS-CON-004-02: No permitir crear plantillas con nombre duplicado
    const allTemplates = await this.consentRepository.findAllTemplates(false);
    const existing = allTemplates.find(
      (t) => t.nombre.trim().toLowerCase() === nombre.toLowerCase()
    );
    if (existing) {
      throw new ConsentConflictError(
        `Ya existe una plantilla de consentimiento con el nombre "${nombre}".`
      );
    }

    return this.consentRepository.createTemplate({
      nombre,
      textoPlantilla,
      version: 1, // Regla de negocio RF-CON-004: toda plantilla nueva inicia en versión 1
      idUsuarioModificador: dto.idUsuarioModificador ?? null,
    });
  }

  // RF-CON-007: Actualizar plantilla incrementando automáticamente la versión (+1)
  public async updateTemplateVersion(
    idConsentimiento: number,
    dto: UpdateConsentTemplateDTO
  ): Promise<ConsentTemplate> {
    this.validatePositiveId(idConsentimiento, 'idConsentimiento');

    const nombre = dto.nombre?.trim();
    const rawTexto = dto.textoPlantilla ?? dto.plantillaUrl;

    // DEF-18 & CPS-CON-007-02: Rechazar si se intenta dejar el texto vacío
    if (rawTexto !== undefined && rawTexto.trim().length === 0) {
      throw new ConsentValidationError('El texto de la plantilla no puede estar vacío.');
    }

    const textoPlantilla = rawTexto?.trim();

    if (!nombre && !textoPlantilla) {
      throw new ConsentValidationError(
        'Debe proporcionar al menos el nombre o el texto de la plantilla para generar una nueva versión.'
      );
    }

    if (nombre) {
      const allTemplates = await this.consentRepository.findAllTemplates(false);
      const duplicate = allTemplates.find(
        (t) =>
          t.idConsentimiento !== idConsentimiento &&
          t.nombre.trim().toLowerCase() === nombre.toLowerCase()
      );
      if (duplicate) {
        throw new ConsentConflictError(
          `Ya existe otra plantilla de consentimiento con el nombre "${nombre}".`
        );
      }
    }

    const updated = await this.consentRepository.updateTemplateVersion(idConsentimiento, {
      nombre: nombre || undefined,
      textoPlantilla: textoPlantilla || undefined,
      idUsuarioModificador: dto.idUsuarioModificador ?? null,
    });

    if (!updated) {
      throw new ConsentNotFoundError(idConsentimiento);
    }

    return updated;
  }

  // RF-CON-008: Cambiar estado Activa / Inactiva (sin eliminarla)
  public async toggleTemplateStatus(
    idConsentimiento: number,
    estado: boolean
  ): Promise<ConsentTemplate> {
    this.validatePositiveId(idConsentimiento, 'idConsentimiento');

    if (typeof estado !== 'boolean') {
      throw new ConsentValidationError('El estado de la plantilla debe ser un valor booleano.');
    }

    const updated = await this.consentRepository.toggleTemplateStatus(
      idConsentimiento,
      estado
    );

    if (!updated) {
      throw new ConsentNotFoundError(idConsentimiento);
    }

    return updated;
  }

  // Consultar catálogo de plantillas (todas o solo activas)
  public async getTemplates(onlyActive = false): Promise<ConsentTemplate[]> {
    return this.consentRepository.findAllTemplates(Boolean(onlyActive));
  }

  // RF-CON-002 & RF-CON-005: Registrar consentimiento firmado con texto consolidado y firma en texto (Base64)
  public async signConsent(dto: SignConsentDTO): Promise<SignedConsent> {
    this.validatePositiveId(dto.idConsentimiento, 'idConsentimiento');
    this.validatePositiveId(dto.idPaciente, 'idPaciente');

    const firmaBase64 = (dto.firmaBase64 ?? dto.archivoUrl)?.trim();
    if (!firmaBase64) {
      throw new ConsentValidationError(
        'El trazo de la firma manuscrita codificado (firmaBase64) es obligatorio.'
      );
    }

    // DEF-19 & CPS-CON-001-01: Evitar consentimientos firmados duplicados para la misma plantilla
    const existingSigned = await this.consentRepository.getSignedConsentsByPatient(dto.idPaciente);
    const duplicate = existingSigned.find(
      (c) => c.idConsentimiento === dto.idConsentimiento
    );
    if (duplicate) {
      throw new ConsentConflictError(
        'El paciente ya cuenta con un consentimiento informado firmado para esta plantilla.'
      );
    }

    // Verificación de integridad: la plantilla debe existir y estar activa
    const template = await this.consentRepository.findTemplateById(dto.idConsentimiento);
    if (!template) {
      throw new ConsentNotFoundError(dto.idConsentimiento);
    }

    if (!template.isActive()) {
      throw new InactiveConsentTemplateError(dto.idConsentimiento);
    }

    // DEF-20 & CPS-CON-005-01: Validar si el paciente es menor de edad (< 18 años)
    let isMinor = false;
    let acudienteNombreDoc: string | null = null;
    try {
      const { db } = await import('../../../shared/infrastructure/database/database');
      const pRes = await db.query<{ fecha_nacimiento: string | null }>(
        `SELECT fecha_nacimiento FROM public.paciente WHERE id_paciente = $1;`,
        [dto.idPaciente]
      );
      if (pRes.rows.length > 0) {
        const fn = pRes.rows[0].fecha_nacimiento;
        if (fn) {
          const birthDate = new Date(fn);
          const now = new Date();
          let age = now.getFullYear() - birthDate.getFullYear();
          const m = now.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
            age--;
          }
          isMinor = age < 18;
        }
      }
    } catch {
      // Ignorar fallo de consulta si el entorno está aislado
    }

    // Si firma por acudiente o es menor de edad, el nombre y documento del acudiente son obligatorios
    const firmaPorAcudiente = Boolean(dto.firmaPorAcudiente) || isMinor;
    const nombreDocumentoAcudiente =
      dto.nombreDocumentoAcudiente?.trim() || acudienteNombreDoc || null;

    if (isMinor && (!nombreDocumentoAcudiente || !firmaPorAcudiente)) {
      throw new ConsentValidationError(
        'Para pacientes menores de edad (menores de 18 años), es obligatoria la firma y los datos del acudiente / representante legal (RF-CON-005).'
      );
    }

    if (firmaPorAcudiente && !nombreDocumentoAcudiente) {
      throw new ConsentValidationError(
        'Debe ingresar el nombre y documento del acudiente / representante legal (RF-CON-005).'
      );
    }

    const textoFirmado = dto.textoFirmado?.trim() || template.textoPlantilla;

    return this.consentRepository.recordSignedConsent({
      idConsentimiento: dto.idConsentimiento,
      idPaciente: dto.idPaciente,
      textoFirmado,
      firmaBase64,
      firmaPorAcudiente,
      nombreDocumentoAcudiente,
      idUsuarioDiligencio: dto.idUsuarioDiligencio ?? null,
    });
  }

  // RF-CON-003: Consultar consentimientos firmados de un paciente (más reciente a más antiguo)
  public async getSignedConsentsByPatient(
    idPaciente: number
  ): Promise<PatientSignedConsentDetail[]> {
    this.validatePositiveId(idPaciente, 'idPaciente');
    return this.consentRepository.getSignedConsentsByPatient(idPaciente);
  }

  // RF-CON-003: Generar PDF en memoria uniendo texto firmado, datos del paciente y firma Base64 fusionada (flatten)
  public async generateConsentPdf(idConsentimientoFirmado: number): Promise<string> {
    this.validatePositiveId(idConsentimientoFirmado, 'idConsentimientoFirmado');
    if (!this.consentRepository.findSignedConsentById) {
      throw new Error('Método findSignedConsentById no implementado en el repositorio.');
    }
    const record = await this.consentRepository.findSignedConsentById(idConsentimientoFirmado);
    if (!record) {
      throw new ConsentValidationError(
        `No se encontró el consentimiento firmado con ID ${idConsentimientoFirmado}.`
      );
    }

    return ConsentPdfGeneratorService.generate(record);
  }

  private validatePositiveId(id: number, fieldName: string): void {
    if (!Number.isInteger(id) || id <= 0) {
      throw new ConsentValidationError(
        `El campo ${fieldName} debe ser un número entero positivo.`
      );
    }
  }
}
