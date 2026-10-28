// src/shared/domain/colombia-time.util.ts
/**
 * Utilidades para manejo estricto de zona horaria de Colombia (UTC-5),
 * formato oficial DD/MM/AAAA y formato de 12 horas (a. m. / p. m.)
 * según RQNF-USA-002, RQNF-FUN-001 y RF-AGE-010.
 */
export class ColombiaTime {
  public static readonly TIMEZONE_OFFSET_HOURS = -5;
  public static readonly TIMEZONE_OFFSET_MS = ColombiaTime.TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;

  /**
   * Obtiene una nueva instancia de fecha en hora actual.
   */
  public static now(): Date {
    return new Date();
  }

  /**
   * Convierte una fecha a la fecha correspondiente en la zona horaria UTC-5.
   */
  public static toColombiaDate(date: Date): Date {
    return new Date(date.getTime() + ColombiaTime.TIMEZONE_OFFSET_MS);
  }

  /**
   * Retorna la clave de fecha en formato ISO local "YYYY-MM-DD" en hora de Colombia.
   */
  public static toDateKey(date: Date): string {
    const colDate = ColombiaTime.toColombiaDate(date);
    const y = colDate.getUTCFullYear();
    const m = String(colDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(colDate.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Formatea una fecha en formato colombiano DD/MM/AAAA (RQNF-USA-002).
   */
  public static formatDate(date: Date): string {
    const colDate = ColombiaTime.toColombiaDate(date);
    const d = String(colDate.getUTCDate()).padStart(2, '0');
    const m = String(colDate.getUTCMonth() + 1).padStart(2, '0');
    const y = colDate.getUTCFullYear();
    return `${d}/${m}/${y}`;
  }

  /**
   * Formatea una hora en formato de 12 horas con indicador "a. m." / "p. m." (RQNF-USA-002).
   * Ejemplos: "09:00 a. m.", "02:30 p. m.", "12:00 m."
   */
  public static formatTime12h(date: Date): string {
    const colDate = ColombiaTime.toColombiaDate(date);
    const rawHours = colDate.getUTCHours();
    const minutes = String(colDate.getUTCMinutes()).padStart(2, '0');

    const period = rawHours >= 12 ? 'p. m.' : 'a. m.';
    const displayHours = rawHours % 12 === 0 ? 12 : rawHours % 12;
    const formattedHours = String(displayHours).padStart(2, '0');

    return `${formattedHours}:${minutes} ${period}`;
  }

  /**
   * Formatea fecha y hora completas: "DD/MM/AAAA hh:mm a. m."
   */
  public static formatDateTime(date: Date): string {
    return `${ColombiaTime.formatDate(date)} ${ColombiaTime.formatTime12h(date)}`;
  }

  /**
   * Verifica si dos fechas corresponden al mismo día calendario en Colombia.
   */
  public static isSameDay(d1: Date, d2: Date): boolean {
    return ColombiaTime.toDateKey(d1) === ColombiaTime.toDateKey(d2);
  }

  /**
   * Retorna el inicio del día (00:00:00.000) en hora de Colombia correspondiente a la fecha dada.
   */
  public static getStartOfDay(date: Date): Date {
    const colDate = ColombiaTime.toColombiaDate(date);
    const y = colDate.getUTCFullYear();
    const m = colDate.getUTCMonth();
    const d = colDate.getUTCDate();
    // UTC time corresponding to Colombia 00:00:00 (UTC 05:00:00)
    return new Date(Date.UTC(y, m, d, 5, 0, 0, 0));
  }

  /**
   * Retorna el final del día (23:59:59.999) en hora de Colombia correspondiente a la fecha dada.
   */
  public static getEndOfDay(date: Date): Date {
    const colDate = ColombiaTime.toColombiaDate(date);
    const y = colDate.getUTCFullYear();
    const m = colDate.getUTCMonth();
    const d = colDate.getUTCDate();
    // UTC time corresponding to Colombia 23:59:59.999 (UTC next day 04:59:59.999)
    return new Date(Date.UTC(y, m, d, 23 + 5, 59, 59, 999));
  }

  /**
   * Retorna el rango semanal (Lunes 00:00 a Domingo 23:59) en Colombia para la fecha indicada (RF-AGE-008).
   */
  public static getWeekRange(referenceDate: Date = new Date()): {
    startMonday: Date;
    endSunday: Date;
    weekDays: Date[];
  } {
    const colDate = ColombiaTime.toColombiaDate(referenceDate);
    // getUTCDay: 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    const dayOfWeek = colDate.getUTCDay();
    const distanceToMonday = (dayOfWeek + 6) % 7; // Lunes = 0, Martes = 1, ..., Domingo = 6

    const mondayUtc = new Date(Date.UTC(
      colDate.getUTCFullYear(),
      colDate.getUTCMonth(),
      colDate.getUTCDate() - distanceToMonday,
      5, 0, 0, 0
    ));

    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(mondayUtc.getTime() + i * 24 * 60 * 60 * 1000);
      weekDays.push(currentDay);
    }

    const endSunday = new Date(mondayUtc.getTime() + 6 * 24 * 60 * 60 * 1000 + (19 * 60 * 60 * 1000 - 1)); // 23:59:59

    return {
      startMonday: mondayUtc,
      endSunday,
      weekDays,
    };
  }

  /**
   * Parsea una fecha en texto y hora asegurando su correcta interpretación en Colombia.
   */
  public static parseColombiaSlot(dateStr: string, timeStr: string): Date {
    // dateStr: "YYYY-MM-DD", timeStr: "HH:mm" (24h)
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);

    // En Colombia (UTC-5), sumamos 5 horas para obtener el UTC Date
    return new Date(Date.UTC(year, month - 1, day, hours + 5, minutes, 0, 0));
  }
}
