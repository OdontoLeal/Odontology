// src/modules/consents/infrastructure/consents.controller.ts
import { Request, Response } from 'express';
import { db } from '../../../shared/infrastructure/database/database';
import { handleRequestError } from '../../../shared/infrastructure/http/http-error.handler';
import { auditLog } from '../../../shared/infrastructure/audit/audit-log.service';
import {
  ForbiddenError,
  getSessionUser,
  hasRole,
  SessionUser,
} from '../../../shared/infrastructure/security/access-control';
import { ConsentService } from '../application/consent.service';

/**
 * Módulo D — Consentimientos informados (ERS v1.3).
 * Se toman desde la ficha del paciente, dentro de la sesión del profesional o
 * la auxiliar. La firma por enlace de un solo uso o QR (RF-CON-006) se eliminó.
 */
export class ConsentsController {
  constructor(private readonly consentService: ConsentService) {}

  private async auditTemplate(user: SessionUser, accion: string, id: number | undefined, valorNuevo: unknown) {
    await auditLog.record({
      idUsuario: user.idUsuario,
      actor: user.correo,
      accion,
      entidad: 'plantilla_consentimiento',
      idRegistro: id ?? null,
      valorNuevo,
    });
  }

  /** ROL-AUX solo consulta consentimientos del paciente de la cita En consulta (RF-CON-003). */
  private async auxHasActiveConsultation(idPaciente: number): Promise<boolean> {
    const { rows } = await db.query(
      `SELECT 1 FROM public.cita WHERE id_paciente = $1 AND estado = 'En consulta' LIMIT 1;`,
      [idPaciente]
    );
    return rows.length > 0;
  }

  // RF-CON-004
  public createTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = getSessionUser(req)!;
      const { nombre, textoPlantilla, tipo } = req.body ?? {};
      const created = await this.consentService.createTemplate({
        nombre,
        textoPlantilla,
        tipo,
        idUsuarioModificador: user.idUsuario,
      });
      await this.auditTemplate(user, 'CREAR', created.idConsentimiento, {
        nombre: created.nombre,
        tipo: created.tipo,
        version: created.version,
      });
      res.status(201).json({ message: 'Plantilla creada en versión 1.', data: created });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };

  // RF-CON-007
  public updateTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = getSessionUser(req)!;
      const { nombre, textoPlantilla } = req.body ?? {};
      const updated = await this.consentService.updateTemplateVersion(Number(req.params.id), {
        nombre,
        textoPlantilla,
        idUsuarioModificador: user.idUsuario,
      });
      await this.auditTemplate(user, 'MODIFICAR', updated.idConsentimiento, {
        nombre: updated.nombre,
        version: updated.version,
      });
      res.status(200).json({ message: 'Nueva versión de plantilla generada.', data: updated });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };

  // RF-CON-008
  public toggleStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = getSessionUser(req)!;
      if (typeof req.body?.estado !== 'boolean') {
        throw Object.assign(new Error("El campo 'estado' debe ser booleano."), { statusCode: 400 });
      }
      const updated = await this.consentService.toggleTemplateStatus(Number(req.params.id), req.body.estado);
      await this.auditTemplate(user, 'CAMBIAR_ESTADO', updated.idConsentimiento, { estado: updated.estado });
      res.status(200).json({ message: 'Estado de plantilla actualizado.', data: updated });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };

  public getTemplates = async (req: Request, res: Response): Promise<void> => {
    try {
      const templates = await this.consentService.getTemplates(req.query.activas === 'true');
      res.status(200).json({ data: templates });
    } catch (error) {
      await handleRequestError(req, res, error, 500);
    }
  };

  // RQNF-SEG-006: aviso de privacidad vigente, público y sin sesión
  public getPrivacyNotice = async (req: Request, res: Response): Promise<void> => {
    try {
      const plantilla = await this.consentService.getCurrentPrivacyNotice();
      if (!plantilla) {
        res.status(404).json({ message: 'El consultorio aún no ha publicado su aviso de privacidad.' });
        return;
      }
      res.status(200).json({
        data: {
          idPlantilla: plantilla.idConsentimiento,
          nombre: plantilla.nombre,
          version: plantilla.version,
          fechaPublicacion: plantilla.fechaModificacion ?? null,
          // El texto se muestra sin datos de ningún paciente
          texto: plantilla.textoPlantilla
            .replace(/\{\{\s*nombre_paciente\s*\}\}/gi, '[nombre del titular]')
            .replace(/\{\{\s*documento_paciente\s*\}\}/gi, '[documento del titular]')
            .replace(/\{\{[^}]*\}\}/g, ''),
        },
      });
    } catch (error) {
      await handleRequestError(req, res, error, 500);
    }
  };

  // RF-CON-002 y RF-CON-005
  public signConsent = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = getSessionUser(req)!;
      const { idConsentimiento, idPaciente, textoFirmado, firmaBase64, aceptado, firmaPorAcudiente, nombreDocumentoAcudiente } =
        req.body ?? {};

      const signed = await this.consentService.signConsent({
        idConsentimiento: Number(idConsentimiento),
        idPaciente: Number(idPaciente),
        textoFirmado,
        firmaBase64,
        aceptado: aceptado === true,
        firmaPorAcudiente: Boolean(firmaPorAcudiente),
        nombreDocumentoAcudiente,
        idUsuarioDiligencio: user.idUsuario,
        actorCorreo: user.correo,
      });
      res.status(201).json({ message: 'Consentimiento firmado guardado exitosamente.', data: signed });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };

  /**
   * RF-CON-001 (estado de cada plantilla para el paciente) y RF-CON-003 (consulta).
   * ROL-AUX ve el estado (fecha y versión) desde cualquier ficha, pero el texto y la
   * firma solo con la cita del paciente En consulta.
   */
  public getPatientConsents = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = getSessionUser(req)!;
      const idPaciente = Number(req.params.idPaciente);
      const consents = await this.consentService.getSignedConsentsByPatient(idPaciente);

      const fullAccess =
        hasRole(user, 'ROL-ODO', 'ROL-ESP') ||
        (hasRole(user, 'ROL-AUX') && (await this.auxHasActiveConsultation(idPaciente)));

      const data = fullAccess
        ? consents
        : consents.map(({ textoFirmado: _t, firmaBase64: _f, nombreDocumentoAcudiente: _n, ...estado }) => estado);

      res.status(200).json({
        data,
        message: consents.length === 0 ? 'El paciente no tiene consentimientos registrados' : undefined,
      });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };

  // RF-CON-003: PDF armado en memoria al consultarlo
  public getConsentPdf = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = getSessionUser(req)!;
      const id = Number(req.params.id);
      const idPaciente = await this.consentService.getSignedConsentPatientId(id);

      const allowed =
        hasRole(user, 'ROL-ODO', 'ROL-ESP') ||
        (hasRole(user, 'ROL-AUX') && (await this.auxHasActiveConsultation(idPaciente)));
      if (!allowed) throw new ForbiddenError();

      const pdfBase64 = await this.consentService.generateConsentPdf(id);
      res.status(200).json({ data: { idConsentimientoFirmado: id, pdfBase64 } });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };
}
