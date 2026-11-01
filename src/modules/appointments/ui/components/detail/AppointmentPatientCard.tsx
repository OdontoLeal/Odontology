// src/modules/appointments/ui/components/detail/AppointmentPatientCard.tsx
import React from 'react';
import { PhoneIcon } from '../../../../../shared/ui/components/Icons';
import { AppointmentDetailPageData } from '../../views/AppointmentDetailPage';

export interface AppointmentPatientCardProps {
  appointment: AppointmentDetailPageData;
  getInitials: (name: string) => string;
  onNavigateToPatientProfile?: (idPaciente: number) => void;
}

export const AppointmentPatientCard: React.FC<AppointmentPatientCardProps> = ({
  appointment,
  getInitials,
  onNavigateToPatientProfile,
}) => {
  return (
    <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-[#D4AF37] tracking-wider">
        <span>📋</span>
        <h3>Información del Paciente</h3>
      </div>

      <div className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-[#111827] text-white font-extrabold text-sm flex items-center justify-center shrink-0">
            {getInitials(appointment.nombrePaciente)}
          </div>
          <div>
            <span className="block text-[11px] font-bold text-[#8F99A3]">Nombre del Paciente</span>
            <button
              type="button"
              onClick={() => onNavigateToPatientProfile?.(appointment.idPaciente)}
              className="text-base font-extrabold text-[#1E242B] hover:text-[#D4AF37] hover:underline cursor-pointer transition-colors text-left flex items-center gap-1.5 group"
              title="Haga click para ver la información y ficha médica completa de este paciente"
            >
              <span>{appointment.nombrePaciente}</span>
              <span className="text-xs text-[#D4AF37] font-bold group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
            </button>
            <span className="text-xs text-[#687380] block mt-0.5">Doc: {appointment.documentoIdentidad}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 text-xs">
          <div>
            <span className="block text-[11px] font-bold text-[#8F99A3] flex items-center gap-1.5">
              <PhoneIcon size={12} color="#D4AF37" /> Teléfono
            </span>
            <span className="font-extrabold text-[#1E242B]">{appointment.telefono}</span>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-[#8F99A3] flex items-center gap-1.5">
              <span className="text-[#D4AF37]">✉</span> Correo Electrónico
            </span>
            <span className="font-extrabold text-[#1E242B]">{appointment.correo}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
