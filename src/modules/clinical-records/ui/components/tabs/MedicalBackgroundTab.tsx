// src/modules/clinical-records/ui/components/tabs/MedicalBackgroundTab.tsx
import React from 'react';
import { MedicalBackgroundForm } from '../MedicalBackgroundForm';
import { AntecedentesClinicosDTO, HabitosHigieneDTO } from '../../../infrastructure/clinical-record.model';

export interface MedicalBackgroundTabProps {
  antecedentesClinicos: AntecedentesClinicosDTO;
  habitosHigiene: HabitosHigieneDTO;
  readOnly?: boolean;
  onChange: (bgs: AntecedentesClinicosDTO, hbts: HabitosHigieneDTO) => void;
  onPrevTab: () => void;
  onNextTab: () => void;
}

export const MedicalBackgroundTab: React.FC<MedicalBackgroundTabProps> = ({
  antecedentesClinicos,
  habitosHigiene,
  readOnly,
  onChange,
  onPrevTab,
  onNextTab,
}) => {
  const hasInvalidAntecedentes = Object.values(antecedentesClinicos || {}).some((item) => {
    if (!item?.presenta) return false;
    const obsTrim = (item.observaciones || '').trim();
    return (
      !obsTrim ||
      obsTrim.toUpperCase() === 'N/A' ||
      obsTrim.toUpperCase().startsWith('N/A -') ||
      obsTrim.toUpperCase().startsWith('N/A-')
    );
  });

  return (
    <div className="space-y-4">
      <MedicalBackgroundForm
        readOnly={readOnly}
        initialBackgrounds={antecedentesClinicos}
        initialHabits={habitosHigiene}
        onChange={onChange}
      />
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={onPrevTab}
            className="px-4 py-2 rounded-xl border border-[#E7E7E3] text-xs font-bold text-[#687380] hover:text-[#111111] bg-white transition-all cursor-pointer"
          >
            ← Volver a Entrada
          </button>
          <button
            type="button"
            disabled={hasInvalidAntecedentes}
            onClick={onNextTab}
            className={`px-5 py-2.5 rounded-xl font-black text-xs shadow-sm transition-all ${
              hasInvalidAntecedentes
                ? 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed opacity-70'
                : 'bg-[#D4AF37] hover:bg-[#C59B27] text-black hover:shadow cursor-pointer'
            }`}
          >
            Continuar a Examen Físico →
          </button>
        </div>
        {hasInvalidAntecedentes && (
          <p className="text-right text-[12px] font-semibold text-[#DC2626]">
            ⚠️ Complete las observaciones obligatorias de los antecedentes marcados en «Sí» para continuar.
          </p>
        )}
      </div>
    </div>
  );
};
