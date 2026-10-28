import { PatientDomainError } from '../domain/patient.entity';
import {
  HolderDataRecord,
  IPatientRepository,
} from '../domain/patient.repository.interface';

export interface ExportHolderDataInput {
  documentoIdentidad: string;
  requesterRoles: string[];
  formato?: 'JSON' | 'PDF';
}

export interface ExportHolderDataOutput {
  tituloDocumento: string;
  fechaGeneracion: string;
  datosTitular: HolderDataRecord;
  pdfBufferBase64?: string;
}

export interface IPdfHolderExporterPort {
  generateHolderDataPdf(data: HolderDataRecord): Promise<Buffer>;
}

export class ExportHolderDataUseCase {
  private static readonly ALLOWED_ROLES = ['ROL-COA', 'ROL-ADM'];

  constructor(
    private readonly patientRepository: IPatientRepository,
    private readonly pdfExporter?: IPdfHolderExporterPort
  ) {}

  public async execute(
    input: ExportHolderDataInput
  ): Promise<ExportHolderDataOutput> {
    // RQNF-SEG-003 y RF-HCL-010: Solo ROL-COA y ROL-ADM pueden consultar/descargar datos del titular
    const hasPermission = (input.requesterRoles ?? []).some((role) =>
      ExportHolderDataUseCase.ALLOWED_ROLES.includes(role)
    );

    if (!hasPermission) {
      throw new PatientDomainError(
        'permisos',
        'No tiene permiso para realizar esta acción',
        403
      );
    }

    const documento = input.documentoIdentidad?.trim();
    if (!documento) {
      throw new PatientDomainError(
        'documentoIdentidad',
        'Debe ingresar el número de documento de identidad del titular.',
        400
      );
    }

    const holderData =
      await this.patientRepository.getHolderDataByDocument(documento);

    if (!holderData) {
      throw new PatientDomainError(
        'documentoIdentidad',
        'ninguna coincidencia encontrada',
        404
      );
    }

    let pdfBufferBase64: string | undefined;
    if (input.formato === 'PDF') {
      if (this.pdfExporter) {
        const buffer = await this.pdfExporter.generateHolderDataPdf(holderData);
        pdfBufferBase64 = buffer.toString('base64');
      } else {
        pdfBufferBase64 = this.buildFallbackPdfBase64(holderData);
      }
    }

    return {
      tituloDocumento: 'Datos personales del titular',
      fechaGeneracion: new Date().toISOString(),
      datosTitular: holderData,
      pdfBufferBase64,
    };
  }

  private buildFallbackPdfBase64(data: HolderDataRecord): string {
    const summaryText = [
      'CONSULTORIO ODONTOLOGICO DR. EDUAR LEAL ALVAREZ - ODONTOLEAL',
      'DOCUMENTO: DATOS PERSONALES DEL TITULAR (Ley 1581 de 2012 - RF-HCL-010)',
      `Documento consultado: ${data.documentoConsultado}`,
      `Como Paciente: ${
        data.calidades.comoPaciente
          ? `${data.calidades.comoPaciente.nombreCompleto} | Tel: ${
              data.calidades.comoPaciente.telefono ?? 'N/A'
            } | Correo: ${data.calidades.comoPaciente.correo ?? 'N/A'}`
          : 'No registrado como paciente'
      }`,
      `Como Acudiente (Menores representados): ${
        data.calidades.comoAcudiente.length > 0
          ? data.calidades.comoAcudiente
              .map(
                (a) => `${a.nombreMenorRepresentado} (${a.parentescoConMenor})`
              )
              .join(', ')
          : 'Ninguno'
      }`,
      `Solicitudes registradas: ${data.calidades.comoSolicitante.length}`,
      `Citas registradas (sin datos clinicos): ${data.citasRegistradas.length}`,
    ].join('\n');

    return Buffer.from(summaryText, 'utf-8').toString('base64');
  }
}