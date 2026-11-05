// src/modules/consents/application/consent.service.ts
import {
  CONSENT_TEMPLATE_TYPES,
  ConsentTemplate,
  ConsentTemplateType,
  PatientSignedConsentDetail,
  SignedConsent,
} from '../domain/consent.entity';
import { formatColombiaDate } from '../../../shared/domain/colombia-format';
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
    const textoPlantilla = dto.textoPlantilla?.trim();
    const tipo: ConsentTemplateType = dto.tipo ?? 'PROCEDIMIENTO';
    if (!CONSENT_TEMPLATE_TYPES.includes(tipo)) {
      throw new ConsentValidationError('El tipo de plantilla debe ser PROCEDIMIENTO, AUTORIZACION_DATOS o MENORES.');
    }

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

    // Solo una plantilla activa de autorización de datos y una de menores (RQNF-SEG-005, RF-CON-005)
    if (tipo !== 'PROCEDIMIENTO' && this.consentRepository.findActiveTemplateByType) {
      const activa = await this.consentRepository.findActiveTemplateByType(tipo);
      if (activa) {
        throw new ConsentConflictError(
          `Ya existe una plantilla activa de tipo ${tipo} ("${activa.nombre}"). Edítela (RF-CON-007) o inactívela antes de crear otra.`
        );
      }
    }

    return this.consentRepository.createTemplate({
      nombre,
      textoPlantilla,
      tipo,
      version: 1, // RF-CON-004: toda plantilla nueva inicia en versión 1
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
    const rawTexto = dto.textoPlantilla;

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

  /**
   * RF-CON-001, RF-CON-002 y RF-CON-005 (ERS v1.3):
   * - la plantilla debe estar activa y se firma una vez por versión;
   * - el firmante marca la casilla de aceptación y firma;
   * - un menor de 18 años solo firma con la plantilla de menores y por medio de su
   *   acudiente (nombre y documento obligatorios); un adulto no usa esa plantilla.
   */
  public async signConsent(dto: SignConsentDTO): Promise<SignedConsent> {
    this.validatePositiveId(dto.idConsentimiento, 'idConsentimiento');
    this.validatePositiveId(dto.idPaciente, 'idPaciente');

    if (dto.aceptado !== true) {
      throw new ConsentValidationError('Debe marcar la casilla de aceptación del consentimiento.');
    }
    const firmaBase64 = dto.firmaBase64?.trim();
    if (!firmaBase64) {
      throw new ConsentValidationError('El recuadro de firma está en blanco: el firmante debe firmar.');
    }

    const template = await this.consentRepository.findTemplateById(dto.idConsentimiento);
    if (!template) throw new ConsentNotFoundError(dto.idConsentimiento);
    if (!template.isActive()) throw new InactiveConsentTemplateError(dto.idConsentimiento);

    // RF-CON-001: no se repite la firma de la versión vigente
    const existingSigned = await this.consentRepository.getSignedConsentsByPatient(dto.idPaciente);
    const duplicate = existingSigned.find(
      (c) => c.idConsentimiento === dto.idConsentimiento && c.versionPlantilla === template.version
    );
    if (duplicate) {
      throw new ConsentConflictError(
        `El paciente ya firmó este consentimiento el ${formatColombiaDate(new Date(duplicate.fecha))}`
      );
    }

    const fechaNacimiento = this.consentRepository.findPatientBirthDate
      ? await this.consentRepository.findPatientBirthDate(dto.idPaciente)
      : null;
    if (this.consentRepository.findPatientBirthDate && !fechaNacimiento) {
      throw new ConsentValidationError('El paciente no existe.');
    }
    const isMinor = fechaNacimiento ? ConsentService.ageFrom(fechaNacimiento) < 18 : false;

    if (isMinor && !template.isForMinors()) {
      throw new ConsentValidationError(
        'El paciente es menor de 18 años: la autorización y los consentimientos se toman con la plantilla de menores (RF-CON-005).'
      );
    }
    if (!isMinor && template.isForMinors()) {
      throw new ConsentValidationError('La plantilla de menores solo se usa con pacientes menores de 18 años.');
    }

    // Para un menor la casilla de acudiente queda marcada y no se puede desmarcar
    const firmaPorAcudiente = isMinor || Boolean(dto.firmaPorAcudiente);
    const nombreDocumentoAcudiente = dto.nombreDocumentoAcudiente?.trim() || null;
    if (firmaPorAcudiente && !nombreDocumentoAcudiente) {
      throw new ConsentValidationError('Debe ingresar el nombre y documento del acudiente / representante legal.');
    }

    return this.consentRepository.recordSignedConsent({
      idConsentimiento: dto.idConsentimiento,
      idPaciente: dto.idPaciente,
      versionPlantilla: template.version,
      textoFirmado: dto.textoFirmado?.trim() || template.textoPlantilla,
      firmaBase64,
      aceptado: true,
      firmaPorAcudiente,
      nombreDocumentoAcudiente,
      idUsuarioDiligencio: dto.idUsuarioDiligencio ?? null,
      actorCorreo: dto.actorCorreo,
    });
  }

  private static ageFrom(fechaNacimiento: string, now: Date = new Date()): number {
    const [y, m, d] = fechaNacimiento.slice(0, 10).split('-').map(Number);
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
    return age;
  }

  /** RQNF-SEG-006: plantilla vigente de autorización (aviso de privacidad público). */
  public async getCurrentPrivacyNotice(): Promise<ConsentTemplate | null> {
    return this.consentRepository.findActiveTemplateByType
      ? this.consentRepository.findActiveTemplateByType('AUTORIZACION_DATOS')
      : null;
  }

  // RF-CON-003: Consultar consentimientos firmados de un paciente (más reciente a más antiguo)
  public async getSignedConsentsByPatient(
    idPaciente: number
  ): Promise<PatientSignedConsentDetail[]> {
    this.validatePositiveId(idPaciente, 'idPaciente');
    return this.consentRepository.getSignedConsentsByPatient(idPaciente);
  }

  /** Paciente al que pertenece un consentimiento firmado (para validar el acceso antes de armar el PDF). */
  public async getSignedConsentPatientId(idConsentimientoFirmado: number): Promise<number> {
    this.validatePositiveId(idConsentimientoFirmado, 'idConsentimientoFirmado');
    const record = this.consentRepository.findSignedConsentById
      ? await this.consentRepository.findSignedConsentById(idConsentimientoFirmado)
      : null;
    if (!record) {
      throw new ConsentValidationError(`No se encontró el consentimiento firmado con ID ${idConsentimientoFirmado}.`);
    }
    return record.idPaciente;
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
