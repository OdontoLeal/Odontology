// src/modules/appointments/ui/components/detail/AppointmentNoShowModal.tsx
import React, { useState } from 'react';
import { AppointmentDetailPageData } from '../../views/AppointmentDetailPage';

export interface AppointmentNoShowModalProps {
  isOpen: boolean;
  appointment: AppointmentDetailPageData;
  formatSpanishHeaderDate: (dateStr: string) => string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

export const AppointmentNoShowModal: React.FC<AppointmentNoShowModalProps> = ({
  isOpen,
  appointment,
  formatSpanishHeaderDate,
  onClose,
  onConfirm,
}) => {
  const [reasonOption, setReasonOption] = useState('El paciente no llego ni informo');
  const [customText, setCustomText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    let fullReason = reasonOption;
    if (reasonOption === 'Otro') {
      fullReason = customText.trim() || 'El paciente no se presentó (Otro motivo)';
    } else if (customText.trim()) {
      fullReason = `${reasonOption}: ${customText.trim()}`;
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
      <div className="w-full max-w-lg rounded-3xl border border-[#E2E6EA] bg-white p-6 sm:p-8 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E6EA]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0 border border-red-100">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 8l4 4m0-4l-4 4" />
              </svg>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[#1E242B]">Confirmar Inasistencia</h3>
              <p className="text-xs text-[#8F99A3]">Registro de no presentación del paciente a consulta</p>
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
          <label className="text-xs font-bold text-[#4B5563]">
            Motivo de la inasistencia (opcional):
          </label>

          <div className="space-y-2">
            {[
              'El paciente no llego ni informo',
              'El paciente informo que no podia asistir',
              'Otro',
            ].map((opt) => (
              <label
                key={opt}
                onClick={() => setReasonOption(opt)}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  reasonOption === opt
                    ? 'border-[#D4AF37] bg-[#FFFBEB]/40 text-[#1E242B]'
                    : 'border-[#E2E6EA] bg-white text-[#4B5563] hover:bg-[#F9FAFB]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    reasonOption === opt ? 'border-[#D4AF37] bg-white' : 'border-[#D1D5DB]'
                  }`}
                >
                  {reasonOption === opt && <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />}
                </div>
                <span className="text-xs font-medium">{opt}</span>
              </label>
            ))}
          </div>

          <textarea
            rows={3}
            placeholder="Especificar motivo de la inasistencia..."
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            className="w-full rounded-2xl border border-[#E2E6EA] p-3 text-xs text-[#1E242B] focus:border-[#D4AF37] focus:outline-none mt-2"
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
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <span>✓</span> Confirmar Inasistencia
          </button>
        </div>
      </div>
    </div>
  );
};
