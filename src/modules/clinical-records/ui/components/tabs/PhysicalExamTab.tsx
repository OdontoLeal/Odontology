// src/modules/clinical-records/ui/components/tabs/PhysicalExamTab.tsx
import React from 'react';
import { StomatognathicExamForm } from '../StomatognathicExamForm';
import { ExamenEstomatognaticoDTO } from '../../../infrastructure/clinical-record.model';

export interface PhysicalExamTabProps {
  examenEstomatognatico: ExamenEstomatognaticoDTO;
  examenFisicoObservaciones: string;
  readOnly?: boolean;
  onChange: (structs: ExamenEstomatognaticoDTO, notes: string) => void;
  onPrevTab: () => void;
  onNextTab: () => void;
}

export const PhysicalExamTab: React.FC<PhysicalExamTabProps> = ({
  examenEstomatognatico,
  examenFisicoObservaciones,
  readOnly,
  onChange,
  onPrevTab,
  onNextTab,
}) => {
  return (
    <div className="space-y-4">
      <StomatognathicExamForm
        readOnly={readOnly}
        initialStructures={examenEstomatognatico}
        initialGeneralNotes={examenFisicoObservaciones}
        onChange={onChange}
      />
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onPrevTab}
          className="px-4 py-2 rounded-xl border border-[#E7E7E3] text-xs font-bold text-[#687380] hover:text-[#111111] bg-white transition-all cursor-pointer"
        >
          ← Volver a Antecedentes
        </button>
        <button
          type="button"
          onClick={onNextTab}
          className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-black font-black text-xs shadow-sm hover:shadow transition-all cursor-pointer"
        >
          Continuar a Hallazgos y Procedimiento →
        </button>
      </div>
    </div>
  );
};
