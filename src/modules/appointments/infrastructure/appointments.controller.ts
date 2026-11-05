// src/modules/appointments/infrastructure/appointments.controller.ts
import { Request, Response } from 'express';
import { handleRequestError } from '../../../shared/infrastructure/http/http-error.handler';
import { MailerService } from '../../../shared/infrastructure/mail/mailer.service';
import { getSessionUser, hasRole } from '../../../shared/infrastructure/security/access-control';
import { AgendaActor, AppointmentRepository } from './appointment.repository';
import { AppointmentRuleError } from './helpers/appointment-state.validator';

const DOCUMENT_REGEX = /^\d{1,20}$/;
const PHONE_REGEX = /^\d{10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Actor de la agenda: siempre el usuario de la sesión (nunca `idUsuarioGestor` del cuerpo). */
function agendaActor(req: Request): AgendaActor {
  const user = getSessionUser(req)!;
  return { idUsuario: user.idUsuario, correo: user.correo, roles: user.roles ?? [], permisos: user.permisos ?? [] };
}

export class AppointmentsController {
  constructor(
    private readonly appointmentRepo: AppointmentRepository,
    private readonly mailerService: MailerService = new MailerService()
  ) {}

  // ---------------------------------------------------------------------------
  // RF-AGE-001: bloques
  // ---------------------------------------------------------------------------
  upsertTimeSlot = async (req: Request, res: Response): Promise<void> => {
    try {
      const { inicio, final, estado } = req.body ?? {};
      if (!inicio) throw new AppointmentRuleError('El parámetro inicio es obligatorio.');
      const slot = await this.appointmentRepo.upsertTimeSlot(inicio, final, estado ?? true);
      res.status(201).json({ message: 'Bloque de horario actualizado.', data: slot });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };

  generateDaySlots = async (req: Request, res: Response): Promise<void> => {
    try {
      const fecha = String(req.body?.fecha || req.query.fecha || '');
      if (!fecha) throw new AppointmentRuleError('El parámetro fecha es obligatorio en formato YYYY-MM-DD.');
      const result = await this.appointmentRepo.generateDaySlots(fecha);
      res.status(201).json({
        message: `Se habilitaron ${result.totalGenerados} bloques de horario para ${result.fecha}.`,
        data: result,
      });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };

  getAvailableSlots = async (req: Request, res: Response): Promise<void> => {
    try {
      const fecha = String(req.query.fecha || '');
      if (!fecha) throw new AppointmentRuleError('El parámetro fecha es obligatorio en formato YYYY-MM-DD.');
      const slots = await this.appointmentRepo.getAvailableSlots(fecha);
      res.json({ data: slots });
    } catch (error) {
      await handleRequestError(req, res, error, 500);
    }
  };

  toggleSlotStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { inicio } = req.body ?? {};
      if (!inicio) throw new AppointmentRuleError('El parámetro inicio es obligatorio.');
      const slot = await this.appointmentRepo.toggleSlotStatus(inicio);
      res.json({
        message: `Bloque ${slot.inicio} ${slot.estado ? 'habilitado' : 'deshabilitado'} exitosamente.`,
        data: slot,
      });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };

  getTimeSlots = async (req: Request, res: Response): Promise<void> => {
    try {
      const { desde, hasta } = req.query;
      const slots = await this.appointmentRepo.getTimeSlots(
        desde ? String(desde) : undefined,
        hasta ? String(hasta) : undefined
      );
      res.json({ data: slots });
    } catch (error) {
      await handleRequestError(req, res, error, 500);
    }
  };

  getMonthlySummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const now = new Date();
      const year = req.query.year ? Number(req.query.year) : now.getFullYear();
      const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
      res.json({ data: await this.appointmentRepo.getMonthlySummary(year, month) });
    } catch (error) {
      await handleRequestError(req, res, error, 500);
    }
  };

  // ---------------------------------------------------------------------------
  // RF-AGE-003 / RF-AGE-005: solicitudes
  // ---------------------------------------------------------------------------
  getRequests = async (req: Request, res: Response): Promise<void> => {
    try {
      res.json({ data: await this.appointmentRepo.getRequests() });
    } catch (error) {
      await handleRequestError(req, res, error, 500);
    }
  };

  getRequestById = async (req: Request, res: Response): Promise<void> => {
    try {
      const request = await this.appointmentRepo.getRequestById(Number(req.params.id));
      if (!request) {
        res.status(404).json({ message: 'Solicitud no encontrada.' });
        return;
      }
      res.json({ data: request });
    } catch (error) {
      await handleRequestError(req, res, error, 500);
    }
  };

  /** RF-AGE-003: valida los datos de la sección pública (todos obligatorios salvo el motivo). */
  private validatePublicRequestBody(body: any): void {
    const required: Array<[string, string]> = [
      ['nombreSolicitante', 'nombre completo'],
      ['documentoSolicitante', 'documento de identidad'],
      ['telefonoSolicitante', 'teléfono'],
      ['correoSolicitante', 'correo electrónico'],
      ['fechaNacimiento', 'fecha de nacimiento'],
      ['bloqueSolicitado', 'horario'],
    ];
    for (const [field, label] of required) {
      if (!body?.[field] || !String(body[field]).trim()) {
        throw Object.assign(new AppointmentRuleError(`El campo ${label} es obligatorio.`), { field });
      }
    }
    if (!DOCUMENT_REGEX.test(String(body.documentoSolicitante).trim())) {
      throw new AppointmentRuleError('El documento de identidad debe contener solo dígitos.');
    }
    if (!PHONE_REGEX.test(String(body.telefonoSolicitante).trim())) {
      throw new AppointmentRuleError('El teléfono debe tener 10 dígitos.');
    }
    if (!EMAIL_REGEX.test(String(body.correoSolicitante).trim())) {
      throw new AppointmentRuleError('El correo electrónico no tiene un formato válido (usuario@dominio).');
    }
    const fn = String(body.fechaNacimiento).trim();
    if (!DATE_REGEX.test(fn) || Number.isNaN(new Date(`${fn}T00:00:00`).getTime()) || new Date(`${fn}T00:00:00`) > new Date()) {
      throw new AppointmentRuleError('La fecha de nacimiento no es válida.');
    }
    if (String(body.nombreSolicitante).trim().length > 150) {
      throw new AppointmentRuleError('El nombre no puede superar 150 caracteres.');
    }
    if (body.descripcion && String(body.descripcion).length > 500) {
      throw new AppointmentRuleError('El motivo no puede superar 500 caracteres.');
    }
  }

  requestAppointmentPublic = async (req: Request, res: Response): Promise<void> => {
    try {
      this.validatePublicRequestBody(req.body);
      const body = req.body;

      const result = await this.appointmentRepo.createPublicRequest({
        nombreSolicitante: body.nombreSolicitante,
        documentoSolicitante: body.documentoSolicitante,
        correoSolicitante: body.correoSolicitante,
        telefonoSolicitante: body.telefonoSolicitante,
        fechaNacimiento: body.fechaNacimiento,
        sexo: body.sexo,
        bloqueSolicitado: body.bloqueSolicitado,
        descripcion: body.descripcion,
        autorizacionDatos: body.autorizacionDatos === true,
        versionPlantillaAutorizacion:
          body.versionPlantillaAutorizacion !== undefined ? Number(body.versionPlantillaAutorizacion) : undefined,
      });

      const [fecha, horaCompleta = ''] = result.bloqueSolicitado.split(' ');
      const hora = horaCompleta.slice(0, 5);

      // RF-AGE-003 y RQNF-FIA-004: el correo no bloquea la solicitud; los fallos quedan auditados
      await this.mailerService.sendPublicRequestReceivedEmail({
        to: String(body.correoSolicitante).trim(),
        nombreSolicitante: String(body.nombreSolicitante).trim(),
        fecha,
        hora,
        doctor: 'Por asignar por el consultorio',
        motivo: body.descripcion || 'Valoración odontológica',
        idSolicitud: result.idSolicitud,
      });

      // RF-AGE-004: aviso al personal (COA → AUX → ADM)
      const staffToNotify = await this.appointmentRepo.getStaffForNewRequestNotification();
      for (const staff of staffToNotify) {
        await this.mailerService.sendCoordinatorNewRequestAlertEmail({
          to: staff.correo,
          staffName: staff.nombreCompleto,
          requesterName: String(body.nombreSolicitante).trim(),
          requesterDni: String(body.documentoSolicitante).trim(),
          requesterEmail: String(body.correoSolicitante).trim(),
          requesterPhone: String(body.telefonoSolicitante).trim(),
          requestedDate: fecha,
          requestedTime: hora,
          motive: body.descripcion || 'Valoración odontológica',
          idSolicitud: result.idSolicitud,
        });
      }

      res.status(201).json({
        message: 'Solicitud registrada y sujeta a aprobación del consultorio.',
        data: result,
      });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };

  reviewRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const idSolicitud = Number(req.params.id);
      if (Number.isNaN(idSolicitud)) throw new AppointmentRuleError('El ID de solicitud debe ser numérico.');
      if (!req.body || typeof req.body.aprobar !== 'boolean') {
        throw new AppointmentRuleError(
          "El campo 'aprobar' es obligatorio y debe ser estrictamente de tipo booleano (true o false)."
        );
      }
      const { aprobar, motivo, idProfesional, selectedBlocks } = req.body;
      if (!aprobar && (!motivo || !String(motivo).trim())) {
        throw new AppointmentRuleError('El motivo de rechazo de la solicitud es obligatorio.');
      }

      const result: any = await this.appointmentRepo.reviewRequest({
        idSolicitud,
        actor: agendaActor(req),
        aprobar,
        motivo: motivo ? String(motivo).trim() : '',
        idProfesional: idProfesional ? Number(idProfesional) : undefined,
        selectedBlocks,
      });

      if (aprobar) {
        await this.mailerService.sendAppointmentConfirmationEmail({
          to: result.correoPaciente,
          nombrePaciente: result.nombrePaciente,
          fecha: result.fecha,
          hora: result.hora,
          doctor: result.nombreDoctor,
          motivo: result.titulo || 'Valoración odontológica',
          idCita: result.idCita,
        });
        if (result.correoDoctor) {
          await this.mailerService.sendDoctorAppointmentNotificationEmail({
            to: result.correoDoctor,
            doctorName: result.nombreDoctor,
            patientName: result.nombrePaciente,
            fecha: result.fecha,
            hora: result.hora,
            motivo: result.titulo || 'Valoración odontológica',
            idCita: result.idCita,
            telefonoPaciente: result.telefonoPaciente,
          });
        }
      } else {
        // D-20 (RF-AGE-005): el motivo del rechazo se envía al solicitante
        await this.mailerService.sendRequestRejectedEmail({
          to: result.correo,
          nombreSolicitante: result.nombreSolicitante,
          fecha: result.fecha,
          hora: result.hora,
          motivo: String(motivo).trim(),
          idSolicitud,
        });
      }

      res.json({
        message: aprobar
          ? 'Cita confirmada. Se envió el correo de confirmación al paciente.'
          : 'Solicitud rechazada. Se envió el motivo al correo del solicitante.',
        data: result,
      });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };

  // ---------------------------------------------------------------------------
  // RF-AGE-002, RF-AGE-006: agendar y editar
  // ---------------------------------------------------------------------------
  scheduleAppointment = async (req: Request, res: Response): Promise<void> => {
    try {
      const actor = agendaActor(req);
      const { titulo, descripcion, idPaciente, idUsuarioProfesional, bloques } = req.body ?? {};

      const cita: any = await this.appointmentRepo.scheduleAppointment({
        titulo,
        descripcion,
        idPaciente: Number(idPaciente),
        idUsuarioProfesional: Number(idUsuarioProfesional),
        idUsuarioGestor: actor.idUsuario,
        actorGestor: actor.correo,
        bloques,
      });

      if (cita.correoPaciente) {
        await this.mailerService.sendAppointmentConfirmationEmail({
          to: cita.correoPaciente,
          nombrePaciente: cita.nombrePaciente,
          fecha: cita.fecha,
          hora: cita.hora,
          doctor: cita.nombreDoctor,
          motivo: cita.titulo,
          idCita: cita.id_cita,
        });
      }
      if (cita.correoDoctor) {
        await this.mailerService.sendDoctorAppointmentNotificationEmail({
          to: cita.correoDoctor,
          doctorName: cita.nombreDoctor,
          patientName: cita.nombrePaciente,
          fecha: cita.fecha,
          hora: cita.hora,
          motivo: cita.titulo,
          idCita: cita.id_cita,
          telefonoPaciente: cita.telefonoPaciente,
        });
      }

      res.status(201).json({ message: 'Cita confirmada exitosamente.', data: cita });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };

  updateAppointment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { idDoctor, titulo, descripcion, selectedBlocks, motivo } = req.body ?? {};
      const updated: any = await this.appointmentRepo.updateAppointmentDetails({
        idCita: Number(req.params.id),
        actor: agendaActor(req),
        idDoctor: idDoctor ? Number(idDoctor) : undefined,
        titulo,
        descripcion,
        selectedBlocks,
        motivo,
      });

      // RF-AGE-006: se avisa al paciente solo si cambió la fecha, los bloques o el profesional
      if (updated.notificar) {
        if (updated.correoPaciente) {
          await this.mailerService.sendAppointmentRescheduledEmail({
            to: updated.correoPaciente,
            nombrePaciente: updated.nombrePaciente,
            fecha: updated.fecha,
            hora: updated.hora,
            doctor: updated.nombreDoctor,
            motivo: updated.titulo,
            idCita: updated.id_cita,
            notas: updated.descripcion,
          });
        }
        if (updated.correoDoctor) {
          await this.mailerService.sendDoctorAppointmentRescheduledEmail({
            to: updated.correoDoctor,
            doctorName: updated.nombreDoctor,
            patientName: updated.nombrePaciente,
            fecha: updated.fecha,
            hora: updated.hora,
            motivo: updated.titulo,
            idCita: updated.id_cita,
            telefonoPaciente: updated.telefonoPaciente,
            notas: updated.descripcion,
          });
        }
      }

      res.json({ message: 'Cita actualizada exitosamente.', data: updated });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };

  // ---------------------------------------------------------------------------
  // RF-AGE-007, RF-AGE-009, RF-AGE-012: cambios de estado
  // ---------------------------------------------------------------------------
  changeState = async (req: Request, res: Response): Promise<void> => {
    try {
      const idCita = Number(req.params.id);
      if (Number.isNaN(idCita)) throw new AppointmentRuleError('El ID de cita debe ser numérico.');
      const { nuevoEstado, motivo, liberarBloques } = req.body ?? {};
      if (!nuevoEstado || typeof nuevoEstado !== 'string' || !nuevoEstado.trim()) {
        throw new AppointmentRuleError("El campo 'nuevoEstado' es obligatorio.");
      }
      // RF-AGE-007: el motivo de cancelación es obligatorio (se valida antes de abrir la transacción)
      if (nuevoEstado.trim() === 'Cancelada' && (!motivo || !String(motivo).trim())) {
        throw new AppointmentRuleError('El motivo de cancelación es obligatorio.');
      }
      // RF-AGE-005: el rechazo se decide al gestionar la solicitud, no desde la agenda
      if (nuevoEstado.trim() === 'Rechazada') {
        throw new AppointmentRuleError(
          'Las solicitudes se rechazan desde "Gestionar solicitud" (RF-AGE-005), con motivo obligatorio.',
          409
        );
      }

      const updated: any = await this.appointmentRepo.changeAppointmentState({
        idCita,
        nuevoEstado: nuevoEstado.trim() as any,
        actor: agendaActor(req),
        motivo: motivo ? String(motivo) : null,
        liberarBloques,
      });

      // RF-AGE-007: correo de cancelación al paciente y al profesional
      if (updated.estado === 'Cancelada') {
        const base = {
          patientName: updated.nombrePaciente,
          doctorName: updated.nombreDoctor,
          fecha: updated.fecha,
          hora: updated.hora,
          motivo: String(motivo),
          idCita,
        };
        if (updated.correoPaciente) {
          await this.mailerService.sendAppointmentCancellationEmail({
            ...base,
            to: updated.correoPaciente,
            recipientName: updated.nombrePaciente,
          });
        }
        if (updated.correoDoctor) {
          await this.mailerService.sendAppointmentCancellationEmail({
            ...base,
            to: updated.correoDoctor,
            recipientName: updated.nombreDoctor,
            isDoctor: true,
          });
        }
      }

      res.json({ message: `Cita actualizada a estado ${updated.estado}.`, data: updated });
    } catch (error) {
      await handleRequestError(req, res, error, 400);
    }
  };

  // RF-AGE-008: ROL-ODO y ROL-ESP ven solo su agenda, salvo que tengan ROL-ADM, ROL-COA o ROL-AUX
  getAgenda = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = getSessionUser(req)!;
      const seesAll = hasRole(user, 'ROL-ADM', 'ROL-COA', 'ROL-AUX');
      const idProfesional = seesAll
        ? req.query.idProfesional
          ? Number(req.query.idProfesional)
          : undefined
        : user.idUsuario;
      const idPaciente = req.query.idPaciente ? Number(req.query.idPaciente) : undefined;
      const fecha = req.query.fecha ? String(req.query.fecha) : undefined;
      res.json({ data: await this.appointmentRepo.getAgenda(idProfesional, idPaciente, fecha) });
    } catch (error) {
      await handleRequestError(req, res, error, 500);
    }
  };
}
