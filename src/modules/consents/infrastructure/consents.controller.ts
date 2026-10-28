import { Request, Response } from 'express';
import { ConsentService } from '../application/consent.service';
import { ConsentDomainError } from '../domain/consent.errors';

export class ConsentsController {
  constructor(private readonly consentService: ConsentService) {}

  public createTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { nombre, plantillaUrl, tipoConsentimiento } = req.body;
      const created = await this.consentService.createTemplate({
        nombre,
        plantillaUrl,
        tipoConsentimiento: Boolean(tipoConsentimiento),
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
      const { nombre, plantillaUrl } = req.body;
      const updated = await this.consentService.updateTemplateVersion(id, {
        nombre,
        plantillaUrl,
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
      const { idConsentimiento, idPaciente, idCita, archivoUrl } = req.body;
      const signed = await this.consentService.signConsent({
        idConsentimiento: Number(idConsentimiento),
        idPaciente: Number(idPaciente),
        idCita: Number(idCita),
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

  private handleError(res: Response, error: unknown): void {
    if (error instanceof ConsentDomainError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }

    const fallbackMessage =
      error instanceof Error ? error.message : 'Error interno del servidor.';
    res.status(500).json({ message: fallbackMessage });
  }
}