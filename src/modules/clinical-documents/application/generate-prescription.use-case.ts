import {
  ClinicalDocumentRecord,
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
  archivoPdfUrl?: string;
  actor: AuthenticatedProfessionalActor;
}

export interface GeneratePrescriptionOutput {
  documento: ClinicalDocumentRecord;
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

    const edadPaciente = SickLeaveEntity.calcularEdadEnColombia(
      contexto.paciente.fechaNacimiento
    );

    const faltaAcudienteEnMenor =
      edadPaciente < 18 &&
      (!contexto.paciente.acudiente ||
        !contexto.paciente.acudiente.nombreCompleto?.trim() ||
        !contexto.paciente.acudiente.documentoIdentidad?.trim());

    const tieneDatosIncompletos =
      !contexto.paciente.sexo ||
      !contexto.paciente.sexo.trim() ||
      faltaAcudienteEnMenor;

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
      archivoPdfUrlPreexistente: input.archivoPdfUrl,
      ahora,
    });

    const documentoGuardado = await this.clinicalDocRepo.createClinicalDocument({
      idPaciente: prescription.idPaciente,
      idCita: prescription.idCita,
      tipoDocumento: 'ORDEN_MEDICAMENTOS',
      archivoPdfUrl: resultadoPdf.archivoPdfUrl,
      modoFirma: resultadoPdf.modoFirmaAplicado,
      detalles: detallesDocumento,
      diligenciadoPor: prescription.diligenciadoPor,
    });

    return {
      documento: documentoGuardado,
      avisoFirma: resultadoPdf.aviso,
    };
  }
}