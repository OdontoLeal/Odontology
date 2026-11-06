import {
  GeneratedClinicalDocument,
  IClinicalDocumentRepository,
  ModoFirmaDocumento,
} from '../domain/clinical-document.repository.interface';
import { SickLeaveEntity } from '../domain/sick-leave.entity';
import {
  AuthenticatedProfessionalActor,
  EmbedProfessionalSignatureService,
} from './embed-professional-signature.service';

export interface GenerateSickLeaveInput {
  idPaciente: number;
  idCita: number;
  diasIncapacidad: number;
  motivoIncapacidad: string;
  modoFirma?: ModoFirmaDocumento;
  actor: AuthenticatedProfessionalActor;
}

export interface GenerateSickLeaveOutput {
  documento: GeneratedClinicalDocument;
  avisoFirma?: string;
}

export class GenerateSickLeaveUseCase {
  constructor(
    private readonly clinicalDocRepo: IClinicalDocumentRepository,
    private readonly signatureService: EmbedProfessionalSignatureService
  ) {}

  public async execute(input: GenerateSickLeaveInput): Promise<GenerateSickLeaveOutput> {
    const contexto = await this.clinicalDocRepo.getConsultationContext(
      input.idPaciente,
      input.idCita
    );

    if (!contexto) {
      throw new Error('El paciente, la cita o su historia clínica no existen.');
    }

    this.signatureService.validarPermisoYVentanaTemporal(input.actor, contexto);

    // D-24: el documento se genera desde la historia de la consulta, que debe tener su apertura
    if (!contexto.tieneApertura) {
      throw new Error(
        'Falta registrar el motivo de consulta (apertura de la historia clínica) antes de generar documentos.'
      );
    }

    const ahora = new Date();
    const { fechaDDMMAAAA, hora12h } =
      this.signatureService.formatearFechaHoraColombia(ahora);

    const sickLeave = SickLeaveEntity.create({
      idPaciente: input.idPaciente,
      idCita: input.idCita,
      pacienteNombre: contexto.paciente.nombreCompleto,
      pacienteDocumento: contexto.paciente.documentoIdentidad,
      pacienteFechaNacimiento: contexto.paciente.fechaNacimiento,
      pacienteSexo: contexto.paciente.sexo,
      diasIncapacidad: input.diasIncapacidad,
      motivoIncapacidad: input.motivoIncapacidad,
      fechaExpedicion: ahora,
      modoFirma: input.modoFirma,
      diligenciadoPor: {
        idUsuario: input.actor.idUsuario,
        nombreProfesional: input.actor.nombreCompleto,
        fechaHoraISO: ahora.toISOString(),
        fechaFormateadaColombia: fechaDDMMAAAA,
        horaFormateadaColombia: hora12h,
      },
    });

    const detallesDocumento = {
      diasIncapacidad: sickLeave.diasIncapacidad,
      motivoIncapacidad: sickLeave.motivoIncapacidad,
      fechaInicioIncapacidad: sickLeave.fechaInicio,
      fechaFinIncapacidad: sickLeave.fechaFin,
      requiereFirmaAcudiente: sickLeave.requiereFirmaAcudiente,
    };

    const resultadoPdf = await this.signatureService.generarPdfConFirma({
      actor: input.actor,
      contexto,
      tipoDocumento: 'INCAPACIDAD',
      pacienteEdad: sickLeave.pacienteEdad,
      detalles: detallesDocumento,
      modoFirma: sickLeave.modoFirma,
      ahora,
    });

    const documento: GeneratedClinicalDocument = {
      idPaciente: input.idPaciente,
      idCita: input.idCita,
      tipoDocumento: 'INCAPACIDAD',
      nombreArchivo: resultadoPdf.nombreArchivo,
      pdfBase64: Buffer.from(resultadoPdf.pdfBytes).toString('base64'),
      modoFirma: resultadoPdf.modoFirmaAplicado,
      detalles: detallesDocumento,
      diligenciadoPor: sickLeave.diligenciadoPor,
    };

    // Solo se audita la generación; el PDF no se almacena (RF-DOC-001 a 004)
    const { pdfBase64: _omit, ...constancia } = documento;
    await this.clinicalDocRepo.recordGeneration(constancia);

    return {
      documento,
      avisoFirma: resultadoPdf.aviso,
    };
  }
}