// src/modules/appointments/domain/appointment.entity.ts

export type AppointmentState =
  | 'Solicitada'
  | 'Confirmada'
  | 'Rechazada'
  | 'En consulta'
  | 'Atendida'
  | 'Cancelada'
  | 'Inasistencia';

export type DentalServiceType = 'Odontología general' | 'Ortodoncia';

export type ReminderDeliveryState = 'Pendiente' | 'Enviado' | 'No enviado';

export interface AppointmentHistoryChange {
  idCambioCita?: number;
  idUsuarioGestor: number | null; // null cuando el actor es "Sistema" (RF-AGE-010)
  nombreUsuarioGestor: string; // Usuario autenticado o "Sistema" (Regla de Negocio 10)
  fechaHistorial: Date;
  estadoAnterior?: AppointmentState;
  estadoNuevo: AppointmentState;
  reporte: string;
  motivo?: string | null;
}

export interface AppointmentProps {
  idCita?: number;
  titulo: string;
  descripcion: string | null;
  idPaciente: number;
  idUsuario: number; // Profesional responsable (ROL-ODO o ROL-ESP)
  servicio?: DentalServiceType;
  estado: AppointmentState;
  bloques: Date[]; // Bloques de 30 min asociados en bloques_citas
  agendadoPorId?: number | null;
  agendadoPorNombre?: string;
  estadoRecordatorio?: ReminderDeliveryState;
  causaFalloRecordatorio?: string | null;
  historialCambios?: AppointmentHistoryChange[];
}

export class AppointmentEntity {
  public static readonly VALID_STATES: ReadonlyArray<AppointmentState> = [
    'Solicitada',
    'Confirmada',
    'Rechazada',
    'En consulta',
    'Atendida',
    'Cancelada',
    'Inasistencia',
  ];

  public static readonly FINAL_STATES: ReadonlyArray<AppointmentState> = [
    'Rechazada',
    'Atendida',
    'Cancelada',
    'Inasistencia',
  ];

  public static readonly MAX_TITLE_LENGTH = 50;
  public static readonly MAX_DESCRIPTION_LENGTH = 500;
  public static readonly MAX_MOTIVO_LENGTH = 500;

  public readonly idCita?: number;
  private _titulo: string;
  private _descripcion: string | null;
  public readonly idPaciente: number;
  private _idUsuario: number;
  private _servicio: DentalServiceType;
  private _estado: AppointmentState;
  private _bloques: Date[];
  public readonly agendadoPorId: number | null;
  public readonly agendadoPorNombre: string;
  private _estadoRecordatorio: ReminderDeliveryState;
  private _causaFalloRecordatorio: string | null;
  private _historialCambios: AppointmentHistoryChange[];

  private constructor(props: AppointmentProps) {
    this.idCita = props.idCita;
    this._titulo = props.titulo.trim();
    this._descripcion = props.descripcion ? props.descripcion.trim() : null;
    this.idPaciente = props.idPaciente;
    this._idUsuario = props.idUsuario;
    this._servicio = props.servicio ?? 'Odontología general';
    this._estado = props.estado;
    this._bloques = [...props.bloques].map((b) => new Date(b.getTime())).sort((a, b) => a.getTime() - b.getTime());
    this.agendadoPorId = props.agendadoPorId ?? null;
    this.agendadoPorNombre = props.agendadoPorNombre ?? 'Sistema';
    this._estadoRecordatorio = props.estadoRecordatorio ?? 'Pendiente';
    this._causaFalloRecordatorio = props.causaFalloRecordatorio ?? null;
    this._historialCambios = props.historialCambios ? [...props.historialCambios] : [];
  }

  public get titulo(): string {
    return this._titulo;
  }

  public get descripcion(): string | null {
    return this._descripcion;
  }

  public get idUsuario(): number {
    return this._idUsuario;
  }

  public get servicio(): DentalServiceType {
    return this._servicio;
  }

  public get estado(): AppointmentState {
    return this._estado;
  }

  public get bloques(): ReadonlyArray<Date> {
    return this._bloques.map((d) => new Date(d.getTime()));
  }

  public get horaInicio(): Date {
    return new Date(this._bloques[0].getTime());
  }

  public get horaFinal(): Date {
    const lastBlock = this._bloques[this._bloques.length - 1];
    return new Date(lastBlock.getTime() + 30 * 60 * 1000);
  }

  public get estadoRecordatorio(): ReminderDeliveryState {
    return this._estadoRecordatorio;
  }

  public get causaFalloRecordatorio(): string | null {
    return this._causaFalloRecordatorio;
  }

  public get historialCambios(): ReadonlyArray<AppointmentHistoryChange> {
    return [...this._historialCambios];
  }

  public static validateTextFields(titulo: string, descripcion?: string | null): void {
    const cleanTitle = (titulo ?? '').trim();
    if (!cleanTitle) {
      throw new Error('El título de la cita es obligatorio.');
    }
    if (cleanTitle.length > AppointmentEntity.MAX_TITLE_LENGTH) {
      throw new Error(`El título de la cita no puede superar los ${AppointmentEntity.MAX_TITLE_LENGTH} caracteres (RF-AGE-002).`);
    }
    if (descripcion && descripcion.trim().length > AppointmentEntity.MAX_DESCRIPTION_LENGTH) {
      throw new Error(
        `La descripción de la cita no puede superar los ${AppointmentEntity.MAX_DESCRIPTION_LENGTH} caracteres (RF-AGE-002).`
      );
    }
  }

  public static validateContiguousBlocks(bloques: Date[]): void {
    if (!Array.isArray(bloques) || bloques.length === 0) {
      throw new Error('Debe asignar al menos un bloque de horario a la cita (RF-AGE-002).');
    }

    const sorted = [...bloques].map((b) => new Date(b.getTime())).sort((a, b) => a.getTime() - b.getTime());
    const firstDay = AppointmentEntity.toColombiaDateString(sorted[0]);

    for (let i = 0; i < sorted.length; i++) {
      if (AppointmentEntity.toColombiaDateString(sorted[i]) !== firstDay) {
        throw new Error('Todos los bloques de la cita deben pertenecer al mismo día (RF-AGE-002).');
      }
      if (i > 0) {
        const diffMinutes = (sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60);
        if (diffMinutes !== 30) {
          throw new Error('Los bloques de horario de la cita deben ser contiguos de 30 minutos (RF-AGE-002).');
        }
      }
    }
  }

  /**
   * RF-AGE-002: Agendar cita internamente. Nace en estado Confirmada y guarda "Agendado por".
   */
  public static scheduleInternal(params: {
    idPaciente: number;
    idUsuarioProfesional: number;
    servicio: DentalServiceType;
    bloques: Date[];
    titulo?: string;
    descripcion?: string | null;
    agendadoPorId: number;
    agendadoPorNombre: string;
    now?: Date;
  }): AppointmentEntity {
    const defaultTitle = params.titulo?.trim() || `Consulta ${params.servicio}`;
    AppointmentEntity.validateTextFields(defaultTitle, params.descripcion);
    AppointmentEntity.validateContiguousBlocks(params.bloques);

    if (!params.idPaciente || !params.idUsuarioProfesional) {
      throw new Error('El paciente y el profesional responsable son obligatorios para agendar la cita (RF-AGE-002).');
    }

    const now = params.now ?? new Date();
    const initialHistory: AppointmentHistoryChange = {
      idUsuarioGestor: params.agendadoPorId,
      nombreUsuarioGestor: params.agendadoPorNombre,
      fechaHistorial: now,
      estadoNuevo: 'Confirmada',
      reporte: `Cita agendada en estado Confirmada por ${params.agendadoPorNombre}.`,
      motivo: null,
    };

    return new AppointmentEntity({
      titulo: defaultTitle,
      descripcion: params.descripcion ?? null,
      idPaciente: params.idPaciente,
      idUsuario: params.idUsuarioProfesional,
      servicio: params.servicio,
      estado: 'Confirmada',
      bloques: params.bloques,
      agendadoPorId: params.agendadoPorId,
      agendadoPorNombre: params.agendadoPorNombre,
      estadoRecordatorio: 'Pendiente',
      historialCambios: [initialHistory],
    });
  }

  public static reconstitute(props: AppointmentProps): AppointmentEntity {
    return new AppointmentEntity(props);
  }

  /**
   * RF-AGE-005: Confirmar una cita en estado Solicitada (en los mismos bloques u otros disponibles).
   */
  public confirmarSolicitud(params: {
    idUsuarioGestor: number;
    nombreUsuarioGestor: string;
    nuevosBloques?: Date[];
    now?: Date;
  }): void {
    if (this._estado !== 'Solicitada') {
      throw new Error(`Solo se puede gestionar una cita en estado Solicitada. Estado actual: ${this._estado} (RF-AGE-005).`);
    }

    if (params.nuevosBloques && params.nuevosBloques.length > 0) {
      AppointmentEntity.validateContiguousBlocks(params.nuevosBloques);
      this._bloques = [...params.nuevosBloques].sort((a, b) => a.getTime() - b.getTime());
    }

    const prevState = this._estado;
    this._estado = 'Confirmada';

    this.appendHistory({
      idUsuarioGestor: params.idUsuarioGestor,
      nombreUsuarioGestor: params.nombreUsuarioGestor,
      fechaHistorial: params.now ?? new Date(),
      estadoAnterior: prevState,
      estadoNuevo: 'Confirmada',
      reporte: `Solicitud confirmada por ${params.nombreUsuarioGestor}.`,
      motivo: null,
    });
  }

  /**
   * RF-AGE-005: Rechazar una cita en estado Solicitada con motivo obligatorio.
   */
  public rechazarSolicitud(params: {
    idUsuarioGestor: number;
    nombreUsuarioGestor: string;
    motivo: string;
    now?: Date;
  }): void {
    if (this._estado !== 'Solicitada') {
      throw new Error(`La solicitud ya cambió de estado (${this._estado}) y no puede ser rechazada (RF-AGE-005).`);
    }

    const cleanMotivo = (params.motivo ?? '').trim();
    if (!cleanMotivo) {
      throw new Error('El motivo de rechazo es obligatorio (RF-AGE-005).');
    }
    if (cleanMotivo.length > AppointmentEntity.MAX_MOTIVO_LENGTH) {
      throw new Error(`El motivo no puede superar los ${AppointmentEntity.MAX_MOTIVO_LENGTH} caracteres.`);
    }

    const prevState = this._estado;
    this._estado = 'Rechazada';

    this.appendHistory({
      idUsuarioGestor: params.idUsuarioGestor,
      nombreUsuarioGestor: params.nombreUsuarioGestor,
      fechaHistorial: params.now ?? new Date(),
      estadoAnterior: prevState,
      estadoNuevo: 'Rechazada',
      reporte: 'Solicitud de cita rechazada.',
      motivo: cleanMotivo,
    });
  }

  /**
   * RF-AGE-006: Editar datos de una cita en estado Confirmada sin cambiar su estado ni su "Agendado por".
   */
  public editarCitaConfirmada(params: {
    idUsuarioGestor: number;
    nombreUsuarioGestor: string;
    nuevosBloques?: Date[];
    nuevoIdProfesional?: number;
    nuevoServicio?: DentalServiceType;
    nuevoTitulo?: string;
    nuevaDescripcion?: string | null;
    now?: Date;
  }): { requiereReprogramarRecordatorio: boolean } {
    if (this._estado !== 'Confirmada') {
      throw new Error(
        `Solo se pueden editar citas en estado Confirmada. Estado actual: ${this._estado} (RF-AGE-006).`
      );
    }

    const nextTitle = params.nuevoTitulo !== undefined ? params.nuevoTitulo : this._titulo;
    const nextDesc = params.nuevaDescripcion !== undefined ? params.nuevaDescripcion : this._descripcion;
    AppointmentEntity.validateTextFields(nextTitle, nextDesc);

    const cambiosRealizados: string[] = [];
    let requiereReprogramarRecordatorio = false;

    if (params.nuevosBloques && params.nuevosBloques.length > 0) {
      AppointmentEntity.validateContiguousBlocks(params.nuevosBloques);
      const prevBlocksIso = this._bloques.map((b) => b.toISOString()).join(',');
      const nextBlocksIso = [...params.nuevosBloques]
        .sort((a, b) => a.getTime() - b.getTime())
        .map((b) => b.toISOString())
        .join(',');

      if (prevBlocksIso !== nextBlocksIso) {
        cambiosRealizados.push(`Horario anterior: [${prevBlocksIso}] -> Nuevo: [${nextBlocksIso}]`);
        this._bloques = [...params.nuevosBloques].sort((a, b) => a.getTime() - b.getTime());
        requiereReprogramarRecordatorio = true;
      }
    }

    if (params.nuevoIdProfesional !== undefined && params.nuevoIdProfesional !== this._idUsuario) {
      cambiosRealizados.push(`Profesional anterior: ${this._idUsuario} -> Nuevo: ${params.nuevoIdProfesional}`);
      this._idUsuario = params.nuevoIdProfesional;
      requiereReprogramarRecordatorio = true;
    }

    if (params.nuevoServicio !== undefined && params.nuevoServicio !== this._servicio) {
      cambiosRealizados.push(`Servicio anterior: ${this._servicio} -> Nuevo: ${params.nuevoServicio}`);
      this._servicio = params.nuevoServicio;
      requiereReprogramarRecordatorio = true;
    }

    if (nextTitle.trim() !== this._titulo) {
      cambiosRealizados.push(`Título anterior: "${this._titulo}" -> Nuevo: "${nextTitle.trim()}"`);
      this._titulo = nextTitle.trim();
    }

    if ((nextDesc ?? null) !== this._descripcion) {
      cambiosRealizados.push('Descripción actualizada');
      this._descripcion = nextDesc ? nextDesc.trim() : null;
    }

    if (requiereReprogramarRecordatorio) {
      this._estadoRecordatorio = 'Pendiente';
      this._causaFalloRecordatorio = null;
    }

    this.appendHistory({
      idUsuarioGestor: params.idUsuarioGestor,
      nombreUsuarioGestor: params.nombreUsuarioGestor,
      fechaHistorial: params.now ?? new Date(),
      estadoAnterior: 'Confirmada',
      estadoNuevo: 'Confirmada',
      reporte: cambiosRealizados.length > 0 ? cambiosRealizados.join(' | ') : 'Edición de cita Confirmada.',
      motivo: null,
    });

    return { requiereReprogramarRecordatorio };
  }

  /**
   * RF-AGE-007: Cancelar una cita en estado Confirmada con motivo obligatorio.
   */
  public cancelar(params: {
    idUsuarioGestor: number;
    nombreUsuarioGestor: string;
    motivo: string;
    now?: Date;
  }): void {
    if (this._estado !== 'Confirmada') {
      throw new Error(
        `Solo se puede cancelar manualmente una cita en estado Confirmada. Estado actual: ${this._estado} (RF-AGE-007).`
      );
    }

    const cleanMotivo = (params.motivo ?? '').trim();
    if (!cleanMotivo) {
      throw new Error('El motivo de cancelación es obligatorio (RF-AGE-007).');
    }
    if (cleanMotivo.length > AppointmentEntity.MAX_MOTIVO_LENGTH) {
      throw new Error(`El motivo de cancelación no puede superar los ${AppointmentEntity.MAX_MOTIVO_LENGTH} caracteres.`);
    }

    const prevState = this._estado;
    this._estado = 'Cancelada';

    this.appendHistory({
      idUsuarioGestor: params.idUsuarioGestor,
      nombreUsuarioGestor: params.nombreUsuarioGestor,
      fechaHistorial: params.now ?? new Date(),
      estadoAnterior: prevState,
      estadoNuevo: 'Cancelada',
      reporte: 'Cita cancelada por personal del consultorio.',
      motivo: cleanMotivo,
    });
  }

  /**
   * RF-AGE-009: Iniciar la atención de la cita (Confirmada -> En consulta).
   * Solo puede ejecutarlo el profesional responsable en el día de la cita.
   */
  public iniciarAtencion(params: {
    idProfesionalEjecutor: number;
    nombreProfesionalEjecutor: string;
    profesionalYaTieneCitaEnConsulta?: boolean;
    now?: Date;
  }): void {
    const now = params.now ?? new Date();

    if (this._idUsuario !== params.idProfesionalEjecutor) {
      throw new Error('No tiene permiso para realizar esta acción: solo el profesional responsable puede iniciar la atención (RF-AGE-009).');
    }

    if (this._estado !== 'Confirmada') {
      throw new Error(`Solo se puede iniciar la atención de una cita en estado Confirmada. Estado actual: ${this._estado} (RF-AGE-009).`);
    }

    if (params.profesionalYaTieneCitaEnConsulta) {
      throw new Error('Ya tiene una cita En consulta en curso. Debe finalizarla antes de iniciar otra atención (RF-AGE-009).');
    }

    const citaDay = AppointmentEntity.toColombiaDateString(this.horaInicio);
    const todayDay = AppointmentEntity.toColombiaDateString(now);
    if (citaDay !== todayDay) {
      throw new Error('Solo se puede iniciar la atención de citas correspondientes al día de hoy (RF-AGE-009).');
    }

    this._estado = 'En consulta';

    this.appendHistory({
      idUsuarioGestor: params.idProfesionalEjecutor,
      nombreUsuarioGestor: params.nombreProfesionalEjecutor,
      fechaHistorial: now,
      estadoAnterior: 'Confirmada',
      estadoNuevo: 'En consulta',
      reporte: 'Atención odontológica iniciada. Cita En consulta.',
      motivo: null,
    });
  }

  /**
   * RF-AGE-009: Finalizar la atención de la cita (En consulta -> Atendida).
   * Exige haber guardado el motivo de consulta en la historia clínica (RF-HCL-005).
   */
  public finalizarAtencion(params: {
    idProfesionalEjecutor: number;
    nombreProfesionalEjecutor: string;
    tieneMotivoConsultaRegistrado: boolean;
    now?: Date;
  }): void {
    const now = params.now ?? new Date();

    if (this._idUsuario !== params.idProfesionalEjecutor) {
      throw new Error('No tiene permiso para realizar esta acción: solo el profesional responsable puede finalizar la atención (RF-AGE-009).');
    }

    if (this._estado !== 'En consulta') {
      throw new Error(`Solo se puede finalizar una cita que esté En consulta. Estado actual: ${this._estado} (RF-AGE-009).`);
    }

    if (!params.tieneMotivoConsultaRegistrado) {
      throw new Error('Falta registrar el motivo de consulta');
    }

    this._estado = 'Atendida';

    this.appendHistory({
      idUsuarioGestor: params.idProfesionalEjecutor,
      nombreUsuarioGestor: params.nombreProfesionalEjecutor,
      fechaHistorial: now,
      estadoAnterior: 'En consulta',
      estadoNuevo: 'Atendida',
      reporte: 'Atención odontológica finalizada por el profesional responsable.',
      motivo: null,
    });
  }

  /**
   * RF-AGE-013: Marcar inasistencia de una cita Confirmada desde su hora de inicio hasta las 23:59 del mismo día.
   */
  public marcarInasistencia(params: {
    idUsuarioGestor: number;
    nombreUsuarioGestor: string;
    observacion?: string | null;
    now?: Date;
  }): void {
    const now = params.now ?? new Date();

    if (this._estado !== 'Confirmada') {
      throw new Error(`La cita ya cambió de estado (Estado actual: ${this._estado}) y no se puede marcar como Inasistencia (RF-AGE-013).`);
    }

    const citaDay = AppointmentEntity.toColombiaDateString(this.horaInicio);
    const todayDay = AppointmentEntity.toColombiaDateString(now);

    if (citaDay !== todayDay || now.getTime() < this.horaInicio.getTime()) {
      throw new Error(
        'Solo se puede marcar la inasistencia desde la hora de inicio de la cita hasta las 23:59 de ese mismo día (RF-AGE-013).'
      );
    }

    const cleanObs = params.observacion ? params.observacion.trim() : null;
    if (cleanObs && cleanObs.length > AppointmentEntity.MAX_MOTIVO_LENGTH) {
      throw new Error(`La observación de inasistencia no puede superar los ${AppointmentEntity.MAX_MOTIVO_LENGTH} caracteres (RF-AGE-013).`);
    }

    this._estado = 'Inasistencia';

    this.appendHistory({
      idUsuarioGestor: params.idUsuarioGestor,
      nombreUsuarioGestor: params.nombreUsuarioGestor,
      fechaHistorial: now,
      estadoAnterior: 'Confirmada',
      estadoNuevo: 'Inasistencia',
      reporte: 'Inasistencia marcada por el personal del consultorio.',
      motivo: cleanObs,
    });
  }

  /**
   * RF-AGE-010: Cambios automáticos ejecutados por el rol "Sistema" a las 00:00 y 23:59.
   */
  public ejecutarTransicionAutomaticaSistema(now: Date = new Date()): {
    nuevoEstado: AppointmentState;
    motivo: string;
    liberaBloques: boolean;
  } {
    const prevState = this._estado;

    if (prevState === 'Solicitada') {
      const motivo = 'No se realizó gestión de esta cita';
      this._estado = 'Cancelada';
      this.appendHistory({
        idUsuarioGestor: null,
        nombreUsuarioGestor: 'Sistema',
        fechaHistorial: now,
        estadoAnterior: prevState,
        estadoNuevo: 'Cancelada',
        reporte: 'Cancelación automática a las 00:00 del día solicitado (RF-AGE-010).',
        motivo,
      });
      return { nuevoEstado: 'Cancelada', motivo, liberaBloques: true };
    }

    if (prevState === 'Confirmada') {
      const motivo = 'No se registró el inicio de la atención';
      this._estado = 'Inasistencia';
      this.appendHistory({
        idUsuarioGestor: null,
        nombreUsuarioGestor: 'Sistema',
        fechaHistorial: now,
        estadoAnterior: prevState,
        estadoNuevo: 'Inasistencia',
        reporte: 'Inasistencia automática a las 23:59 del día de la cita (RF-AGE-010).',
        motivo,
      });
      return { nuevoEstado: 'Inasistencia', motivo, liberaBloques: false };
    }

    if (prevState === 'En consulta') {
      const motivo = 'Cierre automático de la atención al terminar el día';
      this._estado = 'Atendida';
      this.appendHistory({
        idUsuarioGestor: null,
        nombreUsuarioGestor: 'Sistema',
        fechaHistorial: now,
        estadoAnterior: prevState,
        estadoNuevo: 'Atendida',
        reporte: 'Cierre automático a las 23:59 del día de la cita (RF-AGE-010).',
        motivo,
      });
      return { nuevoEstado: 'Atendida', motivo, liberaBloques: false };
    }

    throw new Error(`El estado ${prevState} no aplica para transición automática del sistema (RF-AGE-010).`);
  }

  public registrarResultadoRecordatorio(enviado: boolean, causaFallo?: string): void {
    this._estadoRecordatorio = enviado ? 'Enviado' : 'No enviado';
    this._causaFalloRecordatorio = enviado ? null : causaFallo ?? 'Falla del servicio de correo';
  }

  public isActiveForProfessionalCheck(): boolean {
    return (
      this._estado === 'Solicitada' ||
      this._estado === 'Confirmada' ||
      this._estado === 'En consulta'
    );
  }

  public isEnConsulta(): boolean {
    return this._estado === 'En consulta';
  }

  private appendHistory(entry: AppointmentHistoryChange): void {
    this._historialCambios.push(entry);
  }

  public static toColombiaDateString(date: Date): string {
    const colTime = new Date(date.getTime() - 5 * 60 * 60 * 1000);
    const y = colTime.getUTCFullYear();
    const m = String(colTime.getUTCMonth() + 1).padStart(2, '0');
    const d = String(colTime.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}