// src/modules/appointments/domain/time-slot.entity.ts

export interface TimeSlotProps {
  inicio: Date;
  final: Date;
  estado: boolean; // true = Habilitado, false = Deshabilitado (dll.txt: bloques_horario.estado)
  ocupacion: boolean; // true = Ocupado/Reservado, false = Libre (dll.txt: bloques_horario.ocupacion)
  idProfesional?: number; // Separación de agenda por profesional (Regla de Negocio 3)
}

export class TimeSlotEntity {
  public static readonly DURATION_MINUTES = 30;
  public static readonly OPENING_HOUR = 6; // 6:00 a. m. (RF-AGE-001)
  public static readonly CLOSING_HOUR = 20; // 8:00 p. m. (RF-AGE-001)
  public static readonly MAX_REPEAT_MONTHS = 6; // Máximo 6 meses (RF-AGE-001)

  public readonly inicio: Date;
  public readonly final: Date;
  private _estado: boolean;
  private _ocupacion: boolean;
  public readonly idProfesional?: number;

  private constructor(props: TimeSlotProps) {
    this.inicio = new Date(props.inicio.getTime());
    this.final = new Date(props.final.getTime());
    this._estado = props.estado;
    this._ocupacion = props.ocupacion;
    this.idProfesional = props.idProfesional;
  }

  public get estado(): boolean {
    return this._estado;
  }

  public get ocupacion(): boolean {
    return this._ocupacion;
  }

  /**
   * Crea y valida un bloque de horario de 30 minutos entre las 6:00 a. m. y las 8:00 p. m. (RF-AGE-001).
   */
  public static create(props: {
    inicio: Date | string;
    final?: Date | string;
    estado?: boolean;
    ocupacion?: boolean;
    idProfesional?: number;
  }): TimeSlotEntity {
    const inicioDate = props.inicio instanceof Date ? new Date(props.inicio.getTime()) : new Date(props.inicio);
    if (Number.isNaN(inicioDate.getTime())) {
      throw new Error('La fecha y hora de inicio del bloque de horario no es válida (RF-AGE-001).');
    }

    const finalDate = props.final
      ? props.final instanceof Date
        ? new Date(props.final.getTime())
        : new Date(props.final)
      : new Date(inicioDate.getTime() + TimeSlotEntity.DURATION_MINUTES * 60 * 1000);

    if (Number.isNaN(finalDate.getTime()) || finalDate.getTime() <= inicioDate.getTime()) {
      throw new Error('La hora final del bloque debe ser mayor a la hora de inicio (chk_rango_horario).');
    }

    const diffMinutes = (finalDate.getTime() - inicioDate.getTime()) / (1000 * 60);
    if (diffMinutes !== TimeSlotEntity.DURATION_MINUTES) {
      throw new Error('Cada bloque de horario debe tener una duración exacta de 30 minutos (RF-AGE-001).');
    }

    TimeSlotEntity.assertValidScheduleTime(inicioDate, finalDate);

    return new TimeSlotEntity({
      inicio: inicioDate,
      final: finalDate,
      estado: props.estado ?? true,
      ocupacion: props.ocupacion ?? false,
      idProfesional: props.idProfesional,
    });
  }

  public static reconstitute(props: TimeSlotProps): TimeSlotEntity {
    return new TimeSlotEntity(props);
  }

  /**
   * Verifica que el bloque empiece en punto (:00) o a la media hora (:30)
   * y esté dentro de la jornada de 6:00 a. m. a 8:00 p. m. hora de Colombia (RF-AGE-001).
   */
  public static assertValidScheduleTime(inicio: Date, final: Date): void {
    const seconds = inicio.getUTCSeconds();
    const milliseconds = inicio.getUTCMilliseconds();
    const minutes = inicio.getUTCMinutes();

    if (seconds !== 0 || milliseconds !== 0 || (minutes !== 0 && minutes !== 30)) {
      throw new Error(
        'Los bloques de horario deben iniciar exactamente en punto (:00) o a la media hora (:30) (RF-AGE-001).'
      );
    }

    const startCol = TimeSlotEntity.getColombiaHoursAndMinutes(inicio);
    const endCol = TimeSlotEntity.getColombiaHoursAndMinutes(final);

    const startTotalMinutes = startCol.hours * 60 + startCol.minutes;
    const endTotalMinutes = endCol.hours * 60 + endCol.minutes;

    const minAllowedMinutes = TimeSlotEntity.OPENING_HOUR * 60; // 06:00 (360)
    const maxAllowedMinutes = TimeSlotEntity.CLOSING_HOUR * 60; // 20:00 (1200)

    if (startTotalMinutes < minAllowedMinutes || endTotalMinutes > maxAllowedMinutes) {
      throw new Error(
        'Los bloques de horario solo pueden configurarse entre las 6:00 a. m. y las 8:00 p. m. (RF-AGE-001).'
      );
    }
  }

  /**
   * Valida que la fecha final de repetición semanal no supere los 6 meses desde hoy (RF-AGE-001).
   */
  public static validateWeeklyRepetitionRange(
    fechaInicio: Date,
    fechaFinalRepeticion: Date,
    now: Date = new Date()
  ): void {
    if (fechaFinalRepeticion.getTime() < fechaInicio.getTime()) {
      throw new Error('La fecha final de repetición no puede ser anterior a la fecha del bloque (RF-AGE-001).');
    }

    const maxDate = new Date(now.getTime());
    maxDate.setMonth(maxDate.getMonth() + TimeSlotEntity.MAX_REPEAT_MONTHS);

    if (fechaFinalRepeticion.getTime() > maxDate.getTime()) {
      throw new Error(
        'La fecha final de repetición semanal está fuera de rango: máximo 6 meses desde hoy (RF-AGE-001).'
      );
    }
  }

  /**
   * Verifica que un conjunto de bloques sean contiguos, del mismo día y del mismo profesional
   * (RF-AGE-002, RF-AGE-003, RF-AGE-005, RF-AGE-006).
   */
  public static assertContiguousAndSameDay(slots: TimeSlotEntity[]): void {
    if (!Array.isArray(slots) || slots.length === 0) {
      throw new Error('Debe seleccionar al menos un bloque de horario.');
    }

    const sorted = [...slots].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
    const firstDayKey = TimeSlotEntity.getColombiaDateKey(sorted[0].inicio);
    const firstProf = sorted[0].idProfesional;

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      if (TimeSlotEntity.getColombiaDateKey(current.inicio) !== firstDayKey) {
        throw new Error('Todos los bloques seleccionados deben pertenecer al mismo día (RF-AGE-002).');
      }

      if (firstProf !== undefined && current.idProfesional !== undefined && current.idProfesional !== firstProf) {
        throw new Error('Todos los bloques seleccionados deben pertenecer al mismo profesional (Regla de Negocio 3).');
      }

      if (i > 0) {
        const previous = sorted[i - 1];
        if (current.inicio.getTime() !== previous.final.getTime()) {
          throw new Error('Los bloques de horario seleccionados deben ser estrictamente contiguos (RF-AGE-002).');
        }
      }
    }
  }

  public hasStarted(now: Date = new Date()): boolean {
    return this.inicio.getTime() <= now.getTime();
  }

  /**
   * Un bloque está disponible si está habilitado, no ha empezado y no está ocupado (RF-AGE-001).
   */
  public isAvailable(now: Date = new Date()): boolean {
    return this._estado && !this._ocupacion && !this.hasStarted(now);
  }

  /**
   * Habilita el bloque verificando que no haya empezado (RF-AGE-001).
   */
  public enable(now: Date = new Date()): void {
    if (this.hasStarted(now)) {
      throw new Error('No se puede habilitar ni modificar un bloque de horario que ya empezó (RF-AGE-001).');
    }
    this._estado = true;
  }

  /**
   * Deshabilita el bloque verificando que no haya empezado y no tenga una cita asignada (RF-AGE-001, Regla 1).
   */
  public disable(now: Date = new Date(), allowPastOnCancel: boolean = false): void {
    if (!allowPastOnCancel && this.hasStarted(now)) {
      throw new Error('No se puede deshabilitar un bloque de horario que ya empezó (RF-AGE-001).');
    }
    if (this._ocupacion) {
      throw new Error(
        'No se puede deshabilitar un bloque de horario que tiene una cita o solicitud activa (RF-AGE-001).'
      );
    }
    this._estado = false;
  }

  /**
   * Reserva el bloque para una solicitud o cita (Regla de Negocio 1).
   */
  public occupy(now: Date = new Date()): void {
    if (!this._estado) {
      throw new Error('No se puede ocupar un bloque de horario que se encuentra deshabilitado.');
    }
    if (this._ocupacion) {
      throw new Error('El bloque de horario seleccionado ya fue ocupado desde otra sesión.');
    }
    if (this.hasStarted(now)) {
      throw new Error('No se puede agendar ni solicitar en un bloque de horario que ya empezó.');
    }
    this._ocupacion = true;
  }

  /**
   * Libera el bloque tras rechazo, edición o cancelación de cita (RF-AGE-005, RF-AGE-006, RF-AGE-007).
   */
  public release(keepEnabled: boolean = true): void {
    this._ocupacion = false;
    this._estado = keepEnabled;
  }

  public getPublicStatusLabel(): 'Disponible' | 'Ocupado' | 'Deshabilitado' {
    if (!this._estado) return 'Deshabilitado';
    return this._ocupacion ? 'Ocupado' : 'Disponible';
  }

  private static getColombiaHoursAndMinutes(date: Date): { hours: number; minutes: number } {
    // Colombia es UTC-5 todo el año (RQNF-FUN-001)
    const colombiaDate = new Date(date.getTime() - 5 * 60 * 60 * 1000);
    return {
      hours: colombiaDate.getUTCHours(),
      minutes: colombiaDate.getUTCMinutes(),
    };
  }

  public static getColombiaDateKey(date: Date): string {
    const colombiaDate = new Date(date.getTime() - 5 * 60 * 60 * 1000);
    const year = colombiaDate.getUTCFullYear();
    const month = String(colombiaDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(colombiaDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  public toJSON() {
    return {
      inicio: this.inicio.toISOString(),
      final: this.final.toISOString(),
      estado: this._estado,
      ocupacion: this._ocupacion,
      idProfesional: this.idProfesional,
      etiquetaEstado: this.getPublicStatusLabel(),
    };
  }
}