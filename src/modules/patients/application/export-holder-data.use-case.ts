import { PatientDomainError } from '../domain/patient.entity';
import {
  HolderDataRecord,
  IPatientRepository,
} from '../domain/patient.repository.interface';
import { PdfHolderExporterService } from './pdf-holder-exporter.service';

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
  private readonly pdfExporter: IPdfHolderExporterPort;

  constructor(
    private readonly patientRepository: IPatientRepository,
    pdfExporter?: IPdfHolderExporterPort
  ) {
    this.pdfExporter = pdfExporter ?? new PdfHolderExporterService();
  }

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
      const buffer = await this.pdfExporter.generateHolderDataPdf(holderData);
      pdfBufferBase64 = buffer.toString('base64');
    }

    return {
      tituloDocumento: 'Datos personales del titular',
      fechaGeneracion: new Date().toISOString(),
      datosTitular: holderData,
      pdfBufferBase64,
    };
  }
}
