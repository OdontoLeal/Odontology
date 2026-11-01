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

  const lastDate = new Date(last);
  const endDate = new Date(lastDate.getTime() + 30 * 60 * 1000);
  const endHHmm = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;

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
