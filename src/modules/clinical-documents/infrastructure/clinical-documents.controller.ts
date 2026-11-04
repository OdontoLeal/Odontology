import { Request, Response } from 'express';
import { db } from '../../../shared/infrastructure/database/database';
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

  // DEF-01 & CPS-DOC-005-02: Exigir sesión y segregar acceso por rol
  getPatientDocuments = async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionUser = (req as any).user;
      const headerRole = (req.headers['x-user-roles'] || req.headers['x-user-role']) as string;
      const hasAuth = Boolean(sessionUser || headerRole || req.headers['authorization']);

      if (!hasAuth) {
        res.status(401).json({
          message: 'Se requiere autenticación para consultar documentos clínicos.',
        });
        return;
      }

      const roles: string[] = Array.isArray(sessionUser?.roles)
        ? sessionUser.roles.map((r: any) => (typeof r === 'string' ? r : r.codigoRol || r.nombreRol))
        : headerRole
        ? headerRole.split(',').map((r) => r.trim())
        : [];

      const isAllowed =
        roles.includes('ROL-ODO') ||
        roles.includes('ROL-ESP') ||
        roles.includes('ROL-ADM');

      if (!isAllowed) {
        // I2-009 & RQNF-SEG-009: Registrar en auditoría intento no autorizado
        try {
          await db.query(
            `INSERT INTO log_auditoria (usuario, accion, registro_afectado, detalle) VALUES ($1, $2, $3, $4)`,
            [
              sessionUser?.correo || sessionUser?.nombreCompleto || 'Desconocido',
              'Intento no autorizado de consulta de documentos clínicos',
              `paciente:${req.params.idPaciente}`,
              JSON.stringify({ ruta: req.originalUrl, metodo: req.method, roles }),
            ]
          );
        } catch (_) {}

        // I2-009 (D-18): Mensaje canónico ERS v1.2
        res.status(403).json({
          message: 'No tiene permiso para realizar esta acción',
        });
        return;
      }

      const idPaciente = Number(req.params.idPaciente);
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
