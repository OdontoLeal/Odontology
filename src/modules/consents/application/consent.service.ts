// src/modules/consents/application/consent.service.ts
import {
  ConsentTemplate,
  PatientSignedConsentDetail,
  SignedConsent,
} from '../domain/consent.entity';
import {
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
    const textoPlantilla = (dto.textoPlantilla ?? dto.plantillaUrl)?.trim();

    if (!nombre && !textoPlantilla) {
      throw new ConsentValidationError(
        'Debe proporcionar al menos el nombre o el texto de la plantilla para generar una nueva versión.'
      );
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

    // RF-CON-005: Si firma en calidad de acudiente, el nombre y documento del acudiente son obligatorios
    const firmaPorAcudiente = Boolean(dto.firmaPorAcudiente);
    const nombreDocumentoAcudiente = dto.nombreDocumentoAcudiente?.trim() || null;
    if (firmaPorAcudiente && !nombreDocumentoAcudiente) {
      throw new ConsentValidationError(
        'Debe ingresar el nombre y documento del acudiente / representante legal (RF-CON-005).'
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
