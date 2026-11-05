// src/modules/appointments/ui/components/detail/AppointmentCancelModal.tsx
import React, { useState } from 'react';
import { formatTimeRangeCO } from '../../../../../shared/ui/format';
import { FileTextIcon } from '../../../../../shared/ui/components/Icons';
import { AppointmentDetailPageData } from '../../views/AppointmentDetailPage';

export interface AppointmentCancelModalProps {
  isOpen: boolean;
  appointment: AppointmentDetailPageData;
  formatSpanishHeaderDate: (dateStr: string) => string;
  onClose: () => void;
  onConfirm: (reason: string, destinoBloques?: 'Disponibles' | 'Deshabilitados') => Promise<void> | void;
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
  const [destinoBloques, setDestinoBloques] = useState<'Disponibles' | 'Deshabilitados'>('Disponibles');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    const fullReason = [cancelReasonTag, cancelReasonText.trim()].filter(Boolean).join(': ');
    if (!fullReason.trim()) {
      return;
    }
    try {
      setIsSubmitting(true);
      await onConfirm(fullReason, destinoBloques);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = Boolean(cancelReasonTag || cancelReasonText.trim());

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-appointment-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl sm:rounded-3xl border border-[#E5E7EB] border-t-4 border-t-[#B91C1C] bg-white p-6 sm:p-7 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-[#FEE2E2] text-[#B91C1C] flex items-center justify-center shrink-0 border border-[#B91C1C]/25 text-lg font-bold">
              ✕
            </div>
            <div>
              <h3 id="cancel-appointment-title" className="text-base sm:text-lg font-bold leading-6 text-[#1F2937]">
                Cancelar Cita Médica
              </h3>
              <p className="text-xs text-[#4B5563]">
                Registro obligatorio del motivo de anulación y destino de bloques (RF-AGE-007)
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

        {/* Resumen de la cita a cancelar */}
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

        {/* Motivo de cancelación obligatorio */}
        <div className="space-y-2">
          <label className="text-xs font-extrabold uppercase text-[#1F2937] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileTextIcon size={14} color="#D4AF37" /> Motivo de Cancelación
            </span>
            <span className="text-[#B91C1C] font-bold">* Obligatorio</span>
          </label>

          <div className="flex flex-wrap gap-2">
            {['Inconveniente paciente', 'Reprogramación', 'Disponibilidad médica'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setCancelReasonTag(tag)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  cancelReasonTag === tag
                    ? 'border-[#D4AF37] bg-[#FEFCE8] text-[#111111] font-bold ring-1 ring-[#D4AF37]'
                    : 'border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F8FAFC]'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <textarea
            rows={3}
            placeholder="Describa detalladamente el motivo de la cancelación de la cita..."
            value={cancelReasonText}
            onChange={(e) => setCancelReasonText(e.target.value)}
            className="w-full rounded-xl border border-[#E5E7EB] p-3 text-xs sm:text-sm text-[#1F2937] placeholder-[#64748B] focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          />
        </div>

        {/* Selector de destino de los bloques no iniciados (RF-AGE-007) */}
        <div className="space-y-2 pt-1 border-t border-[#E5E7EB]">
          <label className="text-xs font-extrabold uppercase text-[#1F2937] block">
            Destino de los bloques de horario liberados:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label
              onClick={() => setDestinoBloques('Disponibles')}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                destinoBloques === 'Disponibles'
                  ? 'border-[#15803D] bg-[#DCFCE7]/40 text-[#15803D] font-bold'
                  : 'border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F8FAFC]'
              }`}
            >
              <input
                type="radio"
                name="destinoBloques"
                checked={destinoBloques === 'Disponibles'}
                onChange={() => setDestinoBloques('Disponibles')}
                className="text-[#15803D] focus:ring-[#15803D]"
              />
              <div className="text-xs">
                <p className="font-bold text-[#1F2937]">Disponibles (Recomendado)</p>
                <p className="text-[11px] text-[#64748B]">Quedan libres para otros pacientes</p>
              </div>
            </label>

            <label
              onClick={() => setDestinoBloques('Deshabilitados')}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                destinoBloques === 'Deshabilitados'
                  ? 'border-[#B91C1C] bg-[#FEE2E2]/40 text-[#B91C1C] font-bold'
                  : 'border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F8FAFC]'
              }`}
            >
              <input
                type="radio"
                name="destinoBloques"
                checked={destinoBloques === 'Deshabilitados'}
                onChange={() => setDestinoBloques('Deshabilitados')}
                className="text-[#B91C1C] focus:ring-[#B91C1C]"
              />
              <div className="text-xs">
                <p className="font-bold text-[#1F2937]">Deshabilitados</p>
                <p className="text-[11px] text-[#64748B]">Se bloquean en la agenda</p>
              </div>
            </label>
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
            disabled={isSubmitting || !isFormValid}
            onClick={handleConfirm}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#B91C1C] text-white text-xs sm:text-sm font-bold hover:bg-[#991B1B] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <span>✓</span> Confirmar cancelación
          </button>
        </div>
      </div>
    </div>
  );
};
