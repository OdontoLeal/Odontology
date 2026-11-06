// src/modules/consents/application/consent.dtos.ts
import { ConsentTemplateType } from '../domain/consent.entity';

export interface CreateConsentTemplateDTO {
  nombre: string;
  textoPlantilla?: string;
  version?: number;
  tipo?: ConsentTemplateType;
  idUsuarioModificador?: number | null;
}

export interface UpdateConsentTemplateDTO {
  nombre?: string;
  textoPlantilla?: string;
  idUsuarioModificador?: number | null;
}

export interface ToggleConsentStatusDTO {
  estado: boolean;
}

export interface SignConsentDTO {
  idConsentimiento: number;
  idPaciente: number;
  textoFirmado?: string;
  firmaBase64?: string;
  /** RF-CON-002: casilla de aceptación marcada por el firmante. */
  aceptado?: boolean;
  firmaPorAcudiente?: boolean;
  nombreDocumentoAcudiente?: string | null;
  /** Usuario de la sesión que toma el consentimiento ("Diligenciado por"). */
  idUsuarioDiligencio?: number | null;
  actorCorreo?: string;
  /** Versión vigente de la plantilla que se firma (la asigna el servicio). */
  versionPlantilla?: number;
}
