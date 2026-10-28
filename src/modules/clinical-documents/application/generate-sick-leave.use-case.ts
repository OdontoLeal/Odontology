import {
  ClinicalDocumentRecord,
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
  archivoPdfUrl?: string;
  actor: AuthenticatedProfessionalActor;
}

export interface GenerateSickLeaveOutput {
  documento: ClinicalDocumentRecord;
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
      acudiente: contexto.paciente.acudiente,
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
      acudiente: sickLeave.acudiente,
      requiereFirmaAcudiente: sickLeave.requiereFirmaAcudiente,
    };

    const resultadoPdf = await this.signatureService.generarPdfConFirma({
      actor: input.actor,
      contexto,
      tipoDocumento: 'INCAPACIDAD',
      pacienteEdad: sickLeave.pacienteEdad,
      detalles: detallesDocumento,
      modoFirma: sickLeave.modoFirma,
      archivoPdfUrlPreexistente: input.archivoPdfUrl,
      ahora,
    });

    const documentoGuardado = await this.clinicalDocRepo.createClinicalDocument({
      idPaciente: sickLeave.idPaciente,
      idCita: sickLeave.idCita,
      tipoDocumento: 'INCAPACIDAD',
      archivoPdfUrl: resultadoPdf.archivoPdfUrl,
      modoFirma: resultadoPdf.modoFirmaAplicado,
      detalles: detallesDocumento,
      diligenciadoPor: sickLeave.diligenciadoPor,
    });

    return {
      documento: documentoGuardado,
      avisoFirma: resultadoPdf.aviso,
    };
  }
}