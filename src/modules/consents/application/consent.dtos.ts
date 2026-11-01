// src/modules/consents/application/consent.dtos.ts

export interface CreateConsentTemplateDTO {
  nombre: string;
  textoPlantilla?: string;
  plantillaUrl?: string;
  version?: number;
  tipoConsentimiento?: boolean;
  idUsuarioModificador?: number | null;
}

export interface UpdateConsentTemplateDTO {
  nombre?: string;
  textoPlantilla?: string;
  plantillaUrl?: string;
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
  firmaPorAcudiente?: boolean;
  nombreDocumentoAcudiente?: string | null;
  idUsuarioDiligencio?: number | null;
  // Campos de compatibilidad opcionales:
  idCita?: number;
  archivoUrl?: string;
}
