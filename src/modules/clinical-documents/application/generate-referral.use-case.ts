import {
  ClinicalDocumentRecord,
  IClinicalDocumentRepository,
  ModoFirmaDocumento,
} from '../domain/clinical-document.repository.interface';
import { ReferralEntity } from '../domain/referral.entity';
import { SickLeaveEntity } from '../domain/sick-leave.entity';
import {
  AuthenticatedProfessionalActor,
  EmbedProfessionalSignatureService,
} from './embed-professional-signature.service';

export interface GenerateReferralInput {
  idPaciente: number;
  idCita: number;
  especialidadDestino: string;
  otraEspecialidad?: string;
  motivoRemision: string;
  modoFirma?: ModoFirmaDocumento;
  archivoPdfUrl?: string;
  actor: AuthenticatedProfessionalActor;
}

export interface GenerateReferralOutput {
  documento: ClinicalDocumentRecord;
  avisoFirma?: string;
}

export class GenerateReferralUseCase {
  constructor(
    private readonly clinicalDocRepo: IClinicalDocumentRepository,
    private readonly signatureService: EmbedProfessionalSignatureService
  ) {}

  public async execute(input: GenerateReferralInput): Promise<GenerateReferralOutput> {
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

    const referral = ReferralEntity.create({
      idPaciente: input.idPaciente,
      idCita: input.idCita,
      pacienteNombre: contexto.paciente.nombreCompleto,
      pacienteDocumento: contexto.paciente.documentoIdentidad,
      pacienteEdad: edadPaciente,
      pacienteSexo: contexto.paciente.sexo,
      tieneDatosIncompletos,
      especialidadSeleccionada: input.especialidadDestino,
      otraEspecialidad: input.otraEspecialidad,
      motivoRemision: input.motivoRemision,
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
      especialidadDestino: referral.especialidadDestino,
      motivoRemision: referral.motivoRemision,
    };

    const resultadoPdf = await this.signatureService.generarPdfConFirma({
      actor: input.actor,
      contexto,
      tipoDocumento: 'REMISION',
      pacienteEdad: referral.pacienteEdad,
      detalles: detallesDocumento,
      modoFirma: referral.modoFirma,
      archivoPdfUrlPreexistente: input.archivoPdfUrl,
      ahora,
    });

    const documentoGuardado = await this.clinicalDocRepo.createClinicalDocument({
      idPaciente: referral.idPaciente,
      idCita: referral.idCita,
      tipoDocumento: 'REMISION',
      archivoPdfUrl: resultadoPdf.archivoPdfUrl,
      modoFirma: resultadoPdf.modoFirmaAplicado,
      detalles: detallesDocumento,
      diligenciadoPor: referral.diligenciadoPor,
    });

    return {
      documento: documentoGuardado,
      avisoFirma: resultadoPdf.aviso,
    };
  }
}