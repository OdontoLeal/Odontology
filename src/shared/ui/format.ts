// src/shared/ui/format.ts
// RQNF-USA-002 (español Colombia): toda fecha visible se muestra como DD/MM/AAAA y toda hora
// en 12 horas con "a. m." / "p. m.". Estas son las únicas funciones que deben usar las vistas.
import { formatColombiaTime } from '../domain/colombia-format';

const TZ = 'America/Bogota';
const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

type DateInput = string | Date | null | undefined;

/** Convierte la entrada en una fecha. Las fechas puras "AAAA-MM-DD" se toman como día civil. */
function toDate(value: DateInput): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();
  const dateOnly = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    // Mediodía UTC: el día civil no cambia al convertir a America/Bogota.
    return new Date(Date.UTC(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3], 12));
  }
  // "AAAA-MM-DD HH:mm(:ss)" sin zona: ya es hora local de Colombia.
  const localDateTime = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (localDateTime) {
    const [, y, m, d, hh, mm, ss] = localDateTime;
    return new Date(Date.UTC(+y, +m - 1, +d, +hh + 5, +mm, ss ? +ss : 0));
  }
  // "DD/MM/AAAA" ya formateado
  const co = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (co) return new Date(Date.UTC(+co[3], +co[2] - 1, +co[1], 12));
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function parts(date: Date) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  const weekdayIdx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return {
    day: get('day'),
    month: get('month'),
    year: get('year'),
    hour: parseInt(get('hour'), 10),
    minute: get('minute'),
    weekday: weekdayIdx,
  };
}

function to12h(hour: number, minute: string): string {
  const period = hour >= 12 ? 'p. m.' : 'a. m.';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(h).padStart(2, '0')}:${minute} ${period}`;
}

/** "01/11/2026". Si la entrada no es una fecha válida, la devuelve tal cual. */
export function formatDateCO(value: DateInput, fallback = ''): string {
  const d = toDate(value);
  if (!d) return value ? String(value) : fallback;
  const { day, month, year } = parts(d);
  return `${day}/${month}/${year}`;
}

/** "Lunes, 09/11/2026". */
export function formatLongDateCO(value: DateInput, fallback = ''): string {
  const d = toDate(value);
  if (!d) return value ? String(value) : fallback;
  const { day, month, year, weekday } = parts(d);
  return `${DAYS[weekday]}, ${day}/${month}/${year}`;
}

/**
 * Hora en 12 horas: "10:20 p. m.". Acepta "HH:mm", "HH:mm:ss", rangos ("09:30 - 10:30")
 * y fechas completas (toma la hora en Colombia). Quita sufijos "hrs"/"h".
 */
export function formatTimeCO(value: DateInput, fallback = ''): string {
  if (!value) return fallback;
  if (value instanceof Date || /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(String(value))) {
    const d = toDate(value);
    if (!d) return String(value);
    const { hour, minute } = parts(d);
    return to12h(hour, minute);
  }
  const clean = String(value).replace(/\s*(hrs?|horas)\.?\s*$/i, '').trim();
  return formatColombiaTime(clean);
}

/** Rango "09:30 a. m. - 10:30 a. m.". */
export function formatTimeRangeCO(start?: string | null, end?: string | null): string {
  const s = formatTimeCO(start);
  const e = formatTimeCO(end);
  return s && e ? `${s} - ${e}` : s || e;
}

/** "01/11/2026 10:20 p. m.". */
export function formatDateTimeCO(value: DateInput, fallback = ''): string {
  const d = toDate(value);
  if (!d) return value ? String(value) : fallback;
  const { day, month, year, hour, minute } = parts(d);
  return `${day}/${month}/${year} ${to12h(hour, minute)}`;
}
