// src/modules/appointments/ui/components/detail/AppointmentDetailHeader.tsx
import React from 'react';
import { ClockIcon } from '../../../../../shared/ui/components/Icons';
import { AppointmentDetailPageData } from '../../views/AppointmentDetailPage';

export interface AppointmentDetailHeaderProps {
  appointment: AppointmentDetailPageData;
  canStartAttention: boolean;
  formatSpanishHeaderDate: (dateStr: string) => string;
  getInitials: (name: string) => string;
  onStartAttention?: (idCita: number, idPaciente: number) => void;
  onOpenEditMode: () => void;
  onOpenNoShowModal: () => void;
  onOpenCancelModal: () => void;
}

export const AppointmentDetailHeader: React.FC<AppointmentDetailHeaderProps> = ({
  appointment,
  canStartAttention,
  formatSpanishHeaderDate,
  getInitials,
  onStartAttention,
  onOpenEditMode,
  onOpenNoShowModal,
  onOpenCancelModal,
}) => {
  return (
    <div className="rounded-3xl border border-[#E2E6EA] border-l-6 border-l-[#D4AF37] bg-white p-6 sm:p-8 shadow-xs space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] text-[#D4AF37] flex items-center justify-center shrink-0">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E242B]">
                {appointment.titulo || 'Valoración Odontológica'}
              </h1>

              {/* Badges de estado */}
              {appointment.estado === 'Confirmada' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirmada
                </span>
              )}
              {appointment.estado === 'En consulta' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#111827] text-white border border-[#111827]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]"></span>
                  En consulta
                </span>
              )}
              {(appointment.estado === 'Atendida') && (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                  <span>✓</span> {appointment.estado}
                </span>
              )}
              {appointment.estado === 'Inasistencia' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5]">
                  <span>✕</span> Inasistencia
                </span>
              )}
              {appointment.estado === 'Cancelada' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#F3F4F6] text-[#687380] border border-[#E5E7EB]">
                  <span>✕</span> Cancelada
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1.5 text-xs text-[#687380] font-medium">
              <ClockIcon size={14} color="#D4AF37" />
              <span>
                {formatSpanishHeaderDate(appointment.fecha)} • {appointment.horaInicio} - {appointment.horaFin} hrs ({appointment.sillon || 'Gabinete 02'})
              </span>
            </div>

            <p className="mt-3 text-xs sm:text-sm text-[#4B5563] leading-relaxed max-w-3xl">
              {appointment.descripcion || 'Valoración clínica y diagnóstico general odontológico.'}
            </p>

            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-[#111827] text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {getInitials(appointment.doctorNombre)}
                </div>
                <span className="text-xs text-[#687380]">
                  Doctor encargado: <strong className="text-[#1E242B]">{appointment.doctorNombre}</strong>
                </span>
              </div>
              <span className="text-xs text-[#687380]">
                Agendado por: <strong className="text-[#1E242B]">{appointment.agendadoPor || 'Portal Web'}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Acciones según estado */}
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5 lg:self-start shrink-0">
          {appointment.estado === 'Confirmada' && (
            <>
              {canStartAttention && (
                <button
                  type="button"
                  onClick={() => onStartAttention?.(appointment.idCita, appointment.idPaciente)}
                  className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#C29E2F] text-black text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <span>▶</span> Iniciar Cita
                </button>
              )}

              <button
                type="button"
                onClick={onOpenEditMode}
                className="px-3 py-2 rounded-xl border border-[#E2E6EA] bg-white text-[#1E242B] hover:bg-[#F3F4F6] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>✏</span> Editar Cita
              </button>

              <button
                type="button"
                onClick={onOpenNoShowModal}
                className="px-3 py-2 rounded-xl border border-[#E2E6EA] bg-white text-[#1E242B] hover:bg-[#F3F4F6] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-[#DC2626]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Marcar Inasistencia
              </button>

              <button
                type="button"
                onClick={onOpenCancelModal}
                className="px-3 py-2 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>✕</span> Cancelar Cita
              </button>
            </>
          )}

          {appointment.estado === 'En consulta' && canStartAttention && (
            <button
              type="button"
              onClick={() => onStartAttention?.(appointment.idCita, appointment.idPaciente)}
              className="px-4 py-2 rounded-xl bg-[#111827] hover:bg-black text-[#D4AF37] text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <span>⚡</span> Continuar en Espacio Clínico
            </button>
          )}

          {appointment.estado === 'Inasistencia' && (
            <div className="px-3 py-1.5 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[11px] font-bold text-[#DC2626] flex items-center gap-1.5">
              <span>⚠️</span> Inasistencia registrada (Bloques conservados)
            </div>
          )}

          {appointment.estado === 'Cancelada' && (
            <div className="px-3 py-1.5 rounded-xl bg-[#F3F4F6] border border-[#E5E7EB] text-[11px] font-bold text-[#687380] flex items-center gap-1.5">
              <span>🚫</span> Cita cancelada (Bloques liberados)
            </div>
          )}

          {(appointment.estado === 'Atendida') && (
            <div className="px-3 py-1.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[11px] font-bold text-[#059669] flex items-center gap-1.5">
              <span>✓</span> Atención finalizada ({appointment.estado})
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
