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
  return (
    <div className="space-y-4">
      <MedicalBackgroundForm
        readOnly={readOnly}
        initialBackgrounds={antecedentesClinicos}
        initialHabits={habitosHigiene}
        onChange={onChange}
      />
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onPrevTab}
          className="px-4 py-2 rounded-xl border border-[#E7E7E3] text-xs font-bold text-[#687380] hover:text-[#111111] bg-white transition-all cursor-pointer"
        >
          ← Volver a Entrada
        </button>
        <button
          type="button"
          onClick={onNextTab}
          className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-black font-black text-xs shadow-sm hover:shadow transition-all cursor-pointer"
        >
          Continuar a Examen Físico →
        </button>
      </div>
    </div>
  );
};
