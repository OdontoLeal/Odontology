// src/modules/consents/infrastructure/consents.controller.ts
import { Request, Response } from 'express';
import { ConsentService } from '../application/consent.service';
import { ConsentDomainError } from '../domain/consent.errors';

export class ConsentsController {
  constructor(private readonly consentService: ConsentService) {}

  public createTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { nombre, textoPlantilla, plantillaUrl } = req.body;
      const idUsuario = (req as any).user?.idUsuario ?? null;
      const created = await this.consentService.createTemplate({
        nombre,
        textoPlantilla: textoPlantilla ?? plantillaUrl,
        idUsuarioModificador: idUsuario,
      });
      res.status(201).json({
        message: 'Plantilla creada en versión 1.',
        data: created,
      });
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public updateTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const { nombre, textoPlantilla, plantillaUrl } = req.body;
      const idUsuario = (req as any).user?.idUsuario ?? null;
      const updated = await this.consentService.updateTemplateVersion(id, {
        nombre,
        textoPlantilla: textoPlantilla ?? plantillaUrl,
        idUsuarioModificador: idUsuario,
      });
      res.status(200).json({
        message: 'Nueva versión de plantilla generada.',
        data: updated,
      });
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public toggleStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const { estado } = req.body;
      const updated = await this.consentService.toggleTemplateStatus(id, Boolean(estado));
      res.status(200).json({
        message: 'Estado de plantilla actualizado.',
        data: updated,
      });
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public getTemplates = async (req: Request, res: Response): Promise<void> => {
    try {
      const onlyActive = req.query.activas === 'true';
      const templates = await this.consentService.getTemplates(onlyActive);
      res.status(200).json({ data: templates });
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public signConsent = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        idConsentimiento,
        idPaciente,
        textoFirmado,
        firmaBase64,
        firmaPorAcudiente,
        nombreDocumentoAcudiente,
        archivoUrl,
        idCita,
      } = req.body;
      const idUsuarioDiligencio =
        (req as any).user?.idUsuario ?? req.body.idUsuarioDiligencio ?? null;

      const signed = await this.consentService.signConsent({
        idConsentimiento: Number(idConsentimiento),
        idPaciente: Number(idPaciente),
        textoFirmado,
        firmaBase64: firmaBase64 ?? archivoUrl,
        firmaPorAcudiente: Boolean(firmaPorAcudiente),
        nombreDocumentoAcudiente,
        idUsuarioDiligencio,
        idCita: idCita ? Number(idCita) : undefined,
        archivoUrl,
      });
      res.status(201).json({
        message: 'Consentimiento firmado guardado exitosamente.',
        data: signed,
      });
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public getPatientConsents = async (req: Request, res: Response): Promise<void> => {
    try {
      const idPaciente = Number(req.params.idPaciente);
      const consents = await this.consentService.getSignedConsentsByPatient(idPaciente);
      res.status(200).json({ data: consents });
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public getConsentPdf = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const pdfBase64 = await this.consentService.generateConsentPdf(id);
      res.status(200).json({
        data: {
          idConsentimientoFirmado: id,
          pdfBase64,
        },
      });
    } catch (error) {
      this.handleError(res, error);
    }
  };

  private handleError(res: Response, error: unknown): void {
    if (error instanceof ConsentDomainError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }

    const fallbackMessage =
      error instanceof Error ? error.message : 'Error interno al procesar el consentimiento.';
    res.status(500).json({ message: fallbackMessage });
  }
}
