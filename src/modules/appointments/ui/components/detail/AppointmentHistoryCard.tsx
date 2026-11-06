// src/modules/appointments/ui/components/detail/AppointmentHistoryCard.tsx
import React from 'react';
import { ClipboardIcon } from '../../../../../shared/ui/components/Icons';
import {
  EmptyState,
  SectionAction,
  SectionCard,
} from '../../../../../shared/ui/components/DetailPage';

export interface HistoryItem {
  id: number;
  title: string;
  /** Fecha ya formateada (DD/MM/AAAA hh:mm a. m.). */
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
}) => (
  <SectionCard
    title="Historias Clínicas y Evoluciones"
    icon={<ClipboardIcon />}
    count={`${clinicalHistories.length} registro${clinicalHistories.length !== 1 ? 's' : ''}`}
    action={
      <SectionAction onClick={() => onNavigateToPatientProfile?.(idPaciente)}>
        Ver antecedentes →
      </SectionAction>
    }
  >
    {isLoadingHistories ? (
      <EmptyState>Consultando historias clínicas desde la base de datos...</EmptyState>
    ) : clinicalHistories.length === 0 ? (
      <EmptyState>
        No hay historias clínicas ni evoluciones previas registradas para este paciente.
      </EmptyState>
    ) : (
      <ul className="divide-y divide-[#F3F4F6]">
        {clinicalHistories.map((h, i) => (
          <li
            key={i}
            className="flex min-w-0 flex-col items-stretch gap-2 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <span className="text-break block text-[14px] font-semibold text-[#1E242B]">{h.title}</span>
              {h.doctor && <span className="mt-0.5 block text-[13px] text-[#64748B]">{h.doctor}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:shrink-0">
              <span className="text-[13px] font-medium text-[#64748B]">{h.fecha}</span>
              <SectionAction onClick={() => onNavigateToPatientProfile?.(idPaciente)}>
                Consultar →
              </SectionAction>
            </div>
          </li>
        ))}
      </ul>
    )}
  </SectionCard>
);
