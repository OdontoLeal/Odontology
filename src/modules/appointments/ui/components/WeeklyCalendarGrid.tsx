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
    'Confirmada' | 'En consulta' | 'Atendida' | 'Cancelada' | 'Inasistencia' | 'Solicitada' | null;
}

export interface WeeklyCalendarGridProps {
  slots: CalendarTimeSlot[];
  filterMode: 'all' | 'appointments_only' | 'requests_only';
  isPastDate?: boolean;
  isLoading?: boolean;
  canManageSlots?: boolean;
  canCreateAppointment?: boolean;
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
  isLoading = false,
  canManageSlots = true,
  canCreateAppointment = true,
  onSelectSlot,
  onSelectPendingRequest,
  onToggleSlotStatus,
  onScheduleSlot,
  onCreateBlocks,
}) => {
  const filteredSlots = slots.filter((slot) => {
    const isPending = slot.estadoCita === 'Solicitada' || Boolean(slot.idSolicitud);

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
      case 'Atendida':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {estado}
          </span>
        );
      case 'En consulta':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#111827] text-white border border-[#111827]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]"></span>
            En consulta
          </span>
        );
      case 'Confirmada':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#F9FAFB] text-[#374151] border border-[#E5E7EB]">
            <svg
              className="w-3.5 h-3.5 text-[#059669]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Confirmada
          </span>
        );
      case 'Solicitada':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
            <ClockIcon size={12} className="text-[#2563EB]" />
            Solicitada
          </span>
        );
      case 'Inasistencia':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5]">
            Inasistencia
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

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-12 text-center space-y-5">
        <div className="h-14 w-14 mx-auto rounded-2xl bg-[#FFFBEB] text-[#D4AF37] flex items-center justify-center border border-[#FDE68A]">
          <div className="w-6 h-6 border-3 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-[#1E242B]">
            Cargando bloques de horario...
          </h3>
          <p className="mt-1 text-xs text-[#687380] max-w-md mx-auto">
            Consultando la disponibilidad y citas agendadas para este día en la base de datos...
          </p>
        </div>
        <div className="space-y-2.5 max-w-2xl mx-auto pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-16 rounded-2xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 border border-gray-200/60 animate-pulse flex items-center px-6 justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-16 h-4 bg-gray-200 rounded-md" />
                <div className="w-32 h-4 bg-gray-200 rounded-md" />
              </div>
              <div className="w-20 h-6 bg-gray-200 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-12 text-center space-y-4">
        <div className="h-14 w-14 mx-auto rounded-2xl bg-[#FFFBEB] text-[#D4AF37] flex items-center justify-center border border-[#FDE68A]">
          <CalendarIcon size={24} color="#D4AF37" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-[#1E242B]">
            No hay bloques de horario generados para este día
          </h3>
          <p className="mt-1 text-xs text-[#687380] max-w-md mx-auto leading-relaxed">
            Para habilitar la programación de citas, genera los bloques de 30 minutos (06:00 a
            20:00) establecidos en las especificaciones del sistema.
          </p>
        </div>
        {onCreateBlocks && !isPastDate && canManageSlots ? (
          <button
            type="button"
            onClick={onCreateBlocks}
            className="h-10 px-5 rounded-lg bg-[#111111] hover:bg-[#1E242B] text-white text-[13px] font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span className="text-[#D4AF37]">+</span> Crear bloques (06:00 - 20:00)
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
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-12 text-center text-xs text-[#64748B]">
        No hay citas ni solicitudes que coincidan con el filtro seleccionado.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredSlots.map((slot) => {
        const isPending = slot.estadoCita === 'Solicitada';
        const hasAppointment = Boolean(slot.idCita) || Boolean(slot.pacienteNombre);

        // CASO 1: BLOQUE CON CITA O SOLICITUD ASIGNADA (Imagen 3)
        if (hasAppointment || isPending) {
          return (
            <div key={slot.idBloque} className="flex min-w-0 items-center gap-2 sm:gap-4">
              {/* Horario a la izquierda */}
              <div className="w-12 shrink-0 text-center sm:w-16 font-extrabold text-[#1E242B] text-sm select-none">
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
                className="min-w-0 flex-1 rounded-2xl border border-[#E2E6EA] border-l-5 border-l-[#D4AF37] bg-white p-4 shadow-xs hover:border-[#D4AF37] hover:shadow-sm transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
                    <h4 className="text-break text-sm font-extrabold text-[#1E242B] group-hover:text-[#B8942A] transition-colors">
                      {slot.pacienteNombre}
                    </h4>
                    {renderStatusBadge(slot.estadoCita)}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#687380] font-medium">
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
          <div key={slot.idBloque} className="flex min-w-0 items-center gap-2 sm:gap-4">
            {/* Horario a la izquierda */}
            <div className="w-12 shrink-0 text-center sm:w-16 font-extrabold text-[#8F99A3] text-sm select-none">
              <div className="leading-tight">{slot.horaInicio}</div>
              <div className="text-xs text-[#CBD2D9] font-medium mt-0.5">{slot.horaFin}</div>
            </div>

            {/* Tarjeta: Sin cita asignada vs Bloque no habilitado */}
            <div
              className={`min-w-0 flex-1 rounded-2xl border p-3.5 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
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

              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end [&>button]:flex-1 sm:[&>button]:flex-none">
                {isPastDate ? (
                  <span className="text-[13px] font-bold text-[#8F99A3] px-2 py-1 rounded-lg bg-gray-100">
                    Fecha pasada
                  </span>
                ) : isEnabled ? (
                  <>
                    {canManageSlots && onToggleSlotStatus && (
                      <button
                        type="button"
                        onClick={() => onToggleSlotStatus(slot)}
                        className="text-xs font-semibold min-h-[44px] justify-center px-3 py-1.5 rounded-xl border border-[#E2E6EA] bg-white text-[#B45309] hover:bg-[#FFFBEB] transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <UnlockIcon size={14} className="text-[#B45309]" /> Deshabilitar bloque
                      </button>
                    )}
                    {canCreateAppointment && onScheduleSlot && (
                      <button
                        type="button"
                        onClick={() => onScheduleSlot(slot)}
                        className="text-xs font-bold min-h-[44px] justify-center px-3 py-1.5 rounded-xl border border-[#E2E6EA] bg-white text-[#1E242B] hover:bg-[#F3F4F6] transition-colors inline-flex items-center gap-1 shadow-2xs"
                      >
                        <span className="font-extrabold text-sm leading-none">+</span> Agendar
                      </button>
                    )}
                  </>
                ) : (
                  canManageSlots &&
                  onToggleSlotStatus && (
                    <button
                      type="button"
                      onClick={() => onToggleSlotStatus(slot)}
                      className="text-xs font-semibold min-h-[44px] justify-center px-3 py-1.5 rounded-xl border border-[#E2E6EA] bg-white text-[#B45309] hover:bg-[#FFFBEB] transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      <LockIcon size={14} className="text-[#B45309]" /> Habilitar bloque
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
