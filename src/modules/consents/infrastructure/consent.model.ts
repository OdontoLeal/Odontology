// src/modules/consents/infrastructure/consent.model.ts

export interface CreateConsentTemplateDTO {
  nombre: string;
  textoPlantilla?: string;
  plantillaUrl?: string;
  version?: number;
  tipoConsentimiento?: boolean;
  idUsuarioModificador?: number | null;
}

export interface SignConsentDTO {
  idConsentimiento: number;
  idPaciente: number;
  textoFirmado?: string;
  firmaBase64?: string;
  firmaPorAcudiente?: boolean;
  nombreDocumentoAcudiente?: string | null;
  idUsuarioDiligencio?: number | null;
  idCita?: number;
  archivoUrl?: string;
}

export interface TemplateRow {
  id_consentimiento: number;
  nombre: string;
  texto_plantilla: string;
  version: number;
  estado: boolean;
  id_usuario_modificador?: number | null;
  fecha_modificacion?: Date | string;
}

export interface SignedConsentRow {
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
