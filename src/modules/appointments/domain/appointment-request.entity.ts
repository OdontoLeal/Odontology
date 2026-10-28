// src/modules/appointments/domain/appointment-request.entity.ts
import { DentalServiceType } from './appointment.entity';
import { TimeSlotEntity } from './time-slot.entity';

export interface AppointmentRequestProps {
  idSolicitud?: number;
  nombreSolicitante: string;
  documentoSolicitante: string;
  correoSolicitante: string;
  telefonoSolicitante?: string;
  fechaNacimiento?: Date;
  servicio?: DentalServiceType;
  idProfesional?: number;
  bloquesSolicitados: Date[]; // En BD solicitud_cita.bloque_solicitado guarda el bloque inicial y se reservan hasta 4 contiguos
  descripcion: string | null;
  autorizacionDatosAceptada: boolean;
  versionAvisoPrivacidad?: string;
  fechaSolicitud?: Date;
  estado: boolean; // true = Pendiente/Activa, false = Gestionada (Confirmada, Rechazada o Cancelada)
}

export class AppointmentRequestEntity {
  public static readonly MIN_ADVANCE_DAYS = 5; // Mínimo 5 días calendario después de hoy (Regla de Negocio 2)
  public static readonly MAX_ADVANCE_DAYS = 60; // Máximo 60 días calendario después de hoy (Regla de Negocio 2)
  public static readonly MAX_CONTIGUOUS_BLOCKS = 4; // Hasta 4 bloques contiguos de 30 min (RF-AGE-003)

  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly DOCUMENT_REGEX = /^\d+$/;
  private static readonly PHONE_REGEX = /^\d{10}$/;

  public readonly idSolicitud?: number;
  public readonly nombreSolicitante: string;
  public readonly documentoSolicitante: string;
  public readonly correoSolicitante: string;
  public readonly telefonoSolicitante?: string;
  public readonly fechaNacimiento?: Date;
  public readonly servicio: DentalServiceType;
  public readonly idProfesional?: number;
  private _bloquesSolicitados: Date[];
  public readonly descripcion: string | null;
  public readonly autorizacionDatosAceptada: boolean;
  public readonly versionAvisoPrivacidad: string;
  public readonly fechaSolicitud: Date;
  private _estado: boolean;

  private constructor(props: AppointmentRequestProps) {
    this.idSolicitud = props.idSolicitud;
    this.nombreSolicitante = props.nombreSolicitante.trim();
    this.documentoSolicitante = props.documentoSolicitante.trim();
    this.correoSolicitante = props.correoSolicitante.trim().toLowerCase();
    this.telefonoSolicitante = props.telefonoSolicitante?.trim();
    this.fechaNacimiento = props.fechaNacimiento ? new Date(props.fechaNacimiento.getTime()) : undefined;
    this.servicio = props.servicio ?? 'Odontología general';
    this.idProfesional = props.idProfesional;
    this._bloquesSolicitados = [...props.bloquesSolicitados]
      .map((b) => new Date(b.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    this.descripcion = props.descripcion ? props.descripcion.trim() : null;
    this.autorizacionDatosAceptada = props.autorizacionDatosAceptada;
    this.versionAvisoPrivacidad = props.versionAvisoPrivacidad ?? '1.0';
    this.fechaSolicitud = props.fechaSolicitud ? new Date(props.fechaSolicitud.getTime()) : new Date();
    this._estado = props.estado;
  }

  public get bloqueInicial(): Date {
    return new Date(this._bloquesSolicitados[0].getTime());
  }

  public get bloquesSolicitados(): ReadonlyArray<Date> {
    return this._bloquesSolicitados.map((d) => new Date(d.getTime()));
  }

  public get estado(): boolean {
    return this._estado;
  }

  /**
   * RF-AGE-003: Crea y valida una nueva solicitud pública de cita desde la sección sin sesión.
   */
  public static createPublicRequest(params: {
    nombreSolicitante: string;
    documentoSolicitante: string;
    correoSolicitante: string;
    telefonoSolicitante?: string;
    fechaNacimiento?: Date | string;
    servicio?: DentalServiceType;
    idProfesional?: number;
    bloquesSolicitados: Array<Date | string>;
    descripcion?: string | null;
    autorizacionDatosAceptada: boolean;
    versionAvisoPrivacidad?: string;
    now?: Date;
  }): AppointmentRequestEntity {
    const now = params.now ?? new Date();

    // 1. Validar autorización expresa de tratamiento de datos (Ley 1581 de 2012, RQNF-SEG-005, RF-AGE-003)
    if (!params.autorizacionDatosAceptada) {
      throw new Error(
        'Debe aceptar la autorización de tratamiento de datos personales y el aviso de privacidad para enviar la solicitud (RF-AGE-003 / RQNF-SEG-005).'
      );
    }

    // 2. Validar datos de identificación y contacto del solicitante
    const cleanName = (params.nombreSolicitante ?? '').trim();
    if (!cleanName || cleanName.length > 150) {
      throw new Error('El nombre completo del solicitante es obligatorio y no puede exceder 150 caracteres (RF-AGE-003).');
    }

    const cleanDoc = (params.documentoSolicitante ?? '').trim();
    if (!cleanDoc || !AppointmentRequestEntity.DOCUMENT_REGEX.test(cleanDoc) || cleanDoc.length > 20) {
      throw new Error(
        'El documento de identidad del solicitante es obligatorio, debe contener solo dígitos y máximo 20 caracteres (RF-AGE-003).'
      );
    }

    const cleanEmail = (params.correoSolicitante ?? '').trim().toLowerCase();
    if (!cleanEmail || !AppointmentRequestEntity.EMAIL_REGEX.test(cleanEmail) || cleanEmail.length > 150) {
      throw new Error('El correo electrónico del solicitante es obligatorio y debe tener un formato válido (RF-AGE-003).');
    }

    if (params.telefonoSolicitante !== undefined && params.telefonoSolicitante.trim() !== '') {
      if (!AppointmentRequestEntity.PHONE_REGEX.test(params.telefonoSolicitante.trim())) {
        throw new Error('El teléfono del solicitante debe contener exactamente 10 dígitos numéricos (RF-AGE-003).');
      }
    }

    let parsedBirthDate: Date | undefined;
    if (params.fechaNacimiento) {
      parsedBirthDate =
        params.fechaNacimiento instanceof Date
          ? new Date(params.fechaNacimiento.getTime())
          : new Date(params.fechaNacimiento);
      if (Number.isNaN(parsedBirthDate.getTime()) || parsedBirthDate.getTime() > now.getTime()) {
        throw new Error('La fecha de nacimiento del solicitante no es válida o es una fecha futura (RF-AGE-003).');
      }
    }

    if (params.descripcion && params.descripcion.trim().length > 500) {
      throw new Error('El motivo o descripción de la solicitud no puede superar los 500 caracteres (RF-AGE-003).');
    }

    // 3. Validar cantidad de bloques (1 a 4 bloques contiguos del mismo día, RF-AGE-003)
    if (!Array.isArray(params.bloquesSolicitados) || params.bloquesSolicitados.length === 0) {
      throw new Error('Debe seleccionar al menos un bloque de horario disponible (RF-AGE-003).');
    }

    if (params.bloquesSolicitados.length > AppointmentRequestEntity.MAX_CONTIGUOUS_BLOCKS) {
      throw new Error(
        `El paciente puede elegir como máximo ${AppointmentRequestEntity.MAX_CONTIGUOUS_BLOCKS} bloques contiguos de un mismo día (RF-AGE-003).`
      );
    }

    const slotEntities = params.bloquesSolicitados.map((b) =>
      TimeSlotEntity.create({
        inicio: b,
        idProfesional: params.idProfesional,
      })
    );
    TimeSlotEntity.assertContiguousAndSameDay(slotEntities);

    const sortedDates = slotEntities.map((s) => s.inicio).sort((a, b) => a.getTime() - b.getTime());

    // 4. Validar Regla de Negocio 2: Ventana entre 5 y 60 días calendario después de la fecha de solicitud
    AppointmentRequestEntity.assertWithinAllowedWindow(sortedDates[0], now);

    return new AppointmentRequestEntity({
      nombreSolicitante: cleanName,
      documentoSolicitante: cleanDoc,
      correoSolicitante: cleanEmail,
      telefonoSolicitante: params.telefonoSolicitante,
      fechaNacimiento: parsedBirthDate,
      servicio: params.servicio ?? 'Odontología general',
      idProfesional: params.idProfesional,
      bloquesSolicitados: sortedDates,
      descripcion: params.descripcion ?? null,
      autorizacionDatosAceptada: true,
      versionAvisoPrivacidad: params.versionAvisoPrivacidad ?? '1.0',
      fechaSolicitud: now,
      estado: true,
    });
  }

  public static reconstitute(props: AppointmentRequestProps): AppointmentRequestEntity {
    return new AppointmentRequestEntity(props);
  }

  /**
   * Regla de Negocio 2: Las solicitudes de citas por parte de pacientes solo son válidas
   * para fechas entre 5 y 60 días calendario después de la fecha de la solicitud (ambos incluidos).
   */
  public static assertWithinAllowedWindow(targetBlockDate: Date, requestDate: Date = new Date()): void {
    const reqDayUtc = AppointmentRequestEntity.toColombiaMidnightUtc(requestDate);
    const targetDayUtc = AppointmentRequestEntity.toColombiaMidnightUtc(targetBlockDate);

    const diffCalendarDays = Math.round((targetDayUtc - reqDayUtc) / (1000 * 60 * 60 * 24));

    if (
      diffCalendarDays < AppointmentRequestEntity.MIN_ADVANCE_DAYS ||
      diffCalendarDays > AppointmentRequestEntity.MAX_ADVANCE_DAYS
    ) {
      throw new Error(
        `Solo se aceptan solicitudes para fechas entre ${AppointmentRequestEntity.MIN_ADVANCE_DAYS} y ${AppointmentRequestEntity.MAX_ADVANCE_DAYS} días calendario después de hoy (Regla de Negocio 2 / RF-AGE-003).`
      );
    }
  }

  private static toColombiaMidnightUtc(date: Date): number {
    const colombiaDate = new Date(date.getTime() - 5 * 60 * 60 * 1000);
    return Date.UTC(
      colombiaDate.getUTCFullYear(),
      colombiaDate.getUTCMonth(),
      colombiaDate.getUTCDate(),
      5
    );
  }

  /**
   * Indica si faltan 5 días o menos para la fecha solicitada (criterio del aviso diario 7:00 a. m. de RF-AGE-004).
   */
  public isWithinUrgentNotificationWindow(now: Date = new Date()): boolean {
    if (!this._estado) return false;
    const todayUtc = AppointmentRequestEntity.toColombiaMidnightUtc(now);
    const targetDayUtc = AppointmentRequestEntity.toColombiaMidnightUtc(this.bloqueInicial);
    const diffDays = Math.round((targetDayUtc - todayUtc) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 5;
  }

  /**
   * Marca la solicitud como gestionada al confirmarse o rechazarse (RF-AGE-005).
   */
  public markAsReviewed(params: {
    decision: 'CONFIRM' | 'REJECT';
    motivoRechazo?: string;
    nuevosBloques?: Date[];
  }): void {
    if (!this._estado) {
      throw new Error('Esta solicitud de cita ya fue gestionada previamente (RF-AGE-005).');
    }

    if (params.decision === 'REJECT') {
      const cleanMotivo = (params.motivoRechazo ?? '').trim();
      if (!cleanMotivo) {
        throw new Error('El motivo es obligatorio para rechazar una solicitud de cita (RF-AGE-005).');
      }
    }

    if (params.decision === 'CONFIRM' && params.nuevosBloques && params.nuevosBloques.length > 0) {
      const slotEntities = params.nuevosBloques.map((b) =>
        TimeSlotEntity.create({ inicio: b, idProfesional: this.idProfesional })
      );
      TimeSlotEntity.assertContiguousAndSameDay(slotEntities);
      this._bloquesSolicitados = slotEntities
        .map((slot) => new Date(slot.inicio.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
    }

    this._estado = false;
  }
}