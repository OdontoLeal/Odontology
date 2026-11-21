// src/modules/clinical-records/ui/components/ReplaceFindingModal.tsx
import React from 'react';
import { Modal } from '../../../../shared/ui/components/Modal';
import { Button } from '../../../../shared/ui/components/Button';

export type SurfaceFindingType =
  | 'none'
  | 'caries_activa'
  | 'restauracion_resina'
  | 'sellante_fosas'
  | 'desgaste_faceta';

export interface ReplaceFindingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  toothCode: string;
  surfaceLabel: string;
  currentFinding: SurfaceFindingType;
  newFinding: SurfaceFindingType;
}

export const SURFACE_FINDINGS_META: Record<
  SurfaceFindingType,
  { label: string; color: string; bg: string; border: string; badgeText: string }
> = {
  caries_activa: {
    label: 'Caries activa',
    color: '#EF4444',
    bg: '#FEF2F2',
    border: '#FECACA',
    badgeText: '🔴 Rojo (Caries)',
  },
  restauracion_resina: {
    label: 'Restauración en resina',
    color: '#3B82F6',
    bg: '#EFF6FF',
    border: '#BFDBFE',
    badgeText: '🔵 Azul (Resina)',
  },
  sellante_fosas: {
    label: 'Sellante de fosas y fisuras',
    color: '#10B981',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    badgeText: '🟢 Verde (Sellante)',
  },
  desgaste_faceta: {
    label: 'Desgaste / Faceta oclusal',
    color: '#F59E0B',
    bg: '#FFFBEB',
    border: '#FDE68A',
    badgeText: '🟡 Amarillo (Desgaste)',
  },
  none: {
    label: 'Sano / Sin hallazgo',
    color: '#64748B',
    bg: '#F8FAFC',
    border: '#E2E8F0',
    badgeText: '⚪ Blanco (Sano)',
  },
};

export const ReplaceFindingModal: React.FC<ReplaceFindingModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  toothCode,
  surfaceLabel,
  currentFinding,
  newFinding,
}) => {
  const currentMeta = SURFACE_FINDINGS_META[currentFinding] || SURFACE_FINDINGS_META.none;
  const newMeta = SURFACE_FINDINGS_META[newFinding] || SURFACE_FINDINGS_META.none;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reemplazar Hallazgo Dental"
      subtitle={`Pieza ${toothCode} • ${surfaceLabel}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Mensaje contextual */}
        <p className="text-xs sm:text-[13px] text-[#4B5563] leading-relaxed">
          Esta cara dental ya cuenta con un hallazgo registrado. Conforme al sistema FDI, cada cara dental puede contener un único hallazgo activo. ¿Desea sustituir el hallazgo actual por el nuevo seleccionado?
        </p>

        {/* Tarjetas comparativas visuales */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] items-center gap-3 p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
          {/* Hallazgo Actual */}
          <div
            className="p-3 rounded-xl border flex flex-col justify-between space-y-1.5"
            style={{ backgroundColor: currentMeta.bg, borderColor: currentMeta.border }}
          >
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B]">
              Hallazgo Actual
            </span>
            <div className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                style={{ backgroundColor: currentMeta.color }}
              />
              <span className="font-bold text-xs sm:text-[13px] text-[#1E242B]">
                {currentMeta.label}
              </span>
            </div>
            <span className="text-[11px] font-medium text-[#64748B]">
              {currentMeta.badgeText}
            </span>
          </div>

          {/* Flecha de transición */}
          <div className="flex justify-center text-lg font-bold text-[#8F99A3] select-none">
            <span className="hidden sm:inline">➔</span>
            <span className="sm:hidden">↓</span>
          </div>

          {/* Nuevo Hallazgo */}
          <div
            className="p-3 rounded-xl border flex flex-col justify-between space-y-1.5"
            style={{ backgroundColor: newMeta.bg, borderColor: newMeta.border }}
          >
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#D4AF37]">
              Nuevo Hallazgo
            </span>
            <div className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                style={{ backgroundColor: newMeta.color }}
              />
              <span className="font-bold text-xs sm:text-[13px] text-[#1E242B]">
                {newMeta.label}
              </span>
            </div>
            <span className="text-[11px] font-medium text-[#64748B]">
              {newMeta.badgeText}
            </span>
          </div>
        </div>

        {/* Nota informativa */}
        <p className="text-[11px] text-[#8F99A3] italic">
          ℹ️ Al confirmar el cambio, el color de la cara dental en el odontograma se actualizará inmediatamente al nuevo hallazgo.
        </p>

        {/* Botones de acción */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-[#E2E6EA]">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar y Mantener Actual
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onConfirm}>
            Sí, Reemplazar Hallazgo
          </Button>
        </div>
      </div>
    </Modal>
  );
};
