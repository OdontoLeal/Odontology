// src/modules/consents/infrastructure/consents.controller.ts
import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../../../shared/infrastructure/database/database';
import { ConsentService } from '../application/consent.service';
import { ConsentDomainError } from '../domain/consent.errors';
import { PatientRepository } from '../../patients/infrastructure/patient.repository';

interface TabletSigningSession {
  token: string;
  idConsentimiento: number;
  idPaciente: number;
  expiresAt: number;
}

const tabletSessionsStore = new Map<string, TabletSigningSession>();

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

  // DEF-01 & CPS-CON-003-01: Proteger endpoint de consentimientos del paciente
  public getPatientConsents = async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionUser = (req as any).user;
      const headerRole = (req.headers['x-user-role'] || req.headers['x-user-roles']) as string;
      const hasAuth = Boolean(sessionUser || headerRole || req.headers['authorization']);

      if (!hasAuth) {
        res.status(401).json({
          message: 'Se requiere sesión para consultar los consentimientos del paciente.',
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
        roles.includes('ROL-ADM') ||
        roles.includes('ROL-AUX');

      if (!isAllowed) {
        res.status(403).json({
          message: 'No tiene permiso para consultar los consentimientos del paciente.',
        });
        return;
      }

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

  // DEF-21 & CPS-CON-002-02, CPS-CON-006-01: Arquitectura de Firma en Tablet
  public createTabletToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { idConsentimiento, idPaciente } = req.body;
      if (!idConsentimiento || !idPaciente) {
        res.status(400).json({ message: 'idConsentimiento e idPaciente son obligatorios.' });
        return;
      }

      const token = crypto.randomUUID();
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos (900 seg)

      tabletSessionsStore.set(token, {
        token,
        idConsentimiento: Number(idConsentimiento),
        idPaciente: Number(idPaciente),
        expiresAt,
      });

      res.status(201).json({
        token,
        signUrl: `/tablet-sign/${token}`,
        expiraEnSegundos: 900,
      });
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public getTabletSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const token = String(req.params.token || '');
      const session = tabletSessionsStore.get(token);

      if (!session || session.expiresAt < Date.now()) {
        if (session) tabletSessionsStore.delete(token);
        res.status(401).json({
          message: 'El enlace de firma en tablet ha expirado o no es válido.',
        });
        return;
      }

      const templates = await this.consentService.getTemplates(false);
      const template = templates.find((t) => t.idConsentimiento === session.idConsentimiento);

      if (!template) {
        res.status(404).json({ message: 'Plantilla de consentimiento no encontrada.' });
        return;
      }

      const pRes = await db.query<{
        id_paciente: number;
        nombre_completo: string;
        documento_identidad: string;
        fecha_nacimiento: string | null;
      }>(
        `SELECT id_paciente, nombre_completo, documento_identidad, fecha_nacimiento
         FROM public.paciente WHERE id_paciente = $1;`,
        [session.idPaciente]
      );

      if (pRes.rows.length === 0) {
        res.status(404).json({ message: 'Paciente no encontrado.' });
        return;
      }

      const patient = pRes.rows[0];
      let esMenorDeEdad = false;
      if (patient.fecha_nacimiento) {
        const birthDate = new Date(patient.fecha_nacimiento);
        const now = new Date();
        let age = now.getFullYear() - birthDate.getFullYear();
        const m = now.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
          age--;
        }
        esMenorDeEdad = age < 18;
      }

      const meta = PatientRepository.getMetadata(patient.id_paciente);

      res.status(200).json({
        data: {
          idConsentimiento: template.idConsentimiento,
          nombrePlantilla: template.nombre,
          textoPlantilla: template.textoPlantilla,
          version: template.version,
          idPaciente: patient.id_paciente,
          nombrePaciente: patient.nombre_completo,
          documentoPaciente: patient.documento_identidad,
          esMenorDeEdad,
          acudiente: meta?.acudiente || null,
        },
      });
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public submitTabletSigning = async (req: Request, res: Response): Promise<void> => {
    try {
      const token = String(req.params.token || '');
      const session = tabletSessionsStore.get(token);

      if (!session || session.expiresAt < Date.now()) {
        if (session) tabletSessionsStore.delete(token);
        res.status(401).json({
          message: 'El enlace de firma en tablet ha expirado o no es válido.',
        });
        return;
      }

      const { firmaBase64, firmaPorAcudiente, nombreDocumentoAcudiente, textoFirmado } = req.body;

      const signed = await this.consentService.signConsent({
        idConsentimiento: session.idConsentimiento,
        idPaciente: session.idPaciente,
        textoFirmado,
        firmaBase64,
        firmaPorAcudiente: Boolean(firmaPorAcudiente),
        nombreDocumentoAcudiente,
      });

      // Destruir token de un solo uso
      tabletSessionsStore.delete(token);

      res.status(201).json({
        message: 'Consentimiento firmado exitosamente desde la tablet.',
        data: signed,
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
