// src/modules/appointments/ui/components/WeeklyCalendarGrid.tsx
import React from 'react';
import {
  CalendarIcon,
  ClockIcon,
  ToothIcon,
  LockIcon,
  UnlockIcon,
} from '../../../../shared/ui/components/Icons';

export interface CalendarTimeSlot {
  idBloque: number;
  horaInicio: string; // "08:30"
  horaFin: string; // "09:30"
  inicioTimestamp?: string;
  habilitado: boolean;
  idCita?: number | null;
  idSolicitud?: number | null;
  pacienteNombre?: string | null;
  pacienteDocumento?: string | null;
  pacienteTelefono?: string | null;
  pacienteCorreo?: string | null;
  tratamiento?: string | null;
  doctorNombre?: string | null;
  estadoCita?:
    | 'Confirmada'
    | 'En consulta'
    | 'En espera'
    | 'Completada'
    | 'Cancelada'
    | 'No asistió'
    | 'Pendiente de confirmación'
    | 'Solicitada'
    | null;
}

export interface WeeklyCalendarGridProps {
  slots: CalendarTimeSlot[];
  filterMode: 'all' | 'appointments_only' | 'requests_only';
  isPastDate?: boolean;
  onSelectSlot?: (slot: CalendarTimeSlot) => void;
  onSelectPendingRequest?: (slot: CalendarTimeSlot) => void;
  onToggleSlotStatus?: (slot: CalendarTimeSlot) => void;
  onScheduleSlot?: (slot: CalendarTimeSlot) => void;
  onCreateBlocks?: () => void;
}

export const WeeklyCalendarGrid: React.FC<WeeklyCalendarGridProps> = ({
  slots,
  filterMode,
  isPastDate = false,
  onSelectSlot,
  onSelectPendingRequest,
  onToggleSlotStatus,
  onScheduleSlot,
  onCreateBlocks,
}) => {
  const filteredSlots = slots.filter((slot) => {
    const isPending =
      slot.estadoCita === 'Pendiente de confirmación' ||
      slot.estadoCita === 'Solicitada' ||
      Boolean(slot.idSolicitud);

    if (filterMode === 'appointments_only') {
      return Boolean(slot.idCita && !isPending);
    }
    if (filterMode === 'requests_only') {
      return isPending;
    }
    return true; // 'all'
  });

  const renderStatusBadge = (estado: CalendarTimeSlot['estadoCita']) => {
    switch (estado) {
      case 'Completada':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Completada
          </span>
        );
      case 'En consulta':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#111827] text-white border border-[#111827]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]"></span>
            En consulta
          </span>
        );
      case 'En espera':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]">
            <span>⏳</span>
            En espera
          </span>
        );
      case 'Confirmada':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#F9FAFB] text-[#374151] border border-[#E5E7EB]">
            <svg className="w-3.5 h-3.5 text-[#059669]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Confirmada
          </span>
        );
      case 'Pendiente de confirmación':
      case 'Solicitada':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
            <ClockIcon size={12} className="text-[#2563EB]" />
            Pendiente de confirmación
          </span>
        );
      case 'No asistió':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5]">
            No asistió
          </span>
        );
      case 'Cancelada':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#F3F4F6] text-[#687380] border border-[#E5E7EB]">
            Cancelada
          </span>
        );
      default:
        return null;
    }
  };

  if (slots.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[#E2E6EA] bg-white p-12 text-center space-y-4 shadow-2xs">
        <div className="h-14 w-14 mx-auto rounded-2xl bg-[#FFFBEB] text-[#D4AF37] flex items-center justify-center border border-[#FDE68A]">
          <CalendarIcon size={24} color="#D4AF37" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-[#1E242B]">
            No hay bloques de horario generados para este día
          </h3>
          <p className="mt-1 text-xs text-[#687380] max-w-md mx-auto leading-relaxed">
            Para habilitar la programación de citas, genera los bloques de 30 minutos (06:00 a 20:00) establecidos en las especificaciones del sistema.
          </p>
        </div>
        {onCreateBlocks && !isPastDate ? (
          <button
            type="button"
            onClick={onCreateBlocks}
            className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C29E2F] text-black text-xs font-extrabold inline-flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <span>➕</span> Crear bloques (06:00 - 20:00)
          </button>
        ) : isPastDate ? (
          <span className="inline-block px-4 py-2 rounded-xl bg-gray-100 text-gray-400 text-xs font-bold border border-gray-200">
            ⊘ No es posible generar bloques para fechas pasadas
          </span>
        ) : null}
      </div>
    );
  }

  if (filteredSlots.length === 0) {
    return (
      <div className="rounded-3xl border border-[#E2E6EA] bg-white p-12 text-center text-xs text-[#8F99A3]">
        No hay citas ni solicitudes que coincidan con el filtro seleccionado.
      </div>
    );
  }

  return (
    <div className="max-h-[calc(100vh-270px)] min-h-[520px] overflow-y-auto pr-2 space-y-3.5">
      {filteredSlots.map((slot) => {
        const isPending =
          slot.estadoCita === 'Pendiente de confirmación' ||
          slot.estadoCita === 'Solicitada';
        const hasAppointment = Boolean(slot.idCita) || Boolean(slot.pacienteNombre);

        // CASO 1: BLOQUE CON CITA O SOLICITUD ASIGNADA (Imagen 3)
        if (hasAppointment || isPending) {
          return (
            <div key={slot.idBloque} className="flex items-center gap-4">
              {/* Horario a la izquierda */}
              <div className="w-16 shrink-0 text-center font-extrabold text-[#1E242B] text-sm select-none">
                <div className="leading-tight">{slot.horaInicio}</div>
                <div className="text-xs text-[#8F99A3] font-semibold mt-0.5">{slot.horaFin}</div>
              </div>

              {/* Tarjeta de Cita con Borde Izquierdo Dorado */}
              <div
                onClick={() => {
                  if (isPending) {
                    onSelectPendingRequest?.(slot);
                  } else {
                    onSelectSlot?.(slot);
                  }
                }}
                className="flex-1 rounded-2xl border border-[#E2E6EA] border-l-5 border-l-[#D4AF37] bg-white p-4 shadow-xs hover:border-[#D4AF37] hover:shadow-sm transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h4 className="text-sm font-extrabold text-[#1E242B] group-hover:text-[#D4AF37] transition-colors">
                      {slot.pacienteNombre}
                    </h4>
                    {renderStatusBadge(slot.estadoCita)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#687380] font-medium">
                    <ToothIcon size={14} color="#D4AF37" />
                    <span>{slot.tratamiento || 'Consulta Odontológica'}</span>
                    {slot.doctorNombre && (
                      <>
                        <span>•</span>
                        <span>{slot.doctorNombre}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="self-end sm:self-center flex items-center gap-2">
                  <span className="text-xs font-bold text-[#D4AF37] group-hover:underline inline-flex items-center gap-1">
                    {isPending ? 'Ver Solicitud →' : 'Ver Detalle →'}
                  </span>
                </div>
              </div>
            </div>
          );
        }

        // CASO 2: BLOQUE SIN CITA ASIGNADA O BLOQUE NO HABILITADO (Imagen 3)
        const isEnabled = slot.habilitado;

        return (
          <div key={slot.idBloque} className="flex items-center gap-4">
            {/* Horario a la izquierda */}
            <div className="w-16 shrink-0 text-center font-extrabold text-[#8F99A3] text-sm select-none">
              <div className="leading-tight">{slot.horaInicio}</div>
              <div className="text-xs text-[#CBD2D9] font-medium mt-0.5">{slot.horaFin}</div>
            </div>

            {/* Tarjeta: Sin cita asignada vs Bloque no habilitado */}
            <div
              className={`flex-1 rounded-2xl border p-3.5 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                isEnabled
                  ? 'border-[#E2E6EA] bg-white shadow-2xs'
                  : 'border-[#E2E6EA] bg-[#F1F3F5] text-[#8F99A3]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {isEnabled ? (
                  <>
                    <CalendarIcon size={16} className="text-[#687380]" />
                    <span className="text-xs sm:text-sm font-medium text-[#687380]">
                      Sin cita asignada
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-base text-[#8F99A3]">⊘</span>
                    <span className="text-xs sm:text-sm font-medium text-[#8F99A3]">
                      Bloque no habilitado
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {isPastDate ? (
                  <span className="text-[11px] font-bold text-[#8F99A3] px-2 py-1 rounded-lg bg-gray-100">
                    Fecha pasada
                  </span>
                ) : isEnabled ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onToggleSlotStatus?.(slot)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-[#E2E6EA] bg-white text-[#B45309] hover:bg-[#FFFBEB] transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      <UnlockIcon size={14} className="text-[#B45309]" /> Deshabilitar bloque
                    </button>
                    {onScheduleSlot && (
                      <button
                        type="button"
                        onClick={() => onScheduleSlot(slot)}
                        className="text-xs font-bold px-3 py-1.5 rounded-xl border border-[#E2E6EA] bg-white text-[#1E242B] hover:bg-[#F3F4F6] transition-colors inline-flex items-center gap-1 shadow-2xs"
                      >
                        <span className="font-extrabold text-sm leading-none">+</span> Agendar
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onToggleSlotStatus?.(slot)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-[#E2E6EA] bg-white text-[#B45309] hover:bg-[#FFFBEB] transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <LockIcon size={14} className="text-[#B45309]" /> Habilitar bloque
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
