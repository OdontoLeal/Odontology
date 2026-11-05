// src/shared/ui/components/PublicNavbar.tsx
import React from 'react';

export interface PublicNavbarProps {
  /** Acción o botón opcional personalizado a la derecha */
  rightAction?: React.ReactNode;
  /** Función para navegar al acceso de personal (staff login) */
  onNavigateToStaffLogin?: () => void;
  /** Etiqueta personalizada para el botón de acceso de personal (por defecto: 'Acceso Personal') */
  staffLoginLabel?: string;
  /** Función para navegar al portal de agendamiento público de pacientes */
  onNavigateToBooking?: () => void;
  /** Etiqueta para el botón de agendamiento */
  bookingLabel?: string;
  /** Contenedor ancho máximo personalizado (por defecto: max-w-7xl) */
  maxWidthClass?: string;
}

export const PublicNavbar: React.FC<PublicNavbarProps> = ({
  rightAction,
  onNavigateToStaffLogin,
  staffLoginLabel = 'Acceso Personal',
  onNavigateToBooking,
  bookingLabel = 'Agendar cita como paciente',
  maxWidthClass = 'max-w-7xl',
}) => {
  return (
    <header className="w-full border-b border-[#E2E6EA] bg-white px-4 py-3 sm:px-6 sm:py-3.5 sticky top-0 z-20 shadow-2xs">
      <div className={`mx-auto flex ${maxWidthClass} items-center justify-between gap-4`}>
        {/* Identidad de Marca Unificada */}
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#111111] text-[#D4AF37] border border-[#D4AF37]/40 shadow-xs"
            aria-hidden="true"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.7}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 4c-2.2 0-4 1.8-4 4 0 2.6 1.5 5.2 2.4 7.7.6 1.7 1.3 4.3 2.6 4.3 1.1 0 1.6-1.8 2.3-3.5.4-.9.9-1.5 1.7-1.5s1.3.6 1.7 1.5c.7 1.7 1.2 3.5 2.3 3.5 1.3 0 2-2.6 2.6-4.3.9-2.5 2.4-5.1 2.4-7.7 0-2.2-1.8-4-4-4-1.5 0-2.9.8-3.8 1.5-.7.5-1.7.5-2.4 0C9.9 4.8 8.5 4 7 4z"
              />
            </svg>
          </div>
          <div className="min-w-0 leading-tight">
            <span className="block truncate text-base sm:text-lg font-extrabold tracking-tight text-[#1E242B]">
              OdontoLeal
            </span>
            <span className="block truncate text-xs sm:text-[13px] font-semibold text-[#64748B]">
              Consultorio Odontológico • Dr. Eduar Leal Álvarez
            </span>
          </div>
        </div>

        {/* Acción Superior Derecha */}
        <div className="flex shrink-0 items-center gap-2">
          {rightAction ? (
            rightAction
          ) : onNavigateToStaffLogin ? (
            <button
              type="button"
              onClick={onNavigateToStaffLogin}
              className="h-10 px-4 rounded-lg border border-[#E2E8F0] bg-white text-[#1E242B] hover:bg-[#F8FAFC] transition-colors text-sm font-semibold inline-flex items-center gap-2 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            >
              <svg className="h-4 w-4 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                />
              </svg>
              <span>{staffLoginLabel}</span>
            </button>
          ) : onNavigateToBooking ? (
            <button
              type="button"
              onClick={onNavigateToBooking}
              className="h-10 px-4 rounded-lg border border-[#E2E8F0] bg-white text-[#1E242B] hover:bg-[#F8FAFC] transition-colors text-sm font-semibold inline-flex items-center gap-2 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            >
              <svg className="h-4 w-4 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{bookingLabel}</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
};
