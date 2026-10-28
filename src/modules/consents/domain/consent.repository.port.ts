import {
  ConsentTemplate,
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
  recordSignedConsent(dto: SignConsentDTO): Promise<SignedConsent>;
  getSignedConsentsByPatient(idPaciente: number): Promise<PatientSignedConsentDetail[]>;
}