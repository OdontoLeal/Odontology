export interface CreateConsentTemplateDTO {
  nombre: string;
  plantillaUrl: string;
  version?: number;
  tipoConsentimiento: boolean;
}

export interface UpdateConsentTemplateDTO {
  nombre?: string;
  plantillaUrl?: string;
}

export interface ToggleConsentStatusDTO {
  estado: boolean;
}

export interface SignConsentDTO {
  idConsentimiento: number;
  idPaciente: number;
  idCita: number;
  archivoUrl: string;
}