// src/modules/appointments/infrastructure/helpers/appointment-query.helpers.ts

export interface FormattedTimeRange {
  fecha: string;
  hora: string;
  horaInicio: string;
  horaFin: string;
}

export function computeTimeRangeFromBlocks(blocks: string[]): FormattedTimeRange {
  if (!blocks || blocks.length === 0) {
    return {
      fecha: 'Fecha por confirmar',
      hora: 'Horario por confirmar',
      horaInicio: '00:00',
      horaFin: '00:00',
    };
  }

  const sorted = [...blocks].sort();
  const first = String(sorted[0]).replace('T', ' ');
  const last = String(sorted[sorted.length - 1]).replace('T', ' ');

  const fecha = first.split(' ')[0];
  const startHHmm = (first.split(' ')[1] || '').slice(0, 5);

  const endHHmm = blockEnd(last).split(' ')[1].slice(0, 5);

  return {
    fecha,
    hora: `${startHHmm} - ${endHHmm}`,
    horaInicio: startHHmm,
    horaFin: endHHmm,
  };
}

export function generateStandardDayIntervals(cleanFecha: string): { inicio: string; final: string }[] {
  const slots: { inicio: string; final: string }[] = [];
  for (let hour = 6; hour < 20; hour++) {
    for (const minute of [0, 30]) {
      const startH = hour.toString().padStart(2, '0');
      const startM = minute.toString().padStart(2, '0');

      const endHour = minute === 30 ? hour + 1 : hour;
      const endMinute = minute === 30 ? 0 : 30;
      const endH = endHour.toString().padStart(2, '0');
      const endM = endMinute.toString().padStart(2, '0');

      const inicio = `${cleanFecha} ${startH}:${startM}:00`;
      const final = `${cleanFecha} ${endH}:${endM}:00`;
      slots.push({ inicio, final });
    }
  }
  return slots;
}

/**
 * Fin de un bloque de 30 minutos a partir de su inicio "YYYY-MM-DD HH:MM:SS".
 * Se calcula sobre la cadena (sin zona horaria) para no depender del huso del servidor.
 */
export function blockEnd(inicio: string): string {
  const clean = String(inicio).trim().replace('T', ' ').slice(0, 19);
  const [date, time = '00:00:00'] = clean.split(' ');
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const end = new Date(Date.UTC(y, mo - 1, d, h, mi + 30, 0));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())} ${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}:00`;
}

/** Normaliza un bloque recibido del cliente a "YYYY-MM-DD HH:MM:SS". */
export function normalizeBlock(bloque: string): string {
  const clean = String(bloque).trim().replace('T', ' ').split('.')[0];
  return clean.length === 16 ? `${clean}:00` : clean.slice(0, 19);
}
