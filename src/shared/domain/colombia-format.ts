// src/shared/domain/colombia-format.ts
// Formato de fechas y horas para Colombia (RQNF-USA-002): DD/MM/AAAA y 12 horas (a. m. / p. m.).
// Lo usan los correos, los PDF y las tareas automáticas.

/**
 * RQNF-USA-002: Formato de fecha localizado para Colombia (DD/MM/AAAA)
 */
export function formatColombiaDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '';
  if (dateStr instanceof Date) {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(dateStr);
  }
  const str = String(dateStr).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}/${m}/${y}`;
  }
  return str;
}

function formatSingleTime12h(timeStr: string): string {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return timeStr;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const isPm = hours >= 12;
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hoursStr = String(hours).padStart(2, '0');
  const period = isPm ? 'p. m.' : 'a. m.';
  return `${hoursStr}:${minutes} ${period}`;
}

/**
 * RQNF-USA-002: Formato de hora localizado de 12 horas (hh:mm a. m./p. m.)
 */
export function formatColombiaTime(timeStr: string | undefined | null): string {
  if (!timeStr) return '';
  const str = String(timeStr).trim();
  if (str.includes(' - ')) {
    return str
      .split(' - ')
      .map((part) => formatSingleTime12h(part.trim()))
      .join(' - ');
  }
  if (str.includes('-')) {
    return str
      .split('-')
      .map((part) => formatSingleTime12h(part.trim()))
      .join(' - ');
  }
  if (str.includes(' a ')) {
    return str
      .split(' a ')
      .map((part) => formatSingleTime12h(part.trim()))
      .join(' a ');
  }
  return formatSingleTime12h(str);
}
