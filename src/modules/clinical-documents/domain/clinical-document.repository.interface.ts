export type TipoDocumentoClinico = 'ORDEN_MEDICAMENTOS' | 'INCAPACIDAD' | 'REMISION';

export type ModoFirmaDocumento = 'CON_FIRMA_REGISTRADA' | 'FIRMA_MANUSCRITA';

export interface MedicationDetail {
  nombrePresentacion: string;
  dosis: string;
  frecuencia: string;
  duracion: string;
}

export interface GuardianDetail {
  nombreCompleto: string;
  documentoIdentidad: string;
  parentesco: string;
  telefono?: string;
}

export interface ClinicalDocumentDetails {
  // RF-DOC-001: Orden de medicamentos
  medicamentos?: MedicationDetail[];
  indicacionesAdicionales?: string;
  // RF-DOC-002: Incapacidad
  diasIncapacidad?: number;
  motivoIncapacidad?: string;
  fechaInicioIncapacidad?: string; // Formato DD/MM/AAAA
  fechaFinIncapacidad?: string;    // Formato DD/MM/AAAA
  acudiente?: GuardianDetail;
  requiereFirmaAcudiente?: boolean;
  // RF-DOC-003: Remisión
  especialidadDestino?: string;
  motivoRemision?: string;
}

export interface AuthorshipMetadata {
  idUsuario: number;
  nombreProfesional: string;
  fechaHoraISO?: string;
  fechaFormateadaColombia?: string;
  horaFormateadaColombia?: string;
}

export interface CreateClinicalDocumentDTO {
  idPaciente: number;
  idCita: number;
  tipoDocumento: TipoDocumentoClinico;
  archivoPdfUrl: string;
  modoFirma: ModoFirmaDocumento;
  detalles: ClinicalDocumentDetails;
  diligenciadoPor: AuthorshipMetadata;
}

export interface ClinicalDocumentRecord {
  idDocumento: number;
  fecha: Date | string;
  idCita: number;
  tipoDocumento: TipoDocumentoClinico;
  archivoPdfUrl: string;
  modoFirma?: ModoFirmaDocumento;
  detalles: ClinicalDocumentDetails;
  diligenciadoPor: AuthorshipMetadata;
}

export interface ConsultationContextData {
  paciente: {
    idPaciente: number;
    nombreCompleto: string;
    documentoIdentidad: string;
    fechaNacimiento: Date | string;
    sexo: string | null;
    idHistoria: number;
    acudiente?: GuardianDetail | null;
  };
  cita: {
    idCita: number;
    idProfesionalResponsable: number;
    nombreProfesionalResponsable: string;
    firmaProfesionalUrl?: string | null;
    estado: string;
    fechaInicioCita?: Date | string | null;
  };
}

export interface IClinicalDocumentRepository {
  createClinicalDocument(dto: CreateClinicalDocumentDTO): Promise<ClinicalDocumentRecord>;
  getDocumentsByPatient(idPaciente: number): Promise<ClinicalDocumentRecord[]>;
  getConsultationContext(idPaciente: number, idCita: number): Promise<ConsultationContextData | null>;
  hasActiveConsultationForPatient(idPaciente: number): Promise<boolean>;
}