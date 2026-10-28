// src/shared/infrastructure/mail/mailer.service.ts
import nodemailer, { Transporter } from 'nodemailer';
import { IMailerPort } from '../../../modules/users-auth/domain/user.repository.interface';
import { envConfig } from '../../../app/config/env.config';

export interface MailerServiceOptions {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

export class MailerService implements IMailerPort {
  private transporter: Transporter | null = null;
  private readonly fromAddress: string;

  constructor(private readonly options?: MailerServiceOptions) {
    const defaultFrom = process.env.GMAIL_USER
      ? `"Consultorio OdontoLeal" <${process.env.GMAIL_USER}>`
      : '"Consultorio OdontoLeal" <notificaciones@odontoleal.com>';
    this.fromAddress =
      options?.from ||
      process.env.EMAIL_FROM ||
      process.env.SMTP_FROM ||
      defaultFrom;
  }

  /**
   * Obtiene o inicializa el transporter de correo.
   * 1. Soporta Gmail directo con App Password (GMAIL_USER + GMAIL_PASS).
   * 2. Soporta SMTP estándar (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) como Brevo, Resend, etc.
   * 3. Fallback automático a Ethereal Email (sandbox gratuito de pruebas con visualización web).
   */
  private async getTransporter(): Promise<Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    // 1. Detección directa de Gmail
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = (process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

    if (gmailUser && gmailPass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });
      console.log(`📧 Servicio de correo inicializado con Gmail (${gmailUser})`);
      return this.transporter;
    }

    // 2. Detección de SMTP estándar (Brevo, Resend, Outlook, etc.)
    const host = this.options?.host || process.env.SMTP_HOST;
    const port = this.options?.port || Number(process.env.SMTP_PORT) || 587;
    const user = this.options?.user || process.env.SMTP_USER;
    const rawPass = this.options?.pass || process.env.SMTP_PASS;
    const pass = rawPass ? rawPass.replace(/\s+/g, '') : '';
    const secure =
      this.options?.secure ??
      (process.env.SMTP_SECURE === 'true' || port === 465);

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
      console.log(`📧 Servicio de correo inicializado con SMTP: ${host}:${port}`);
      return this.transporter;
    }

    // 3. Fallback a servicio gratuito de pruebas Ethereal Email (Nodemailer test sandbox)
    try {
      console.log('📧 No se detectaron credenciales SMTP reales. Generando buzón de pruebas Ethereal Email...');
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`✅ Buzón Ethereal listo: ${testAccount.user}`);
      return this.transporter;
    } catch (etherealError: any) {
      console.warn('⚠️ No fue posible conectar con Ethereal, usando fallback jsonTransport:', etherealError?.message);
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      return this.transporter;
    }
  }

  /**
   * Envía el correo con plantilla HTML oficial de OdontoLeal
   */
  async sendPasswordRecoveryEmail(params: {
    to: string;
    nombreCompleto: string;
    recoveryLink: string;
    expiresInMinutes: number;
  }): Promise<{ messageId?: string; previewUrl?: string | null }> {
    const { to, nombreCompleto, recoveryLink, expiresInMinutes } = params;

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Recuperación de Contraseña - OdontoLeal</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F6F6F4; margin: 0; padding: 24px; color: #1F2430; }
    .card { max-width: 540px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E7E7E3; border-top: 5px solid #D4AF37; padding: 36px 32px; box-shadow: 0 4px 16px rgba(17,17,17,0.06); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo-badge { display: inline-block; background-color: #111111; color: #D4AF37; font-size: 13px; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 14px; border-radius: 999px; margin-bottom: 12px; }
    h1 { font-size: 22px; font-weight: 800; color: #111111; margin: 0 0 8px 0; }
    p { font-size: 14px; line-height: 1.6; color: #4B5563; margin: 12px 0; }
    .button-container { text-align: center; margin: 28px 0; }
    .btn-gold { display: inline-block; background: linear-gradient(180deg, #DDB93E, #C9A227); color: #111111 !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 13px 28px; border-radius: 10px; box-shadow: 0 2px 6px rgba(184,148,42,0.35); }
    .btn-gold:hover { background: #B8942A; }
    .alert-box { background-color: #FBF3D5; border-left: 4px solid #D4AF37; padding: 12px 16px; border-radius: 8px; margin: 20px 0; font-size: 13px; color: #78350F; }
    .raw-link { word-break: break-all; font-size: 12px; color: #2563EB; background: #F3F4F6; padding: 8px; border-radius: 6px; }
    .footer { text-align: center; font-size: 12px; color: #9CA3AF; margin-top: 24px; border-top: 1px solid #E5E7EB; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">CONSULTORIO ODONTOLEAL</div>
      <h1>Restablecer Contraseña</h1>
      <p style="margin: 0; color: #6B7280; font-size: 13px;">Dirección Médica Dr. Eduar Leal Álvarez</p>
    </div>

    <p>Hola <strong>${nombreCompleto}</strong>,</p>
    <p>Hemos recibido una solicitud para restablecer la contraseña de su cuenta en el Portal OdontoLeal.</p>
    
    <div class="button-container">
      <a href="${recoveryLink}" class="btn-gold" target="_blank" rel="noopener">Restablecer mi Contraseña</a>
    </div>

    <div class="alert-box">
      ⏳ <strong>Aviso de seguridad:</strong> Este enlace es de un solo uso y vencerá en <strong>${expiresInMinutes} minutos</strong>. Si usted no realizó esta solicitud, puede ignorar este mensaje; su cuenta continuará protegida.
    </div>

    <p style="font-size: 12px; color: #6B7280;">Si el botón no funciona en su cliente de correo, copie y pegue la siguiente dirección en su navegador:</p>
    <p class="raw-link">${recoveryLink}</p>

    <div class="footer">
      © 2026 Consultorio Odontológico Dr. Eduar Leal Álvarez • Todos los derechos reservados.
    </div>
  </div>
</body>
</html>
    `;

    try {
      const transporter = await this.getTransporter();

      const info = await transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'Recuperación de contraseña - Portal OdontoLeal',
        text: `Hola ${nombreCompleto}.\n\nPara restablecer su contraseña en el Portal OdontoLeal, acceda al siguiente enlace (válido por ${expiresInMinutes} minutos):\n\n${recoveryLink}\n\nSi usted no realizó esta solicitud, ignore este mensaje.`,
        html: htmlContent,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || null;

      console.log(`\n======================================================`);
      console.log(`📨 CORREO DE RECUPERACIÓN PROCESADO`);
      console.log(`Destinatario: ${to}`);
      console.log(`Enlace generado: ${recoveryLink}`);

      if (previewUrl) {
        console.log(`🔗 Vista previa online (Ethereal Email Free): ${previewUrl}`);
      } else {
        console.log(`✅ Correo entregado al servidor SMTP para envío a bandeja real.`);
      }
      console.log(`======================================================\n`);

      return {
        messageId: info.messageId,
        previewUrl,
      };
    } catch (err: any) {
      console.error('❌ Error al enviar correo de recuperación:', err?.message);
      console.log(`ℹ️ Enlace de recuperación generado para contingencia: ${recoveryLink}`);
      return {
        previewUrl: null,
      };
    }
  }

  /**
   * Envía confirmación de cita agendada por correo electrónico al paciente.
   */
  async sendAppointmentConfirmationEmail(params: {
    to: string;
    nombrePaciente: string;
    fecha: string;
    hora: string;
    doctor: string;
    motivo: string;
    idCita?: number;
  }): Promise<{ messageId?: string; previewUrl?: string | null }> {
    const { to, nombrePaciente, fecha, hora, doctor, motivo, idCita } = params;

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Confirmación de Cita - OdontoLeal</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F9FA; margin: 0; padding: 24px; color: #1E242B; }
    .card { max-width: 540px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E6EA; border-top: 5px solid #D4AF37; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .logo-badge { display: inline-block; background-color: #111111; color: #D4AF37; font-size: 12px; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 14px; border-radius: 999px; }
    h1 { font-size: 22px; font-weight: 800; color: #1E242B; margin: 16px 0 8px 0; }
    .details { background-color: #FBF6E6; border: 1px solid #EAD89B; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .detail-item { margin: 8px 0; font-size: 14px; }
    .label { font-weight: bold; color: #687380; }
    .value { font-weight: 600; color: #1E242B; }
    .alert-box { background-color: #EEF7FF; border-left: 4px solid #3B82F6; padding: 12px; border-radius: 8px; margin: 16px 0; font-size: 13px; color: #1E40AF; }
    .footer { text-align: center; font-size: 12px; color: #8F99A3; margin-top: 24px; border-top: 1px solid #E2E6EA; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="text-align: center;">
      <span class="logo-badge">CONSULTORIO ODONTOLEAL</span>
      <h1>¡Tu cita ha sido confirmada!</h1>
      <p style="color: #687380; font-size: 14px;">Hemos reservado tu espacio en nuestra agenda médica.</p>
    </div>

    <p>Estimado(a) <strong>${nombrePaciente}</strong>,</p>
    <p>Le informamos que su cita odontológica ha sido programada con éxito con los siguientes datos:</p>

    <div class="details">
      <div class="detail-item"><span class="label">📅 Fecha:</span> <span class="value">${fecha}</span></div>
      <div class="detail-item"><span class="label">⏰ Hora:</span> <span class="value">${hora}</span></div>
      <div class="detail-item"><span class="label">👨‍⚕️ Profesional:</span> <span class="value">${doctor}</span></div>
      <div class="detail-item"><span class="label">📋 Motivo / Tratamiento:</span> <span class="value">${motivo}</span></div>
      ${idCita ? `<div class="detail-item"><span class="label">🔢 Cita N°:</span> <span class="value">#${idCita}</span></div>` : ''}
    </div>

    <div class="alert-box">
      📍 <strong>Ubicación:</strong> Calle 127 # 14-54, Edificio Medical Prestige, Suite 402, Bogotá.<br>
      ⏰ <em>Por favor presentarse con 10 minutos de anticipación.</em>
    </div>

    <p style="font-size: 13px; color: #687380;">Para cancelar o reprogramar, por favor comuníquese con al menos 24 horas de antelación al WhatsApp <strong>+57 300 123 4567</strong> o respondiendo a este correo.</p>

    <div class="footer">
      © 2026 Consultorio Odontológico Dr. Eduar Leal Álvarez • Bogotá, Colombia
    </div>
  </div>
</body>
</html>
    `;

    try {
      const transporter = await this.getTransporter();
      const info = await transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: `Confirmación de Cita Odontológica - ${fecha} a las ${hora}`,
        text: `Hola ${nombrePaciente}.\n\nTu cita en OdontoLeal ha sido confirmada para el día ${fecha} a las ${hora} con ${doctor}.\nMotivo: ${motivo}.\nDirección: Calle 127 # 14-54, Suite 402, Bogotá.`,
        html: htmlContent,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || null;
      console.log(`📧 Confirmación de cita enviada a ${to}. Mensaje ID: ${info.messageId}`);
      return { messageId: info.messageId, previewUrl };
    } catch (err: any) {
      console.error('❌ Error enviando correo de confirmación de cita:', err?.message);
      return { previewUrl: null };
    }
  }

  /**
   * Envía recordatorio de cita (24 horas antes) por correo electrónico.
   */
  async sendAppointmentReminderEmail(params: {
    to: string;
    nombrePaciente: string;
    fecha: string;
    hora: string;
    doctor: string;
  }): Promise<{ messageId?: string; previewUrl?: string | null }> {
    const { to, nombrePaciente, fecha, hora, doctor } = params;

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Recordatorio de Cita - OdontoLeal</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F9FA; margin: 0; padding: 24px; color: #1E242B; }
    .card { max-width: 540px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E6EA; border-top: 5px solid #D4AF37; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .logo-badge { display: inline-block; background-color: #111111; color: #D4AF37; font-size: 12px; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 14px; border-radius: 999px; }
    h1 { font-size: 22px; font-weight: 800; color: #1E242B; margin: 16px 0 8px 0; }
    .details { background-color: #FBF6E6; border: 1px solid #EAD89B; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .detail-item { margin: 8px 0; font-size: 14px; }
    .label { font-weight: bold; color: #687380; }
    .value { font-weight: 600; color: #1E242B; }
    .footer { text-align: center; font-size: 12px; color: #8F99A3; margin-top: 24px; border-top: 1px solid #E2E6EA; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="text-align: center;">
      <span class="logo-badge">CONSULTORIO ODONTOLEAL</span>
      <h1>Recordatorio de tu Cita Odontológica</h1>
      <p style="color: #687380; font-size: 14px;">Te esperamos mañana en nuestro consultorio.</p>
    </div>

    <p>Hola <strong>${nombrePaciente}</strong>,</p>
    <p>Te recordamos que tienes una cita programada para el día de mañana:</p>

    <div class="details">
      <div class="detail-item"><span class="label">📅 Fecha:</span> <span class="value">${fecha}</span></div>
      <div class="detail-item"><span class="label">⏰ Hora:</span> <span class="value">${hora}</span></div>
      <div class="detail-item"><span class="label">👨‍⚕️ Profesional:</span> <span class="value">${doctor}</span></div>
      <div class="detail-item"><span class="label">📍 Consultorio:</span> <span class="value">Calle 127 # 14-54, Suite 402, Bogotá</span></div>
    </div>

    <p style="font-size: 13px; color: #687380;">Agradecemos confirmar tu asistencia respondiendo a este mensaje o avisarnos oportunamente en caso de requerir reprogramar.</p>

    <div class="footer">
      © 2026 Consultorio Odontológico Dr. Eduar Leal Álvarez • Bogotá, Colombia
    </div>
  </div>
</body>
</html>
    `;

    try {
      const transporter = await this.getTransporter();
      const info = await transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: `Recordatorio de Cita Odontológica: Mañana ${fecha} a las ${hora}`,
        text: `Hola ${nombrePaciente}.\n\nTe recordamos tu cita mañana ${fecha} a las ${hora} con ${doctor} en el Consultorio OdontoLeal (Calle 127 # 14-54, Suite 402, Bogotá).`,
        html: htmlContent,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || null;
      console.log(`📧 Recordatorio de cita enviado a ${to}. Mensaje ID: ${info.messageId}`);
      return { messageId: info.messageId, previewUrl };
    } catch (err: any) {
      console.error('❌ Error enviando recordatorio de cita:', err?.message);
      return { previewUrl: null };
    }
  }

  /**
   * Envía confirmación de solicitud pública de cita recibida (sujeta a confirmación) (RF-AGE-003).
   */
  /**
   * Envía notificación de cita asignada / confirmada al doctor (RF-AGE-005).
   */
  async sendDoctorAppointmentNotificationEmail(params: {
    to: string;
    doctorName: string;
    patientName: string;
    fecha: string;
    hora: string;
    motivo: string;
    idCita?: number;
    telefonoPaciente?: string;
  }): Promise<{ messageId?: string; previewUrl?: string | null }> {
    const { to, doctorName, patientName, fecha, hora, motivo, idCita, telefonoPaciente } = params;

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Nueva Cita Asignada - OdontoLeal</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F9FA; margin: 0; padding: 24px; color: #1E242B; }
    .card { max-width: 560px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E6EA; border-top: 5px solid #D4AF37; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .logo-badge { display: inline-block; background-color: #111111; color: #D4AF37; font-size: 12px; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 14px; border-radius: 999px; }
    h1 { font-size: 22px; font-weight: 800; color: #1E242B; margin: 16px 0 8px 0; }
    .details { background-color: #F8F9FA; border: 1px solid #E2E6EA; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .detail-item { margin: 8px 0; font-size: 14px; }
    .label { font-weight: bold; color: #687380; }
    .value { font-weight: 600; color: #1E242B; }
    .highlight-box { background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 12px; padding: 14px; margin: 16px 0; font-size: 13px; color: #065F46; }
    .footer { text-align: center; font-size: 12px; color: #8F99A3; margin-top: 24px; border-top: 1px solid #E2E6EA; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="text-align: center;">
      <span class="logo-badge">CONSULTORIO ODONTOLEAL • AGENDA MÉDICA</span>
      <h1>Nueva Cita Confirmada</h1>
      <p style="color: #687380; font-size: 14px;">Se ha programado una nueva atención en tu agenda clínica.</p>
    </div>

    <p>Estimado(a) <strong>${doctorName}</strong>,</p>
    <p>Te informamos que se ha confirmado una cita en tu agenda médica:</p>

    <div class="details">
      <div class="detail-item"><span class="label">👤 Paciente:</span> <span class="value">${patientName}</span></div>
      ${telefonoPaciente ? `<div class="detail-item"><span class="label">📞 Teléfono contacto:</span> <span class="value">${telefonoPaciente}</span></div>` : ''}
      <div class="detail-item"><span class="label">📅 Fecha:</span> <span class="value">${fecha}</span></div>
      <div class="detail-item"><span class="label">⏰ Horario:</span> <span class="value">${hora}</span></div>
      <div class="detail-item"><span class="label">📋 Procedimiento / Motivo:</span> <span class="value">${motivo}</span></div>
      ${idCita ? `<div class="detail-item"><span class="label">🔢 N° Cita Clínica:</span> <span class="value">#${idCita}</span></div>` : ''}
    </div>

    <div class="highlight-box">
      ✅ <strong>Cita Agendada y Notificada:</strong><br>
      El paciente ha recibido su comprobante por correo electrónico y el espacio en tu agenda se encuentra reservado para esta atención.
    </div>

    <p style="font-size: 13px; color: #687380;">Puedes consultar la historia clínica previa o gestionar la evolución desde el sistema OdontoLeal.</p>

    <div class="footer">
      © 2026 Consultorio Odontológico Dr. Eduar Leal Álvarez • Bogotá, Colombia
    </div>
  </div>
</body>
</html>
    `;

    try {
      const transporter = await this.getTransporter();
      const info = await transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: `Nueva Cita Asignada - ${fecha} a las ${hora} (${patientName})`,
        text: `Hola ${doctorName}.\n\nSe te ha asignado una nueva cita con el paciente ${patientName} para el día ${fecha} a las ${hora}.\nMotivo: ${motivo}.\nN° Cita: #${idCita || ''}`,
        html: htmlContent,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || null;
      console.log(`📧 Notificación enviada al doctor ${to}. Mensaje ID: ${info.messageId}`);
      return { messageId: info.messageId, previewUrl };
    } catch (err: any) {
      console.error('❌ Error enviando correo de notificación a doctor:', err?.message);
      return { previewUrl: null };
    }
  }

  async sendPublicRequestReceivedEmail(params: {
    to: string;
    nombreSolicitante: string;
    fecha: string;
    hora: string;
    doctor: string;
    motivo: string;
    idSolicitud?: number;
  }): Promise<{ messageId?: string; previewUrl?: string | null }> {
    const { to, nombreSolicitante, fecha, hora, doctor, motivo, idSolicitud } = params;

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Solicitud de Cita Recibida - OdontoLeal</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F9FA; margin: 0; padding: 24px; color: #1E242B; }
    .card { max-width: 540px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E6EA; border-top: 5px solid #D4AF37; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .logo-badge { display: inline-block; background-color: #111111; color: #D4AF37; font-size: 12px; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 14px; border-radius: 999px; }
    h1 { font-size: 22px; font-weight: 800; color: #1E242B; margin: 16px 0 8px 0; }
    .details { background-color: #FBF6E6; border: 1px solid #EAD89B; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .detail-item { margin: 8px 0; font-size: 14px; }
    .label { font-weight: bold; color: #687380; }
    .value { font-weight: 600; color: #1E242B; }
    .alert-box { background-color: #FEF3C7; border-left: 4px solid #D97706; padding: 12px; border-radius: 8px; margin: 16px 0; font-size: 13px; color: #92400E; }
    .footer { text-align: center; font-size: 12px; color: #8F99A3; margin-top: 24px; border-top: 1px solid #E2E6EA; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="text-align: center;">
      <span class="logo-badge">CONSULTORIO ODONTOLEAL</span>
      <h1>Solicitud de Cita Recibida</h1>
      <p style="color: #687380; font-size: 14px;">Hemos recibido tu solicitud y reservado provisionalmente tu espacio.</p>
    </div>

    <p>Estimado(a) <strong>${nombreSolicitante}</strong>,</p>
    <p>Confirmamos la recepción de tu solicitud de cita odontológica a través de nuestro portal web:</p>

    <div class="details">
      <div class="detail-item"><span class="label">📅 Fecha solicitada:</span> <span class="value">${fecha}</span></div>
      <div class="detail-item"><span class="label">⏰ Hora:</span> <span class="value">${hora}</span></div>
      <div class="detail-item"><span class="label">👨‍⚕️ Profesional:</span> <span class="value">${doctor}</span></div>
      <div class="detail-item"><span class="label">📋 Motivo:</span> <span class="value">${motivo}</span></div>
      ${idSolicitud ? `<div class="detail-item"><span class="label">🔢 Solicitud N°:</span> <span class="value">#${idSolicitud}</span></div>` : ''}
    </div>

    <div class="alert-box">
      ⏳ <strong>Estado: Sujeto a aprobación</strong><br>
      El equipo de coordinación del consultorio revisará tu solicitud y te notificará la confirmación definitiva.
    </div>

    <p style="font-size: 13px; color: #687380;">
      Para cualquier consulta, cambio o cancelación, comunícate directamente con nuestro consultorio al teléfono / WhatsApp: <strong>+57 300 123 4567</strong>.
    </p>

    <div class="footer">
      © 2026 Consultorio Odontológico Dr. Eduar Leal Álvarez • Bogotá, Colombia
    </div>
  </div>
</body>
</html>
    `;

    try {
      const transporter = await this.getTransporter();
      const info = await transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: `Solicitud de Cita Recibida en OdontoLeal - ${fecha} a las ${hora}`,
        text: `Hola ${nombreSolicitante}.\n\nHemos recibido tu solicitud de cita para el día ${fecha} a las ${hora} con ${doctor}.\nMotivo: ${motivo}.\nEl consultorio revisará tu solicitud para confirmarla definitivamente. Para cambios comunícate al +57 300 123 4567.`,
        html: htmlContent,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || null;
      console.log(`📧 Solicitud pública confirmada por correo a ${to}. Mensaje ID: ${info.messageId}`);
      return { messageId: info.messageId, previewUrl };
    } catch (err: any) {
      console.error('❌ Error enviando correo de solicitud pública:', err?.message);
      return { previewUrl: null };
    }
  }

  /**
   * Envía alerta de nueva solicitud externa recibida a los coordinadores de agendamiento o administrador (RF-AGE-004).
   */
  async sendCoordinatorNewRequestAlertEmail(params: {
    to: string;
    staffName: string;
    requesterName: string;
    requesterDni: string;
    requesterEmail: string;
    requesterPhone?: string;
    requestedDate: string;
    requestedTime: string;
    motive: string;
    idSolicitud?: number;
  }): Promise<{ messageId?: string; previewUrl?: string | null }> {
    const {
      to,
      staffName,
      requesterName,
      requesterDni,
      requesterEmail,
      requesterPhone,
      requestedDate,
      requestedTime,
      motive,
      idSolicitud,
    } = params;

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Nueva Solicitud de Cita Recibida - OdontoLeal</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F9FA; margin: 0; padding: 24px; color: #1E242B; }
    .card { max-width: 560px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E6EA; border-top: 5px solid #D4AF37; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .logo-badge { display: inline-block; background-color: #111111; color: #D4AF37; font-size: 12px; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 14px; border-radius: 999px; }
    h1 { font-size: 22px; font-weight: 800; color: #1E242B; margin: 16px 0 8px 0; }
    .details { background-color: #F8F9FA; border: 1px solid #E2E6EA; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .detail-item { margin: 8px 0; font-size: 14px; }
    .label { font-weight: bold; color: #687380; }
    .value { font-weight: 600; color: #1E242B; }
    .notice-box { background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 12px; padding: 14px; margin: 16px 0; font-size: 13px; color: #1E40AF; }
    .footer { text-align: center; font-size: 12px; color: #8F99A3; margin-top: 24px; border-top: 1px solid #E2E6EA; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="text-align: center;">
      <span class="logo-badge">CONSULTORIO ODONTOLEAL • COORDINACIÓN DE AGENDAMIENTO</span>
      <h1>Nueva Solicitud de Cita Externa</h1>
      <p style="color: #687380; font-size: 14px;">Un paciente ha registrado una solicitud de cita médica pendiente de revisión.</p>
    </div>

    <p>Estimado(a) <strong>${staffName}</strong>,</p>
    <p>Se ha recibido una nueva solicitud de cita a través del portal web oficial:</p>

    <div class="details">
      <div class="detail-item"><span class="label">👤 Paciente Solicitante:</span> <span class="value">${requesterName}</span></div>
      <div class="detail-item"><span class="label">🪪 Documento de Identidad:</span> <span class="value">${requesterDni}</span></div>
      <div class="detail-item"><span class="label">✉ Correo Electrónico:</span> <span class="value">${requesterEmail}</span></div>
      ${requesterPhone ? `<div class="detail-item"><span class="label">📞 Teléfono de Contacto:</span> <span class="value">${requesterPhone}</span></div>` : ''}
      <div class="detail-item"><span class="label">📅 Fecha Solicitada:</span> <span class="value">${requestedDate}</span></div>
      <div class="detail-item"><span class="label">⏰ Hora Solicitada:</span> <span class="value">${requestedTime}</span></div>
      <div class="detail-item"><span class="label">📋 Motivo / Síntomas:</span> <span class="value">${motive}</span></div>
      ${idSolicitud ? `<div class="detail-item"><span class="label">🔢 N° Solicitud:</span> <span class="value">#${idSolicitud}</span></div>` : ''}
    </div>

    <div class="notice-box">
      🔔 <strong>Acción Requerida:</strong><br>
      El bloque de horario ha quedado reservado provisionalmente. Por favor ingresa al módulo de <strong>Agenda Médica</strong> para revisar la solicitud, asignar el profesional correspondiente y confirmarla o rechazarla.
    </div>

    <div class="footer">
      © 2026 Consultorio Odontológico Dr. Eduar Leal Álvarez • Bogotá, Colombia
    </div>
  </div>
</body>
</html>
    `;

    try {
      const transporter = await this.getTransporter();
      const info = await transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: `Nueva Solicitud de Cita Recibida en Portal Web - ${requesterName} (#${idSolicitud || 'Web'})`,
        text: `Hola ${staffName}.\n\nSe ha recibido una nueva solicitud de cita de ${requesterName} (Doc: ${requesterDni}, Tel: ${requesterPhone || 'N/A'}) para el ${requestedDate} a las ${requestedTime}.\nMotivo: ${motive}.\nPor favor ingresa a la Agenda Médica para gestionarla.`,
        html: htmlContent,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || null;
      console.log(`📧 Alerta de nueva solicitud enviada a coordinación (${to}). Mensaje ID: ${info.messageId}`);
      return { messageId: info.messageId, previewUrl };
    } catch (err: any) {
      console.error('❌ Error enviando correo de alerta a coordinación:', err?.message);
      return { previewUrl: null };
    }
  }

  /**
   * Envía correo de reprogramación / modificación de cita al paciente (RF-AGE-006).
   */
  async sendAppointmentRescheduledEmail(params: {
    to: string;
    nombrePaciente: string;
    fecha: string;
    hora: string;
    doctor: string;
    motivo: string;
    idCita?: number;
    notas?: string;
  }): Promise<{ messageId?: string; previewUrl?: string | null }> {
    const { to, nombrePaciente, fecha, hora, doctor, motivo, idCita, notas } = params;

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Cita Modificada - OdontoLeal</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F9FA; margin: 0; padding: 24px; color: #1E242B; }
    .card { max-width: 540px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E6EA; border-top: 5px solid #D4AF37; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .logo-badge { display: inline-block; background-color: #111111; color: #D4AF37; font-size: 12px; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 14px; border-radius: 999px; }
    h1 { font-size: 22px; font-weight: 800; color: #1E242B; margin: 16px 0 8px 0; }
    .details { background-color: #FBF6E6; border: 1px solid #EAD89B; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .detail-item { margin: 8px 0; font-size: 14px; }
    .label { font-weight: bold; color: #687380; }
    .value { font-weight: 600; color: #1E242B; }
    .alert-box { background-color: #FEF3C7; border-left: 4px solid #D97706; padding: 12px; border-radius: 8px; margin: 16px 0; font-size: 13px; color: #92400E; }
    .footer { text-align: center; font-size: 12px; color: #8F99A3; margin-top: 24px; border-top: 1px solid #E2E6EA; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="text-align: center;">
      <span class="logo-badge">CONSULTORIO ODONTOLEAL • ACTUALIZACIÓN</span>
      <h1>Tu cita ha sido modificada</h1>
      <p style="color: #687380; font-size: 14px;">Te informamos que tu cita médica en nuestra agenda ha sido actualizada.</p>
    </div>

    <p>Estimado(a) <strong>${nombrePaciente}</strong>,</p>
    <p>Le notificamos que su cita odontológica ha sido modificada con los siguientes datos actualizados:</p>

    <div class="details">
      <div class="detail-item"><span class="label">📅 Nueva Fecha:</span> <span class="value">${fecha}</span></div>
      <div class="detail-item"><span class="label">⏰ Nuevo Horario:</span> <span class="value">${hora}</span></div>
      <div class="detail-item"><span class="label">👨‍⚕️ Profesional Asignado:</span> <span class="value">${doctor}</span></div>
      <div class="detail-item"><span class="label">📋 Procedimiento / Motivo:</span> <span class="value">${motivo}</span></div>
      ${idCita ? `<div class="detail-item"><span class="label">🔢 Cita N°:</span> <span class="value">#${idCita}</span></div>` : ''}
      ${notas ? `<div class="detail-item"><span class="label">📝 Observaciones:</span> <span class="value">${notas}</span></div>` : ''}
    </div>

    <div class="alert-box">
      📍 <strong>Ubicación:</strong> Calle 127 # 14-54, Edificio Medical Prestige, Suite 402, Bogotá.<br>
      ⏰ <em>Por favor presentarse con 10 minutos de anticipación al nuevo horario establecido.</em>
    </div>

    <p style="font-size: 13px; color: #687380;">Si tienes alguna pregunta o requieres una reprogramación adicional, comunícate directamente al WhatsApp <strong>+57 300 123 4567</strong>.</p>

    <div class="footer">
      © 2026 Consultorio Odontológico Dr. Eduar Leal Álvarez • Bogotá, Colombia
    </div>
  </div>
</body>
</html>
    `;

    try {
      const transporter = await this.getTransporter();
      const info = await transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: `Actualización de Cita Odontológica: ${fecha} a las ${hora}`,
        text: `Hola ${nombrePaciente}.\n\nTu cita en OdontoLeal ha sido modificada.\nNueva fecha: ${fecha}\nNuevo horario: ${hora}\nProfesional: ${doctor}\nMotivo: ${motivo}\nUbicación: Calle 127 # 14-54, Suite 402, Bogotá.`,
        html: htmlContent,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || null;
      console.log(`📧 Notificación de cita modificada enviada al paciente ${to}. Mensaje ID: ${info.messageId}`);
      return { messageId: info.messageId, previewUrl };
    } catch (err: any) {
      console.error('❌ Error enviando correo de cita modificada al paciente:', err?.message);
      return { previewUrl: null };
    }
  }

  /**
   * Envía correo de reprogramación / modificación de cita al doctor (RF-AGE-006).
   */
  async sendDoctorAppointmentRescheduledEmail(params: {
    to: string;
    doctorName: string;
    patientName: string;
    fecha: string;
    hora: string;
    motivo: string;
    idCita?: number;
    telefonoPaciente?: string;
    notas?: string;
  }): Promise<{ messageId?: string; previewUrl?: string | null }> {
    const { to, doctorName, patientName, fecha, hora, motivo, idCita, telefonoPaciente, notas } = params;

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Cita Modificada en Agenda - OdontoLeal</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F9FA; margin: 0; padding: 24px; color: #1E242B; }
    .card { max-width: 560px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E6EA; border-top: 5px solid #D4AF37; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .logo-badge { display: inline-block; background-color: #111111; color: #D4AF37; font-size: 12px; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 14px; border-radius: 999px; }
    h1 { font-size: 22px; font-weight: 800; color: #1E242B; margin: 16px 0 8px 0; }
    .details { background-color: #F8F9FA; border: 1px solid #E2E6EA; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .detail-item { margin: 8px 0; font-size: 14px; }
    .label { font-weight: bold; color: #687380; }
    .value { font-weight: 600; color: #1E242B; }
    .highlight-box { background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 12px; padding: 14px; margin: 16px 0; font-size: 13px; color: #1E40AF; }
    .footer { text-align: center; font-size: 12px; color: #8F99A3; margin-top: 24px; border-top: 1px solid #E2E6EA; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="text-align: center;">
      <span class="logo-badge">CONSULTORIO ODONTOLEAL • AGENDA MÉDICA</span>
      <h1>Cita Modificada en tu Agenda</h1>
      <p style="color: #687380; font-size: 14px;">Se ha registrado un cambio de fecha, horario o datos en una atención de tu agenda.</p>
    </div>

    <p>Estimado(a) <strong>${doctorName}</strong>,</p>
    <p>Te informamos sobre la modificación de la siguiente cita en tu agenda clínica:</p>

    <div class="details">
      <div class="detail-item"><span class="label">👤 Paciente:</span> <span class="value">${patientName}</span></div>
      ${telefonoPaciente ? `<div class="detail-item"><span class="label">📞 Teléfono contacto:</span> <span class="value">${telefonoPaciente}</span></div>` : ''}
      <div class="detail-item"><span class="label">📅 Fecha Actualizada:</span> <span class="value">${fecha}</span></div>
      <div class="detail-item"><span class="label">⏰ Horario Actualizado:</span> <span class="value">${hora}</span></div>
      <div class="detail-item"><span class="label">📋 Procedimiento / Motivo:</span> <span class="value">${motivo}</span></div>
      ${idCita ? `<div class="detail-item"><span class="label">🔢 N° Cita Clínica:</span> <span class="value">#${idCita}</span></div>` : ''}
      ${notas ? `<div class="detail-item"><span class="label">📝 Observaciones:</span> <span class="value">${notas}</span></div>` : ''}
    </div>

    <div class="highlight-box">
      ℹ️ <strong>Estado Actualizado:</strong><br>
      Los bloques horarios han sido actualizados en la base de datos y el paciente ha recibido la notificación correspondiente.
    </div>

    <div class="footer">
      © 2026 Consultorio Odontológico Dr. Eduar Leal Álvarez • Bogotá, Colombia
    </div>
  </div>
</body>
</html>
    `;

    try {
      const transporter = await this.getTransporter();
      const info = await transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: `Cita Modificada en tu Agenda - ${fecha} a las ${hora} (${patientName})`,
        text: `Hola ${doctorName}.\n\nSe ha modificado la cita con el paciente ${patientName}.\nNueva fecha: ${fecha}\nNuevo horario: ${hora}\nMotivo: ${motivo}\nN° Cita: #${idCita || ''}`,
        html: htmlContent,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || null;
      console.log(`📧 Notificación de cita modificada enviada al doctor ${to}. Mensaje ID: ${info.messageId}`);
      return { messageId: info.messageId, previewUrl };
    } catch (err: any) {
      console.error('❌ Error enviando correo de cita modificada al doctor:', err?.message);
      return { previewUrl: null };
    }
  }
}
