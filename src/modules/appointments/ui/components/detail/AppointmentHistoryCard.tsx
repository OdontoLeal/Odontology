// src/modules/appointments/ui/components/detail/AppointmentHistoryCard.tsx
import React from 'react';
import { ClipboardIcon } from '../../../../../shared/ui/components/Icons';

export interface HistoryItem {
  id: number;
  title: string;
  fecha: string;
  doctor: string;
}

export interface AppointmentHistoryCardProps {
  idPaciente: number;
  clinicalHistories: HistoryItem[];
  isLoadingHistories: boolean;
  onNavigateToPatientProfile?: (idPaciente: number) => void;
}

export const AppointmentHistoryCard: React.FC<AppointmentHistoryCardProps> = ({
  idPaciente,
  clinicalHistories,
  isLoadingHistories,
  onNavigateToPatientProfile,
}) => {
  return (
    <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E6EA]">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#111111] flex items-center justify-center shrink-0">
            <ClipboardIcon size={18} color="#D4AF37" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-[#1E242B]">Historias Clínicas</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF3C7] text-[#92400E]">
              {clinicalHistories.length} historia{clinicalHistories.length !== 1 ? 's clínicas' : ' clínica'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateToPatientProfile?.(idPaciente)}
          className="text-xs font-bold text-[#687380] hover:text-[#1E242B] flex items-center gap-1 cursor-pointer"
        >
          Ver antecedentes ⌃
        </button>
      </div>

      {isLoadingHistories ? (
        <div className="py-6 text-center text-xs text-[#8F99A3]">
          Consultando historias clínicas desde la base de datos...
        </div>
      ) : clinicalHistories.length === 0 ? (
        <div className="py-6 text-center rounded-2xl border border-dashed border-[#E2E6EA] text-xs text-[#8F99A3]">
          No hay historias clínicas ni evoluciones previas registradas para este paciente en la base de datos.
        </div>
      ) : (
        <div className="divide-y divide-[#E2E6EA]">
          {clinicalHistories.map((h, i) => (
            <div key={i} className="py-3.5 flex items-center justify-between gap-4 text-xs">
              <div>
                <span className="font-bold text-[#1E242B]">{h.title}</span>
                {h.doctor && <span className="block text-[11px] text-[#687380] mt-0.5">{h.doctor}</span>}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-[#687380] font-medium">{h.fecha}</span>
                <button
                  type="button"
                  onClick={() => onNavigateToPatientProfile?.(idPaciente)}
                  className="font-bold text-[#D4AF37] hover:text-[#B8942A] cursor-pointer"
                >
                  Consultar →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
