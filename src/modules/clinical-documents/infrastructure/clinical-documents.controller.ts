// src/modules/clinical-documents/infrastructure/clinical-documents.controller.ts
import { Request, Response } from 'express';
import { handleRequestError } from '../../../shared/infrastructure/http/http-error.handler';
import {
  ACCESS_DENIED_MESSAGE,
  ForbiddenError,
  getSessionUser,
  hasPermission,
} from '../../../shared/infrastructure/security/access-control';
import { IClinicalDocumentRepository } from '../domain/clinical-document.repository.interface';
import {
  AuthenticatedProfessionalActor,
  EmbedProfessionalSignatureService,
} from '../application/embed-professional-signature.service';
import { GeneratePrescriptionUseCase } from '../application/generate-prescription.use-case';
import { GenerateSickLeaveUseCase } from '../application/generate-sick-leave.use-case';
import { GenerateReferralUseCase } from '../application/generate-referral.use-case';

const PERMISO_POR_TIPO: Record<string, string> = {
  ORDEN_MEDICAMENTOS: 'RF-DOC-001',
  INCAPACIDAD: 'RF-DOC-002',
  REMISION: 'RF-DOC-003',
};

/** Errores de negocio de los casos de uso (mensajes en español) → 400/403. */
function toHttpError(error: any): any {
  if (error?.message === ACCESS_DENIED_MESSAGE) return new ForbiddenError();
  if (error && typeof error.statusCode !== 'number') {
    return Object.assign(new Error(error.message), { statusCode: 400 });
  }
  return error;
}

/**
 * Módulo E (RF-DOC-001 a RF-DOC-004): el PDF se genera en memoria y se
 * devuelve en la respuesta (base64) para descargarlo o imprimirlo al momento.
 * El servidor no conserva el archivo ni lo expone por una dirección (D-23, D-27).
 * RF-DOC-005 (consultar documentos) se eliminó en la ERS v1.2.
 */
export class ClinicalDocumentsController {
  private readonly generatePrescriptionUseCase: GeneratePrescriptionUseCase;
  private readonly generateSickLeaveUseCase: GenerateSickLeaveUseCase;
  private readonly generateReferralUseCase: GenerateReferralUseCase;

  constructor(
    private readonly docRepo: IClinicalDocumentRepository,
    signatureService: EmbedProfessionalSignatureService = new EmbedProfessionalSignatureService()
  ) {
    this.generatePrescriptionUseCase = new GeneratePrescriptionUseCase(this.docRepo, signatureService);
    this.generateSickLeaveUseCase = new GenerateSickLeaveUseCase(this.docRepo, signatureService);
    this.generateReferralUseCase = new GenerateReferralUseCase(this.docRepo, signatureService);
  }

  generateDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = getSessionUser(req)!;
      const { idPaciente, idCita, tipoDocumento, modoFirma, detalles } = req.body ?? {};

      const permiso = PERMISO_POR_TIPO[tipoDocumento];
      if (!permiso) {
        throw Object.assign(
          new Error('Tipo de documento clínico no válido. Valores permitidos: ORDEN_MEDICAMENTOS, INCAPACIDAD, REMISION.'),
          { statusCode: 400 }
        );
      }
      if (!hasPermission(user, permiso)) throw new ForbiddenError();

      // El actor y su firma salen de la sesión: nadie inserta la firma de otro usuario (RF-DOC-004)
      const actor: AuthenticatedProfessionalActor = {
        idUsuario: user.idUsuario,
        nombreCompleto: user.nombreCompleto,
        roles: user.roles,
        firmaImagenUrl: null,
      };

      const common = { idPaciente: Number(idPaciente), idCita: Number(idCita), modoFirma, actor };
      const result =
        tipoDocumento === 'ORDEN_MEDICAMENTOS'
          ? await this.generatePrescriptionUseCase.execute({
              ...common,
              medicamentos: detalles?.medicamentos ?? [],
              indicacionesAdicionales: detalles?.indicacionesAdicionales,
            })
          : tipoDocumento === 'INCAPACIDAD'
            ? await this.generateSickLeaveUseCase.execute({
                ...common,
                diasIncapacidad: Number(detalles?.diasIncapacidad),
                motivoIncapacidad: detalles?.motivoIncapacidad ?? '',
              })
            : await this.generateReferralUseCase.execute({
                ...common,
                especialidadDestino: detalles?.especialidadDestino ?? '',
                otraEspecialidad: detalles?.otraEspecialidad,
                motivoRemision: detalles?.motivoRemision ?? '',
              });

      res.status(200).json({
        message: `Documento (${tipoDocumento}) generado. El servidor no conserva el archivo.`,
        warning: result.avisoFirma,
        data: result.documento,
      });
    } catch (error) {
      await handleRequestError(req, res, toHttpError(error), 400);
    }
  };
}
