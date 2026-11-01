// src/modules/clinical-records/ui/components/tabs/FindingsProcedureTab.tsx
import React from 'react';
import { OdontogramCanvas } from '../OdontogramCanvas';
import { OdontogramDataDTO } from '../../../infrastructure/clinical-record.model';
import { ToothIcon } from '../../../../../shared/ui/components/Icons';

export interface FindingsProcedureTabProps {
  activeOdontogram: OdontogramDataDTO;
  affectedTeethCount: number;
  readOnly?: boolean;
  procedimientoRealizado: string;
  diagnostico: string;
  accionesARealizar: string;
  observaciones: string;
  onProcedimientoChange: (val: string) => void;
  onDiagnosticoChange: (val: string) => void;
  onAccionesChange: (val: string) => void;
  onObservacionesChange: (val: string) => void;
  onOdontogramSave: (data: OdontogramDataDTO) => void;
  onOpenExpandedOdontogram?: () => void;
  onDiscardChanges: () => void;
  onNextTab: () => void;
}

export const FindingsProcedureTab: React.FC<FindingsProcedureTabProps> = ({
  activeOdontogram,
  affectedTeethCount,
  readOnly,
  procedimientoRealizado,
  diagnostico,
  accionesARealizar,
  observaciones,
  onProcedimientoChange,
  onDiagnosticoChange,
  onAccionesChange,
  onObservacionesChange,
  onOdontogramSave,
  onOpenExpandedOdontogram,
  onDiscardChanges,
  onNextTab,
}) => {
  return (
    <div className="space-y-6">
      {/* CARD PRINCIPAL: ODONTOGRAMA CLÍNICO REGISTRADO (FDI UNIVERSAL) */}
      <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#E7E7E3]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#111111] flex items-center justify-center">
              <ToothIcon size={20} color="#D4AF37" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-[#111111]">
                  Odontograma Clínico Registrado (FDI Universal)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FBF6E6] text-[#926C15] border border-[#E9C765]">
                  Esquema Activo
                </span>
              </div>
              <p className="text-xs text-[#687380] mt-0.5">
                {affectedTeethCount > 0
                  ? `${affectedTeethCount} piezas con hallazgos • ✓ Esquema validado en sesión clínica actual · Vista de matriz pentafacial`
                  : '0 piezas con hallazgos • Odontograma sano sin patologías registradas • Vista de matriz pentafacial'}
              </p>
            </div>
          </div>

          {onOpenExpandedOdontogram && (
            <button
              type="button"
              onClick={onOpenExpandedOdontogram}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-black font-black text-xs shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Ver y Editar Odontograma
            </button>
          )}
        </div>

        {/* Canvas de Odontograma FDI */}
        <div className="bg-[#FAFAFA] rounded-2xl p-3 border border-[#E7E7E3]">
          <OdontogramCanvas
            initialData={activeOdontogram}
            readOnly={readOnly}
            onSave={onOdontogramSave}
            onOpenExpandedMode={onOpenExpandedOdontogram}
          />
        </div>
      </div>

      {/* CARD: PROCEDIMIENTO REALIZADO (OBLIGATORIO) */}
      <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black uppercase tracking-wider text-[#111111] flex items-center gap-2">
            <span>Procedimiento Realizado</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700">
              OBLIGATORIO
            </span>
          </label>
          <span className="text-[11px] text-[#8F99A3]">
            Descripción minuciosa del acto operatorio, técnica, instrumental y materiales empleados
          </span>
        </div>
        <textarea
          rows={4}
          disabled={readOnly}
          value={procedimientoRealizado}
          onChange={(e) => onProcedimientoChange(e.target.value)}
          placeholder="Describa el procedimiento operatorio, materiales, técnica, aislamiento..."
          className="w-full rounded-xl border border-[#E7E7E3] p-3 text-xs text-[#111111] bg-[#F6F6F4] focus:bg-white focus:border-[#D4AF37] focus:outline-none transition-all"
        />
      </div>

      {/* CARD: DIAGNÓSTICO CLÍNICO */}
      <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-2">
        <label className="text-xs font-black uppercase tracking-wider text-[#111111] block">
          Diagnóstico Clínico (Definitivo / Presuntivo)
        </label>
        <textarea
          rows={2}
          disabled={readOnly}
          value={diagnostico}
          onChange={(e) => onDiagnosticoChange(e.target.value)}
          placeholder="Indique diagnóstico odontológico principal y secundarios..."
          className="w-full rounded-xl border border-[#E7E7E3] p-3 text-xs text-[#111111] bg-[#F6F6F4] focus:bg-white focus:border-[#D4AF37] focus:outline-none transition-all"
        />
      </div>

      {/* GRID 2 COLUMNAS: ACCIONES A REALIZAR Y OBSERVACIONES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-2">
          <label className="block text-xs font-black uppercase tracking-wider text-[#111111]">
            Acciones a Realizar (Plan Próxima Cita)
          </label>
          <textarea
            rows={3}
            disabled={readOnly}
            value={accionesARealizar}
            onChange={(e) => onAccionesChange(e.target.value)}
            placeholder="Próximos pasos terapéuticos o controles..."
            className="w-full rounded-xl border border-[#E7E7E3] p-3 text-xs text-[#111111] bg-[#F6F6F4] focus:bg-white focus:border-[#D4AF37] focus:outline-none transition-all"
          />
        </div>

        <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black uppercase tracking-wider text-[#111111]">
              Observaciones Generales de la Atención
            </label>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F6F6F4] text-[#687380]">
              Opcional
            </span>
          </div>
          <textarea
            rows={3}
            disabled={readOnly}
            value={observaciones}
            onChange={(e) => onObservacionesChange(e.target.value)}
            placeholder="Observaciones clínicas adicionales..."
            className="w-full rounded-xl border border-[#E7E7E3] p-3 text-xs text-[#111111] bg-[#F6F6F4] focus:bg-white focus:border-[#D4AF37] focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* BARRA INFERIOR DE NAVEGACIÓN */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#E7E7E3]">
        <button
          type="button"
          onClick={onDiscardChanges}
          className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors cursor-pointer"
        >
          ✕ Descartar Cambios
        </button>

        <button
          type="button"
          onClick={onNextTab}
          className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-black font-black text-xs shadow-sm hover:shadow transition-all cursor-pointer"
        >
          Continuar a Plan de Manejo →
        </button>
      </div>
    </div>
  );
};
