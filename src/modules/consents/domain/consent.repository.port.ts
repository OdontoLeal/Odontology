// src/modules/consents/domain/consent.repository.port.ts
import {
  ConsentTemplate,
  ConsentTemplateType,
  PatientSignedConsentDetail,
  SignedConsent,
} from './consent.entity';
import {
  CreateConsentTemplateDTO,
  SignConsentDTO,
  UpdateConsentTemplateDTO,
} from '../application/consent.dtos';

export interface IConsentRepository {
  createTemplate(dto: CreateConsentTemplateDTO): Promise<ConsentTemplate>;
  findTemplateById(idConsentimiento: number): Promise<ConsentTemplate | null>;
  updateTemplateVersion(
    idConsentimiento: number,
    dto: UpdateConsentTemplateDTO
  ): Promise<ConsentTemplate | null>;
  toggleTemplateStatus(
    idConsentimiento: number,
    estado: boolean
  ): Promise<ConsentTemplate | null>;
  findAllTemplates(onlyActive?: boolean): Promise<ConsentTemplate[]>;
  findActiveTemplateByType?(tipo: ConsentTemplateType): Promise<ConsentTemplate | null>;
  /** Fecha de nacimiento del paciente (null si no existe), para aplicar RF-CON-005. */
  findPatientBirthDate?(idPaciente: number): Promise<string | null>;
  recordSignedConsent(dto: SignConsentDTO): Promise<SignedConsent>;
  getSignedConsentsByPatient(idPaciente: number): Promise<PatientSignedConsentDetail[]>;
  findSignedConsentById?(idConsentimientoFirmado: number): Promise<PatientSignedConsentDetail | null>;
}
