// src/modules/appointments/ui/components/detail/AppointmentNoShowModal.tsx
import React, { useState } from 'react';
import { formatTimeRangeCO } from '../../../../../shared/ui/format';
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
  const [reasonOption, setReasonOption] = useState('El paciente no asistió ni notificó previamente');
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
      await onConfirm(fullReason.slice(0, 500));
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="noshow-appointment-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl sm:rounded-3xl border border-[#E5E7EB] border-t-4 border-t-[#B91C1C] bg-white p-6 sm:p-7 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-[#FEE2E2] text-[#B91C1C] flex items-center justify-center shrink-0 border border-[#B91C1C]/25 text-lg font-bold">
              ⚠
            </div>
            <div>
              <h3 id="noshow-appointment-title" className="text-base sm:text-lg font-bold leading-6 text-[#1F2937]">
                Registrar Inasistencia
              </h3>
              <p className="text-xs text-[#4B5563]">
                Control de cumplimiento del paciente (RF-AGE-012 / RF-AGE-013)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#64748B] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors focus:outline-none"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Advertencia Crítica Obligatoria ERS v1.3 */}
        <div
          role="alert"
          className="rounded-xl border border-[#B91C1C]/30 bg-[#FEE2E2] p-3.5 flex items-center gap-3 text-[#B91C1C]"
        >
          <span className="text-xl font-bold">⚠</span>
          <div className="text-xs sm:text-[13px] leading-snug">
            <strong className="block font-bold">La inasistencia no se puede deshacer</strong>
            <span>La cita pasará permanentemente a estado No asistió y quedará registrada en el historial clínico.</span>
          </div>
        </div>

        {/* Resumen de cita */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[#64748B]">Paciente:</span>
            <span className="font-extrabold text-[#1F2937]">{appointment.nombrePaciente}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#64748B]">Cita:</span>
            <span className="font-bold text-[#1F2937]">{appointment.titulo}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#64748B]">Fecha y horario:</span>
            <span className="font-bold text-[#B59428]">
              {formatSpanishHeaderDate(appointment.fecha)} · {formatTimeRangeCO(appointment.horaInicio, appointment.horaFin)}
            </span>
          </div>
        </div>

        {/* Observaciones opcionales (máx. 500 caracteres) */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#1F2937] block">
            Observación de inasistencia (opcional, máx. 500 caracteres):
          </label>

          <div className="space-y-2">
            {[
              'El paciente no asistió ni notificó previamente',
              'El paciente informó motivo de fuerza mayor',
              'Otro',
            ].map((opt) => (
              <label
                key={opt}
                onClick={() => setReasonOption(opt)}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  reasonOption === opt
                    ? 'border-[#D4AF37] bg-[#FEFCE8] text-[#111111] font-bold'
                    : 'border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F8FAFC]'
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
            rows={2}
            maxLength={500}
            placeholder="Observaciones adicionales sobre la inasistencia..."
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            className="w-full rounded-xl border border-[#E5E7EB] p-3 text-xs sm:text-sm text-[#1F2937] placeholder-[#64748B] focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          />
          <div className="text-right text-[11px] text-[#64748B]">
            {customText.length} / 500 caracteres
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-[#E5E7EB]">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl border border-[#E5E7EB] text-xs sm:text-sm font-semibold text-[#1F2937] hover:bg-[#F3F4F6] cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#B91C1C] hover:bg-[#991B1B] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50 transition-all"
          >
            <span>✓</span> Confirmar Inasistencia
          </button>
        </div>
      </div>
    </div>
  );
};
