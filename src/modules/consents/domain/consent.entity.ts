export interface ConsentTemplateProps {
  idConsentimiento: number;
  nombre: string;
  plantillaUrl: string;
  version: number;
  tipoConsentimiento: boolean;
  estado: boolean;
}

export class ConsentTemplate {
  public readonly idConsentimiento: number;
  public readonly nombre: string;
  public readonly plantillaUrl: string;
  public readonly version: number;
  public readonly tipoConsentimiento: boolean;
  public readonly estado: boolean;

  constructor(props: ConsentTemplateProps) {
    this.idConsentimiento = props.idConsentimiento;
    this.nombre = props.nombre;
    this.plantillaUrl = props.plantillaUrl;
    this.version = props.version;
    this.tipoConsentimiento = props.tipoConsentimiento;
    this.estado = props.estado;
  }

  public isActive(): boolean {
    return this.estado === true;
  }
}

export interface SignedConsentProps {
  idConsentimiento: number;
  idPaciente: number;
  idCita: number;
  archivoUrl: string;
  fecha?: Date;
}

export class SignedConsent {
  public readonly idConsentimiento: number;
  public readonly idPaciente: number;
  public readonly idCita: number;
  public readonly archivoUrl: string;
  public readonly fecha?: Date;

  constructor(props: SignedConsentProps) {
    this.idConsentimiento = props.idConsentimiento;
    this.idPaciente = props.idPaciente;
    this.idCita = props.idCita;
    this.archivoUrl = props.archivoUrl;
    this.fecha = props.fecha;
  }
}

/**
 * Read Model optimizado para la consulta RF-CON-003 (JOIN entre consentimiento firmado y plantilla)
 */
export interface PatientSignedConsentDetail {
  idConsentimiento: number;
  nombrePlantilla: string;
  versionActualPlantilla: number;
  idPaciente: number;
  idCita: number;
  fecha: Date;
  archivoUrl: string;
}