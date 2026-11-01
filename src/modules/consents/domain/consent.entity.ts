// src/modules/consents/domain/consent.entity.ts

export interface ConsentTemplateProps {
  idConsentimiento: number;
  nombre: string;
  textoPlantilla?: string;
  plantillaUrl?: string;
  version: number;
  estado: boolean;
  idUsuarioModificador?: number | null;
  fechaModificacion?: Date | string;
  tipoConsentimiento?: boolean;
}

export class ConsentTemplate {
  public readonly idConsentimiento: number;
  public readonly nombre: string;
  public readonly textoPlantilla: string;
  public readonly version: number;
  public readonly estado: boolean;
  public readonly idUsuarioModificador: number | null;
  public readonly fechaModificacion?: Date | string;

  constructor(props: ConsentTemplateProps) {
    this.idConsentimiento = props.idConsentimiento;
    this.nombre = props.nombre;
    this.textoPlantilla = props.textoPlantilla ?? props.plantillaUrl ?? '';
    this.version = props.version;
    this.estado = props.estado;
    this.idUsuarioModificador = props.idUsuarioModificador ?? null;
    this.fechaModificacion = props.fechaModificacion;
  }

  // Compatibilidad hacia atrás:
  public get plantillaUrl(): string {
    return this.textoPlantilla;
  }

  public get tipoConsentimiento(): boolean {
    return true;
  }

  public isActive(): boolean {
    return this.estado === true;
  }
}

export interface SignedConsentProps {
  idConsentimientoFirmado?: number;
  idConsentimiento: number;
  idPaciente: number;
  versionPlantilla: number;
  textoFirmado: string;
  firmaBase64: string;
  firmaPorAcudiente: boolean;
  nombreDocumentoAcudiente?: string | null;
  idUsuarioDiligencio?: number | null;
  fecha?: Date;
  // Campos heredados opcionales para compatibilidad:
  idCita?: number;
  archivoUrl?: string;
}

export class SignedConsent {
  public readonly idConsentimientoFirmado?: number;
  public readonly idConsentimiento: number;
  public readonly idPaciente: number;
  public readonly versionPlantilla: number;
  public readonly textoFirmado: string;
  public readonly firmaBase64: string;
  public readonly firmaPorAcudiente: boolean;
  public readonly nombreDocumentoAcudiente: string | null;
  public readonly idUsuarioDiligencio: number | null;
  public readonly fecha?: Date;

  constructor(props: SignedConsentProps) {
    this.idConsentimientoFirmado = props.idConsentimientoFirmado;
    this.idConsentimiento = props.idConsentimiento;
    this.idPaciente = props.idPaciente;
    this.versionPlantilla = props.versionPlantilla ?? 1;
    this.textoFirmado = props.textoFirmado ?? '';
    this.firmaBase64 = props.firmaBase64 ?? props.archivoUrl ?? '';
    this.firmaPorAcudiente = Boolean(props.firmaPorAcudiente);
    this.nombreDocumentoAcudiente = props.nombreDocumentoAcudiente ?? null;
    this.idUsuarioDiligencio = props.idUsuarioDiligencio ?? null;
    this.fecha = props.fecha;
  }

  // Compatibilidad hacia atrás:
  public get idCita(): number {
    return 0;
  }

  public get archivoUrl(): string {
    return this.firmaBase64;
  }
}

/**
 * Read Model optimizado para la consulta RF-CON-003 (JOIN entre consentimiento firmado, plantilla y usuario)
 */
export interface PatientSignedConsentDetail {
  idConsentimientoFirmado: number;
  idConsentimiento: number;
  nombrePlantilla: string;
  versionPlantilla: number;
  versionActualPlantilla: number;
  idPaciente: number;
  pacienteNombre?: string;
  pacienteDocumento?: string;
  fecha: Date;
  textoFirmado: string;
  firmaBase64: string;
  firmaPorAcudiente: boolean;
  nombreDocumentoAcudiente?: string | null;
  idUsuarioDiligencio?: number | null;
  usuarioDiligencioNombre?: string | null;
  // Compatibilidad:
  archivoUrl?: string;
  idCita?: number;
}
