import {
  GeneratedClinicalDocument,
  IClinicalDocumentRepository,
  MedicationDetail,
  ModoFirmaDocumento,
} from '../domain/clinical-document.repository.interface';
import { PrescriptionEntity } from '../domain/prescription.entity';
import { SickLeaveEntity } from '../domain/sick-leave.entity';
import {
  AuthenticatedProfessionalActor,
  EmbedProfessionalSignatureService,
} from './embed-professional-signature.service';

export interface GeneratePrescriptionInput {
  idPaciente: number;
  idCita: number;
  medicamentos: MedicationDetail[];
  indicacionesAdicionales?: string;
  modoFirma?: ModoFirmaDocumento;
  actor: AuthenticatedProfessionalActor;
}

export interface GeneratePrescriptionOutput {
  documento: GeneratedClinicalDocument;
  avisoFirma?: string;
}

export class GeneratePrescriptionUseCase {
  constructor(
    private readonly clinicalDocRepo: IClinicalDocumentRepository,
    private readonly signatureService: EmbedProfessionalSignatureService
  ) {}

  public async execute(
    input: GeneratePrescriptionInput
  ): Promise<GeneratePrescriptionOutput> {
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

    const edadPaciente = SickLeaveEntity.calcularEdadEnColombia(
      contexto.paciente.fechaNacimiento
    );


    // "Datos incompletos": paciente creado desde una solicitud sin sexo (RF-DOC-001 a 003)
    const tieneDatosIncompletos = !contexto.paciente.sexo || !contexto.paciente.sexo.trim();

    const ahora = new Date();
    const { fechaDDMMAAAA, hora12h } =
      this.signatureService.formatearFechaHoraColombia(ahora);

    const prescription = PrescriptionEntity.create({
      idPaciente: input.idPaciente,
      idCita: input.idCita,
      pacienteNombre: contexto.paciente.nombreCompleto,
      pacienteDocumento: contexto.paciente.documentoIdentidad,
      pacienteEdad: edadPaciente,
      pacienteSexo: contexto.paciente.sexo,
      tieneDatosIncompletos,
      medicamentos: input.medicamentos,
      indicacionesAdicionales: input.indicacionesAdicionales,
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
      medicamentos: [...prescription.medicamentos],
      indicacionesAdicionales: prescription.indicacionesAdicionales,
    };

    const resultadoPdf = await this.signatureService.generarPdfConFirma({
      actor: input.actor,
      contexto,
      tipoDocumento: 'ORDEN_MEDICAMENTOS',
      pacienteEdad: prescription.pacienteEdad,
      detalles: detallesDocumento,
      modoFirma: prescription.modoFirma,
      ahora,
    });

    const documento: GeneratedClinicalDocument = {
      idPaciente: input.idPaciente,
      idCita: input.idCita,
      tipoDocumento: 'ORDEN_MEDICAMENTOS',
      nombreArchivo: resultadoPdf.nombreArchivo,
      pdfBase64: Buffer.from(resultadoPdf.pdfBytes).toString('base64'),
      modoFirma: resultadoPdf.modoFirmaAplicado,
      detalles: detallesDocumento,
      diligenciadoPor: prescription.diligenciadoPor,
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