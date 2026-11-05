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

/**
 * Documento generado en memoria (RF-DOC-001 a 004). No se guarda: se entrega
 * al profesional para descargarlo o imprimirlo al momento.
 */
export interface GeneratedClinicalDocument {
  idPaciente: number;
  idCita: number;
  tipoDocumento: TipoDocumentoClinico;
  nombreArchivo: string;
  pdfBase64: string;
  modoFirma: ModoFirmaDocumento;
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
  };
  /** La consulta ya tiene la apertura con motivo de consulta (RF-HCL-005, D-24). */
  tieneApertura: boolean;
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
  getConsultationContext(idPaciente: number, idCita: number): Promise<ConsultationContextData | null>;
  /** Deja constancia de la generación (sin el PDF) en el registro de auditoría (RQNF-SEG-009). */
  recordGeneration(documento: Omit<GeneratedClinicalDocument, 'pdfBase64'>): Promise<void>;
}
