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
import {
  CreateConsentTemplateDTO,
  SignConsentDTO,
  UpdateConsentTemplateDTO,
} from './consent.dtos';

export class ConsentService {
  constructor(private readonly consentRepository: IConsentRepository) {}

  // RF-CON-004: Crear plantilla de consentimiento en versión inicial 1
  public async createTemplate(dto: CreateConsentTemplateDTO): Promise<ConsentTemplate> {
    const nombre = dto.nombre?.trim();
    const plantillaUrl = dto.plantillaUrl?.trim();

    if (!nombre) {
      throw new ConsentValidationError('El nombre de la plantilla es obligatorio.');
    }

    if (!plantillaUrl) {
      throw new ConsentValidationError('La URL de la plantilla (plantillaUrl) es obligatoria.');
    }

    if (typeof dto.tipoConsentimiento !== 'boolean') {
      throw new ConsentValidationError(
        'El campo tipoConsentimiento debe ser un valor booleano.'
      );
    }

    return this.consentRepository.createTemplate({
      nombre,
      plantillaUrl,
      version: 1, // Regla de negocio RF-CON-004: toda plantilla nueva inicia en versión 1
      tipoConsentimiento: dto.tipoConsentimiento,
    });
  }

  // RF-CON-007: Actualizar plantilla incrementando automáticamente la versión (+1)
  public async updateTemplateVersion(
    idConsentimiento: number,
    dto: UpdateConsentTemplateDTO
  ): Promise<ConsentTemplate> {
    this.validatePositiveId(idConsentimiento, 'idConsentimiento');

    const nombre = dto.nombre?.trim();
    const plantillaUrl = dto.plantillaUrl?.trim();

    if (!nombre && !plantillaUrl) {
      throw new ConsentValidationError(
        'Debe proporcionar al menos el nombre o la URL de la plantilla para generar una nueva versión.'
      );
    }

    const updated = await this.consentRepository.updateTemplateVersion(idConsentimiento, {
      nombre: nombre || undefined,
      plantillaUrl: plantillaUrl || undefined,
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

  // RF-CON-002: Registrar consentimiento firmado en PDF inmutable
  public async signConsent(dto: SignConsentDTO): Promise<SignedConsent> {
    this.validatePositiveId(dto.idConsentimiento, 'idConsentimiento');
    this.validatePositiveId(dto.idPaciente, 'idPaciente');
    this.validatePositiveId(dto.idCita, 'idCita');

    const archivoUrl = dto.archivoUrl?.trim();
    if (!archivoUrl) {
      throw new ConsentValidationError(
        'La URL del documento PDF firmado (archivoUrl) es obligatoria.'
      );
    }

    // Verificación de integridad de negocio: la plantilla debe existir y estar activa
    const template = await this.consentRepository.findTemplateById(dto.idConsentimiento);
    if (!template) {
      throw new ConsentNotFoundError(dto.idConsentimiento);
    }

    if (!template.isActive()) {
      throw new InactiveConsentTemplateError(dto.idConsentimiento);
    }

    return this.consentRepository.recordSignedConsent({
      idConsentimiento: dto.idConsentimiento,
      idPaciente: dto.idPaciente,
      idCita: dto.idCita,
      archivoUrl,
    });
  }

  // RF-CON-003: Consultar consentimientos firmados de un paciente (más reciente a más antiguo)
  public async getSignedConsentsByPatient(
    idPaciente: number
  ): Promise<PatientSignedConsentDetail[]> {
    this.validatePositiveId(idPaciente, 'idPaciente');
    return this.consentRepository.getSignedConsentsByPatient(idPaciente);
  }

  private validatePositiveId(id: number, fieldName: string): void {
    if (!Number.isInteger(id) || id <= 0) {
      throw new ConsentValidationError(
        `El identificador '${fieldName}' debe ser un número entero positivo.`
      );
    }
  }
}