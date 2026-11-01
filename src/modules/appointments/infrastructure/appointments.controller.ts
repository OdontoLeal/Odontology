import { Request, Response } from 'express';
import { AppointmentRepository } from './appointment.repository';
import { MailerService } from '../../../shared/infrastructure/mail/mailer.service';

export class AppointmentsController {
  constructor(
    private readonly appointmentRepo: AppointmentRepository,
    private readonly mailerService: MailerService = new MailerService()
  ) {}

  upsertTimeSlot = async (req: Request, res: Response): Promise<void> => {
    try {
      const { inicio, final, estado, idProfesional } = req.body;
      const slot = await this.appointmentRepo.upsertTimeSlot(
        inicio,
        final,
        estado ?? true,
        idProfesional ? Number(idProfesional) : 1
      );
      res.status(201).json({ message: 'Bloque de horario actualizado.', data: slot });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  generateDaySlots = async (req: Request, res: Response): Promise<void> => {
    try {
      const fecha = (req.body.fecha || req.query.fecha || '').toString();
      const idProfesional = req.body.idProfesional || req.query.idProfesional;
      if (!fecha) {
        res.status(400).json({ message: 'El parámetro fecha es obligatorio en formato YYYY-MM-DD.' });
        return;
      }

      const cleanFecha = fecha.trim().split('T')[0].split(' ')[0];
      const todayColombia = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

      if (cleanFecha < todayColombia) {
        res.status(400).json({
          message: `No se pueden generar bloques de horario para fechas pasadas (${cleanFecha}).`,
        });
        return;
      }

      const result = await this.appointmentRepo.generateDaySlots(
        fecha,
        idProfesional ? Number(idProfesional) : 1
      );
      res.status(201).json({
        message: `Se generaron ${result.totalGenerados} bloques de horario para la fecha ${result.fecha} (06:00 a 20:00).`,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  getAvailableSlots = async (req: Request, res: Response): Promise<void> => {
    try {
      const fecha = (req.query.fecha || '').toString();
      const idProfesional = req.query.idProfesional ? Number(req.query.idProfesional) : undefined;
      if (!fecha) {
        res.status(400).json({ message: 'El parámetro fecha es obligatorio en formato YYYY-MM-DD.' });
        return;
      }
      const slots = await this.appointmentRepo.getAvailableSlots(fecha, idProfesional);
      res.json({ data: slots });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };

  toggleSlotStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { inicio, idProfesional } = req.body;
      if (!inicio) {
        res.status(400).json({ message: 'El parámetro inicio es obligatorio.' });
        return;
      }
      const slot = await this.appointmentRepo.toggleSlotStatus(
        inicio,
        idProfesional ? Number(idProfesional) : 1
      );
      res.json({
        message: `Bloque ${slot.inicio} ${slot.estado ? 'habilitado' : 'deshabilitado'} exitosamente.`,
        data: slot,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  getTimeSlots = async (req: Request, res: Response): Promise<void> => {
    try {
      const { desde, hasta, idProfesional } = req.query;
      const slots = await this.appointmentRepo.getTimeSlots(
        desde ? String(desde) : undefined,
        hasta ? String(hasta) : undefined,
        idProfesional ? Number(idProfesional) : undefined
      );
      res.json({ data: slots });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };

  getMonthlySummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const year = req.query.year ? Number(req.query.year) : 2026;
      const month = req.query.month ? Number(req.query.month) : 10;
      const summary = await this.appointmentRepo.getMonthlySummary(year, month);
      res.json({ data: summary });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };

  getRequests = async (req: Request, res: Response): Promise<void> => {
    try {
      const requests = await this.appointmentRepo.getRequests();
      res.json({ data: requests });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };

  getRequestById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const request = await this.appointmentRepo.getRequestById(id);
      if (!request) {
        res.status(404).json({ message: 'Solicitud no encontrada.' });
        return;
      }
      res.json({ data: request });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };

  requestAppointmentPublic = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        nombreSolicitante,
        documentoSolicitante,
        correoSolicitante,
        telefonoSolicitante,
        fechaNacimiento,
        sexo,
        bloqueSolicitado,
        descripcion,
        idProfesional,
        servicio,
        autorizacionDatos,
      } = req.body;

      if (!nombreSolicitante || !documentoSolicitante || !correoSolicitante || !bloqueSolicitado) {
        res.status(400).json({
          message: 'Nombre, documento, correo y horario son campos obligatorios para la solicitud.',
        });
        return;
      }

      // Validar obligatoriedad de Ley 1581 (DEF-07 / CPS-AGE-003-03)
      if (!autorizacionDatos) {
        res.status(400).json({
          message: 'Debe aceptar la autorización de tratamiento de datos personales (Ley 1581 de 2012) para solicitar la cita.',
        });
        return;
      }

      const reqDate = String(bloqueSolicitado).trim().split('T')[0].split(' ')[0];
      const todayColombia = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

      if (reqDate < todayColombia) {
        res.status(400).json({
          message: `No se pueden solicitar citas para fechas pasadas (${reqDate}).`,
        });
        return;
      }

      const result = await this.appointmentRepo.createPublicRequest({
        nombreSolicitante,
        documentoSolicitante,
        correoSolicitante,
        telefonoSolicitante,
        fechaNacimiento,
        sexo,
        bloqueSolicitado,
        descripcion,
        idProfesional: idProfesional ? Number(idProfesional) : undefined,
        servicio,
        autorizacionDatos,
      });

      // Envío de correo de confirmación de solicitud recibida (RF-AGE-003, RQNF-FIA-004)
      const parts = String(bloqueSolicitado).split(' ');
      const fecha = parts[0] || bloqueSolicitado;
      const hora = (parts[1] || '').slice(0, 5) || 'Por confirmar';
      const solId = (result as any).solicitud?.id_solicitud;

      try {
        await this.mailerService.sendPublicRequestReceivedEmail({
          to: correoSolicitante.trim(),
          nombreSolicitante: nombreSolicitante.trim(),
          fecha,
          hora,
          doctor: 'Por asignar por Coordinación',
          motivo: descripcion || 'Valoración odontológica solicitada',
          idSolicitud: solId,
        });
      } catch (mailError: any) {
        console.error('RQNF-FIA-004: Falla en envío de correo al registrar solicitud:', mailError?.message);
      }

      // Notificación por correo con escalado COA -> AUX -> ADM (RF-AGE-004, DEF-09)
      try {
        const staffToNotify = await this.appointmentRepo.getStaffForNewRequestNotification();
        for (const staff of staffToNotify) {
          if (staff.correo) {
            await this.mailerService.sendCoordinatorNewRequestAlertEmail({
              to: staff.correo,
              staffName: staff.nombreCompleto,
              requesterName: nombreSolicitante.trim(),
              requesterDni: documentoSolicitante.trim(),
              requesterEmail: correoSolicitante.trim(),
              requesterPhone: telefonoSolicitante?.trim(),
              requestedDate: fecha,
              requestedTime: hora,
              motive: descripcion || 'Valoración odontológica solicitada en portal web',
              idSolicitud: solId,
            });
          }
        }
      } catch (coordMailError: any) {
        console.error('RQNF-FIA-004: Falla en notificación a personal:', coordMailError?.message);
      }

      res.status(201).json({
        message: 'Solicitud registrada y sujeta a aprobación del consultorio.',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  reviewRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const idSolicitud = Number(req.params.id);
      const { idUsuarioGestor, aprobar, motivo, idPaciente, idProfesional, selectedBlocks } = req.body;

      if (aprobar === false) {
        if (!motivo || !String(motivo).trim()) {
          res.status(400).json({ message: 'El motivo de rechazo de la solicitud es obligatorio.' });
          return;
        }
      }

      const result: any = await this.appointmentRepo.reviewRequest({
        idSolicitud,
        idUsuarioGestor: idUsuarioGestor || 1,
        aprobar: aprobar !== false,
        motivo: motivo || (aprobar ? 'Solicitud aprobada y confirmada en agenda médica' : ''),
        idPaciente,
        idProfesional,
        selectedBlocks,
      });

      if (result?.correoPaciente && (aprobar !== false)) {
        try {
          const fecha = result.fecha || String(result.fechaHora || '').split(' ')[0] || 'Por confirmar';
          const hora = result.hora || '15:30';

          await this.mailerService.sendAppointmentConfirmationEmail({
            to: result.correoPaciente,
            nombrePaciente: result.nombrePaciente || 'Paciente',
            fecha,
            hora,
            doctor: result.nombreDoctor || 'Dr. Mateo Gómez',
            motivo: result.titulo || result.descripcion || 'Valoración Odontológica Confirmada',
            idCita: result.id_cita || result.idCita,
          });
        } catch (mailError: any) {
          console.error('RQNF-FIA-004: Error enviando correo al paciente:', mailError?.message);
        }

        if (result?.correoDoctor) {
          try {
            const fecha = result.fecha || String(result.fechaHora || '').split(' ')[0] || 'Por confirmar';
            const hora = result.hora || '15:30';

            await this.mailerService.sendDoctorAppointmentNotificationEmail({
              to: result.correoDoctor,
              doctorName: result.nombreDoctor || 'Doctor',
              patientName: result.nombrePaciente || 'Paciente',
              fecha,
              hora,
              motivo: result.titulo || result.descripcion || 'Valoración Odontológica Confirmada',
              idCita: result.id_cita || result.idCita,
              telefonoPaciente: result.telefonoPaciente,
            });
          } catch (docMailError: any) {
            console.error('RQNF-FIA-004: Error enviando correo al doctor:', docMailError?.message);
          }
        }
      }

      res.json({
        message: aprobar !== false
          ? 'Cita creada y confirmada exitosamente. Se ha enviado el correo de confirmación al paciente.'
          : 'Solicitud rechazada correctamente.',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  scheduleAppointment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { titulo, descripcion, idPaciente, idUsuarioProfesional, idUsuarioGestor, bloques } = req.body;

      const todayColombia = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

      if (Array.isArray(bloques)) {
        for (const b of bloques) {
          const bDate = String(b).trim().split('T')[0].split(' ')[0];
          if (bDate < todayColombia) {
            res.status(400).json({
              message: `No se pueden agendar citas para fechas pasadas (${bDate}).`,
            });
            return;
          }
        }
      }

      const cita: any = await this.appointmentRepo.scheduleAppointment({
        titulo,
        descripcion,
        idPaciente,
        idUsuarioProfesional,
        idUsuarioGestor,
        bloques,
      });

      if (cita?.correoPaciente) {
        try {
          await this.mailerService.sendAppointmentConfirmationEmail({
            to: cita.correoPaciente,
            nombrePaciente: cita.nombrePaciente || 'Paciente',
            fecha: cita.fecha || 'Por confirmar',
            hora: cita.hora || 'Por confirmar',
            doctor: cita.nombreDoctor || 'Dr. Eduar Leal Álvarez',
            motivo: cita.titulo || 'Consulta Odontológica Confirmada',
            idCita: cita.id_cita,
          });
        } catch (mailError: any) {
          console.error('Error enviando correo de confirmación al paciente:', mailError?.message);
        }
      }

      if (cita?.correoDoctor) {
        try {
          await this.mailerService.sendDoctorAppointmentNotificationEmail({
            to: cita.correoDoctor,
            doctorName: cita.nombreDoctor || 'Doctor',
            patientName: cita.nombrePaciente || 'Paciente',
            fecha: cita.fecha || 'Por confirmar',
            hora: cita.hora || 'Por confirmar',
            motivo: cita.titulo || 'Consulta Odontológica Confirmada',
            idCita: cita.id_cita,
            telefonoPaciente: cita.telefonoPaciente,
          });
        } catch (docMailError: any) {
          console.error('Error enviando correo de nueva cita al doctor:', docMailError?.message);
        }
      }

      res.status(201).json({ message: 'Cita confirmada exitosamente.', data: cita });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  updateAppointment = async (req: Request, res: Response): Promise<void> => {
    try {
      const idCita = Number(req.params.id);
      const { idDoctor, titulo, descripcion, selectedBlocks, idUsuarioGestor, motivo } = req.body;
      const updated: any = await this.appointmentRepo.updateAppointmentDetails({
        idCita,
        idDoctor: idDoctor ? Number(idDoctor) : undefined,
        titulo,
        descripcion,
        selectedBlocks,
        idUsuarioGestor: idUsuarioGestor || 1,
        motivo,
      });

      if (updated?.correoPaciente) {
        try {
          await this.mailerService.sendAppointmentRescheduledEmail({
            to: updated.correoPaciente,
            nombrePaciente: updated.nombrePaciente || 'Paciente',
            fecha: updated.fecha || 'Por confirmar',
            hora: updated.hora || 'Por confirmar',
            doctor: updated.nombreDoctor || 'Dr. Eduar Leal Álvarez',
            motivo: updated.titulo || 'Cita Odontológica Modificada',
            idCita: updated.id_cita,
            notas: updated.descripcion,
          });
        } catch (mailError: any) {
          console.error('Error enviando correo de modificación al paciente:', mailError?.message);
        }
      }

      if (updated?.correoDoctor) {
        try {
          await this.mailerService.sendDoctorAppointmentRescheduledEmail({
            to: updated.correoDoctor,
            doctorName: updated.nombreDoctor || 'Doctor',
            patientName: updated.nombrePaciente || 'Paciente',
            fecha: updated.fecha || 'Por confirmar',
            hora: updated.hora || 'Por confirmar',
            motivo: updated.titulo || 'Cita Odontológica Modificada',
            idCita: updated.id_cita,
            telefonoPaciente: updated.telefonoPaciente,
            notas: updated.descripcion,
          });
        } catch (docMailError: any) {
          console.error('Error enviando correo de modificación al doctor:', docMailError?.message);
        }
      }

      res.json({
        message: 'Cita actualizada exitosamente.',
        data: updated,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  changeState = async (req: Request, res: Response): Promise<void> => {
    try {
      const idCita = Number(req.params.id);
      const authUser = (req as any).user;
      const { nuevoEstado, idUsuarioGestor, motivo, liberarBloques } = req.body;
      const roles: string[] = (authUser?.roles || []).map((r: any) =>
        typeof r === 'string' ? r : r.codigoRol || r.nombreRol
      );
      const isAdmin = roles.includes('ROL-ADM');
      const effectiveUserId =
        (idUsuarioGestor ? Number(idUsuarioGestor) : undefined) ??
        authUser?.idUsuario ??
        authUser?.id ??
        1;

      const updated: any = await this.appointmentRepo.changeAppointmentState({
        idCita,
        nuevoEstado,
        idUsuarioGestor: effectiveUserId,
        motivo,
        liberarBloques,
        isAdmin,
      });

      // Envío de correo de cancelación al paciente y al doctor (DEF-11 / CPS-AGE-007-01)
      if (nuevoEstado === 'Cancelada') {
        if (updated?.correoPaciente) {
          try {
            await this.mailerService.sendAppointmentCancellationEmail({
              to: updated.correoPaciente,
              recipientName: updated.nombrePaciente || 'Paciente',
              patientName: updated.nombrePaciente || 'Paciente',
              doctorName: updated.nombreDoctor || 'Doctor Tratante',
              fecha: updated.fecha || 'Por confirmar',
              hora: updated.hora || 'Por confirmar',
              motivo: motivo || 'Cancelación de cita médica',
              idCita,
            });
          } catch (mErr: any) {
            console.error('Error enviando correo de cancelación al paciente:', mErr?.message);
          }
        }

        if (updated?.correoDoctor) {
          try {
            await this.mailerService.sendAppointmentCancellationEmail({
              to: updated.correoDoctor,
              recipientName: updated.nombreDoctor || 'Doctor',
              patientName: updated.nombrePaciente || 'Paciente',
              doctorName: updated.nombreDoctor || 'Doctor Tratante',
              fecha: updated.fecha || 'Por confirmar',
              hora: updated.hora || 'Por confirmar',
              motivo: motivo || 'Cancelación de cita médica',
              idCita,
              isDoctor: true,
            });
          } catch (mErr: any) {
            console.error('Error enviando correo de cancelación al doctor:', mErr?.message);
          }
        }
      }

      res.json({ message: `Cita actualizada a estado ${nuevoEstado}.`, data: updated });
    } catch (error: any) {
      const status = error.status || (error.message.includes('403') || error.message.includes('responsable') ? 403 : 400);
      res.status(status).json({ message: error.message });
    }
  };

  getAgenda = async (req: Request, res: Response): Promise<void> => {
    try {
      const idProfesional = req.query.idProfesional ? Number(req.query.idProfesional) : undefined;
      const idPaciente = req.query.idPaciente ? Number(req.query.idPaciente) : undefined;
      const fecha = req.query.fecha ? String(req.query.fecha) : undefined;
      const agenda = await this.appointmentRepo.getAgenda(idProfesional, idPaciente, fecha);
      res.json({ data: agenda });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };
}
