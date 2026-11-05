// src/modules/appointments/ui/components/detail/AppointmentAttachConsentModal.tsx
import React, { useState } from 'react';
import { FileTextIcon } from '../../../../../shared/ui/components/Icons';

export interface ConsentTemplateItem {
  id_consentimiento?: number;
  id_plantilla?: number;
  id?: number;
  titulo?: string;
  nombre?: string;
  descripcion?: string;
}

export interface AppointmentAttachConsentModalProps {
  isOpen: boolean;
  availableTemplates: ConsentTemplateItem[];
  onClose: () => void;
  onAttach: (selectedIds: number[]) => void;
}

export const AppointmentAttachConsentModal: React.FC<AppointmentAttachConsentModalProps> = ({
  isOpen,
  availableTemplates,
  onClose,
  onAttach,
}) => {
  const [selectedConsents, setSelectedConsents] = useState<number[]>([]);

  if (!isOpen) return null;

  const handleToggle = (id: number) => {
    setSelectedConsents((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    onAttach(selectedConsents);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs animate-fadeIn">
      <div className="w-full max-w-lg rounded-3xl border border-[#E2E6EA] bg-white p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E6EA]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#111111] flex items-center justify-center">
              <FileTextIcon size={18} color="#D4AF37" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#1E242B]">Adjuntar Consentimientos Informados</h3>
              <p className="text-xs text-[#8F99A3]">Selecciona plantillas registradas en base de datos para asociarlas a esta cita.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8F99A3] hover:text-[#1E242B] cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center justify-between text-xs font-bold text-[#687380]">
          <span>Plantillas disponibles en el sistema:</span>
          <span className="px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E]">
            {selectedConsents.length} seleccionados
          </span>
        </div>

        {availableTemplates.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#8F99A3]">
            No hay plantillas de consentimientos configuradas en el sistema.
          </p>
        ) : (
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {availableTemplates.map((t) => {
              const id = Number(t.id_consentimiento ?? t.id_plantilla ?? t.id ?? 0);
              const isSelected = selectedConsents.includes(id);
              return (
                <div
                  key={id}
                  onClick={() => handleToggle(id)}
                  className={`rounded-2xl border p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#D4AF37] bg-[#FFFBEB]/40'
                      : 'border-[#E2E6EA] bg-white hover:bg-[#F8F9FA]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="mt-1 h-4 w-4 rounded accent-[#D4AF37]"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-[#1E242B]">{t.titulo || t.nombre}</h4>
                        <span className="text-[13px] text-[#8F99A3]">Activo</span>
                      </div>
                      <p className="text-[13px] text-[#687380] line-clamp-1">{t.descripcion || 'Plantilla oficial OdontoLeal'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
            onClick={handleConfirm}
            className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black text-xs font-extrabold hover:bg-[#C29E2F] flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <span>✓</span> Adjuntar seleccionados ({selectedConsents.length})
          </button>
        </div>
      </div>
    </div>
  );
};
