import { Request, Response } from 'express';
import { IClinicalDocumentRepository } from '../domain/clinical-document.repository.interface';
import {
  AuthenticatedProfessionalActor,
  EmbedProfessionalSignatureService,
} from '../application/embed-professional-signature.service';
import { GeneratePrescriptionUseCase } from '../application/generate-prescription.use-case';
import { GenerateSickLeaveUseCase } from '../application/generate-sick-leave.use-case';
import { GenerateReferralUseCase } from '../application/generate-referral.use-case';
import { GetClinicalDocumentsUseCase } from '../application/get-clinical-documents.use-case';

export class ClinicalDocumentsController {
  private readonly generatePrescriptionUseCase: GeneratePrescriptionUseCase;
  private readonly generateSickLeaveUseCase: GenerateSickLeaveUseCase;
  private readonly generateReferralUseCase: GenerateReferralUseCase;
  private readonly getClinicalDocumentsUseCase: GetClinicalDocumentsUseCase;

  constructor(
    private readonly docRepo: IClinicalDocumentRepository,
    signatureService: EmbedProfessionalSignatureService = new EmbedProfessionalSignatureService()
  ) {
    this.generatePrescriptionUseCase = new GeneratePrescriptionUseCase(
      this.docRepo,
      signatureService
    );
    this.generateSickLeaveUseCase = new GenerateSickLeaveUseCase(
      this.docRepo,
      signatureService
    );
    this.generateReferralUseCase = new GenerateReferralUseCase(
      this.docRepo,
      signatureService
    );
    this.getClinicalDocumentsUseCase = new GetClinicalDocumentsUseCase(this.docRepo);
  }

  generateDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        idPaciente,
        idCita,
        tipoDocumento,
        archivoPdfUrl,
        modoFirma,
        detalles,
        diligenciadoPor,
      } = req.body;

      const sessionUser = (req as any).user;
      const actor: AuthenticatedProfessionalActor = {
        idUsuario: sessionUser?.idUsuario ?? diligenciadoPor?.idUsuario,
        nombreCompleto:
          sessionUser?.nombreCompleto ?? diligenciadoPor?.nombreProfesional ?? '',
        roles: sessionUser?.roles ?? ['ROL-ODO'],
        firmaImagenUrl: sessionUser?.firmaImagenUrl ?? null,
      };

      if (tipoDocumento === 'ORDEN_MEDICAMENTOS') {
        const result = await this.generatePrescriptionUseCase.execute({
          idPaciente: Number(idPaciente),
          idCita: Number(idCita),
          medicamentos: detalles?.medicamentos ?? [],
          indicacionesAdicionales: detalles?.indicacionesAdicionales,
          modoFirma,
          archivoPdfUrl,
          actor,
        });

        res.status(201).json({
          message: `Documento (${tipoDocumento}) generado exitosamente.`,
          warning: result.avisoFirma,
          data: result.documento,
        });
        return;
      }

      if (tipoDocumento === 'INCAPACIDAD') {
        const result = await this.generateSickLeaveUseCase.execute({
          idPaciente: Number(idPaciente),
          idCita: Number(idCita),
          diasIncapacidad: Number(detalles?.diasIncapacidad),
          motivoIncapacidad: detalles?.motivoIncapacidad ?? '',
          modoFirma,
          archivoPdfUrl,
          actor,
        });

        res.status(201).json({
          message: `Documento (${tipoDocumento}) generado exitosamente.`,
          warning: result.avisoFirma,
          data: result.documento,
        });
        return;
      }

      if (tipoDocumento === 'REMISION') {
        const result = await this.generateReferralUseCase.execute({
          idPaciente: Number(idPaciente),
          idCita: Number(idCita),
          especialidadDestino: detalles?.especialidadDestino ?? '',
          otraEspecialidad: detalles?.otraEspecialidad,
          motivoRemision: detalles?.motivoRemision ?? '',
          modoFirma,
          archivoPdfUrl,
          actor,
        });

        res.status(201).json({
          message: `Documento (${tipoDocumento}) generado exitosamente.`,
          warning: result.avisoFirma,
          data: result.documento,
        });
        return;
      }

      res.status(400).json({
        message:
          'Campo [tipoDocumento]: Tipo de documento clínico no válido. Valores permitidos: ORDEN_MEDICAMENTOS, INCAPACIDAD, REMISION.',
      });
    } catch (error: any) {
      const status =
        error.message === 'No tiene permiso para realizar esta acción' ? 403 : 400;
      res.status(status).json({ message: error.message });
    }
  };

  getPatientDocuments = async (req: Request, res: Response): Promise<void> => {
    try {
      const idPaciente = Number(req.params.idPaciente);
      const sessionUser = (req as any).user;

      const roles: string[] =
        sessionUser?.roles ??
        (req.headers['x-user-roles']
          ? String(req.headers['x-user-roles'])
              .split(',')
              .map((r) => r.trim())
          : ['ROL-ODO']);

      const result = await this.getClinicalDocumentsUseCase.execute({
        idPaciente,
        actor: {
          idUsuario: Number(sessionUser?.idUsuario ?? 0),
          roles,
        },
      });

      if (result.data.length === 0) {
        res.status(404).json({
          message: result.message,
          data: [],
        });
        return;
      }

      res.json({ data: result.data });
    } catch (error: any) {
      if (error.message === 'No tiene permiso para realizar esta acción') {
        res.status(403).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: error.message });
    }
  };
}