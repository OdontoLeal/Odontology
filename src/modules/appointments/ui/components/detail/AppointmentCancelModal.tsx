// src/modules/appointments/ui/components/detail/AppointmentCancelModal.tsx
import React, { useState } from 'react';
import { FileTextIcon } from '../../../../../shared/ui/components/Icons';
import { AppointmentDetailPageData } from '../../views/AppointmentDetailPage';

export interface AppointmentCancelModalProps {
  isOpen: boolean;
  appointment: AppointmentDetailPageData;
  formatSpanishHeaderDate: (dateStr: string) => string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

export const AppointmentCancelModal: React.FC<AppointmentCancelModalProps> = ({
  isOpen,
  appointment,
  formatSpanishHeaderDate,
  onClose,
  onConfirm,
}) => {
  const [cancelReasonTag, setCancelReasonTag] = useState('');
  const [cancelReasonText, setCancelReasonText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    const fullReason = [cancelReasonTag, cancelReasonText].filter(Boolean).join(': ');
    if (!fullReason.trim()) {
      return;
    }
    try {
      setIsSubmitting(true);
      await onConfirm(fullReason);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs animate-fadeIn">
      <div className="w-full max-w-lg rounded-3xl border border-[#E2E6EA] border-t-4 border-t-[#D4AF37] bg-white p-6 sm:p-8 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E6EA]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0 border border-red-100">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 14l4 4m0-4l-4 4" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#1E242B]">Cancelar Cita</h3>
              <p className="text-xs text-[#8F99A3]">Registro de anulación y liberación de horario en agenda</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8F99A3] hover:text-[#1E242B] cursor-pointer text-base p-1"
          >
            ✕
          </button>
        </div>

        <div className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-4 text-xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[#8F99A3]">Paciente:</span>
            <span className="font-extrabold text-[#1E242B]">{appointment.nombrePaciente}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8F99A3]">Cita:</span>
            <span className="font-bold text-[#1E242B]">{appointment.titulo}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8F99A3]">Fecha y hora:</span>
            <span className="font-bold text-[#B45309]">
              {formatSpanishHeaderDate(appointment.fecha)} • {appointment.horaInicio} - {appointment.horaFin} hrs
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-extrabold uppercase text-[#1E242B] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileTextIcon size={14} color="#D4AF37" /> MOTIVO DE CANCELACIÓN
            </span>
            <span className="text-[#DC2626] font-bold">* OBLIGATORIO</span>
          </label>

          <div className="flex flex-wrap gap-2">
            {['Inconveniente paciente', 'Reprogramación', 'Disponibilidad médica'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setCancelReasonTag(tag)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  cancelReasonTag === tag
                    ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#92400E]'
                    : 'border-[#E2E6EA] bg-white text-[#687380] hover:bg-[#F3F4F6]'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <textarea
            rows={3}
            placeholder="Describe detalladamente el motivo de la cancelación de la cita..."
            value={cancelReasonText}
            onChange={(e) => setCancelReasonText(e.target.value)}
            className="w-full rounded-2xl border border-[#E2E6EA] p-3 text-xs text-[#1E242B] focus:border-[#D4AF37] focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E6EA]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#E2E6EA] text-xs font-bold text-[#687380] hover:bg-[#F3F4F6] cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSubmitting || (!cancelReasonTag && !cancelReasonText.trim())}
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-[#DC2626] text-white text-xs font-extrabold hover:bg-[#B91C1C] flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <span>✓</span> Confirmar cancelación
          </button>
        </div>
      </div>
    </div>
  );
};
