// src/modules/clinical-records/ui/components/tabs/AnamnesisTab.tsx
import React from 'react';
import { SparklesIcon } from '../../../../../shared/ui/components/Icons';

export interface AnamnesisTabProps {
  motivoConsulta: string;
  enfermedadActual: string;
  readOnly?: boolean;
  onMotivoConsultaChange: (val: string) => void;
  onEnfermedadActualChange: (val: string) => void;
  onNextTab: () => void;
}

const QUICK_REASONS = [
  'Tengo un dolor de muela muy fuerte',
  'Se me cayó una calza',
  'Vengo para una limpieza dental de rutina',
  'Se me partió un diente',
  'Me sangran las encías al cepillarme',
  'Siento los dientes destemplados con el frío o el calor',
  'Vengo a revisión general',
  'Se me despegó un bracket',
  'Me chuzan los alambres',
  'Vengo a ponerme una calza',
  'La prótesis no me queda bien',
  'Quiero hacerme un blanqueamiento dental',
];

export const AnamnesisTab: React.FC<AnamnesisTabProps> = ({
  motivoConsulta,
  enfermedadActual,
  readOnly,
  onMotivoConsultaChange,
  onEnfermedadActualChange,
  onNextTab,
}) => {
  const handleAutofillNA = () => {
    onEnfermedadActualChange(
      'N/A - Consulta preventiva o de rutina sin patología dolorosa activa referida por el paciente.'
    );
  };

  return (
    <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-6">
      <div className="pb-3 border-b border-[#E7E7E3]">
        <h3 className="text-base font-black text-[#111111]">1. Anamnesis (Interrogatorio)</h3>
        <p className="text-xs text-[#687380]">
          Registro de la información aportada directamente por el paciente al inicio de la valoración o tratamiento odontológico.
        </p>
      </div>

      {/* Motivo de Consulta */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black uppercase tracking-wider text-[#111111] flex items-center gap-2">
            <span>Motivo de Consulta</span>
            <span className="px-2 py-0.5 rounded-full text-[13px] font-black bg-red-100 text-red-700">
              REQUERIDO
            </span>
          </label>
          <span className="text-[13px] text-[#8F99A3]">Palabras textuales del paciente</span>
        </div>

        <input
          type="text"
          disabled={readOnly}
          value={motivoConsulta}
          onChange={(e) => onMotivoConsultaChange(e.target.value)}
          placeholder="Ej: Vengo a revisión general o describe el motivo del paciente..."
          className="w-full min-h-[44px] rounded-xl border border-[#E7E7E3] px-3.5 py-2 text-xs text-[#111111] bg-[#F6F6F4] focus:bg-white focus:border-[#D4AF37] focus:outline-none transition-all"
        />

        {!readOnly && (
          <div className="rounded-2xl border border-[#E7E7E3] bg-[#FBF6E6]/40 p-4 space-y-2">
            <span className="text-[13px] font-black uppercase text-[#926C15] flex items-center gap-1.5">
              <SparklesIcon size={13} color="#D4AF37" />
              Opciones Rápidas de Autocompletado (Casos Generales)
            </span>
            <div className="flex flex-wrap gap-2">
              {QUICK_REASONS.map((reason, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onMotivoConsultaChange(reason)}
                  className="px-2.5 py-1 rounded-lg border border-[#E7E7E3] bg-white text-[13px] font-semibold text-[#4B5563] hover:border-[#D4AF37] hover:text-[#111111] transition-all"
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Enfermedad Actual */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black uppercase tracking-wider text-[#111111]">
            Enfermedad Actual (Cronología y detalles)
          </label>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAutofillNA}
              className="text-xs font-bold text-[#D4AF37] hover:underline cursor-pointer"
            >
              Autorellenar con N/A (No Aplica)
            </button>
          )}
        </div>

        <textarea
          rows={4}
          disabled={readOnly}
          value={enfermedadActual}
          onChange={(e) => onEnfermedadActualChange(e.target.value)}
          placeholder="Describe inicio, localización, características del dolor y síntomas, intensidad y factores agravantes/atenuantes, o seleccione N/A si no aplica patología..."
          className="w-full rounded-xl border border-[#E7E7E3] p-3 text-xs text-[#111111] bg-[#F6F6F4] focus:bg-white focus:border-[#D4AF37] focus:outline-none transition-all"
        />
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onNextTab}
          className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-black font-black text-xs shadow-sm hover:shadow transition-all cursor-pointer"
        >
          Continuar a Antecedentes →
        </button>
      </div>
    </div>
  );
};
