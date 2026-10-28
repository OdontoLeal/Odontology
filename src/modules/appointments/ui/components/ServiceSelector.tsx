// src/modules/appointments/ui/components/ServiceSelector.tsx
import React from 'react';

export interface ServiceOption {
  idServicio: string;
  nombre: string;
  duracionMinutos: number;
  requiereEspecialista: boolean;
}

export interface DoctorOption {
  idUsuario: number;
  nombreCompleto: string;
  especialidad: string;
  tarjetaProfesional?: string;
}

export interface ServiceSelectorProps {
  services: ServiceOption[];
  doctors: DoctorOption[];
  selectedServiceId: string;
  selectedDoctorId: number | null;
  onSelectService: (serviceId: string) => void;
  onSelectDoctor: (doctorId: number) => void;
  className?: string;
}

export const ServiceSelector: React.FC<ServiceSelectorProps> = ({
  services,
  doctors,
  selectedServiceId,
  selectedDoctorId,
  onSelectService,
  onSelectDoctor,
  className = '',
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Selector de Servicio */}
      <div>
        <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-2">
          Servicio Odontológico <span className="text-[#DC2626]">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {services.map((service) => {
            const isSelected = selectedServiceId === service.idServicio;
            return (
              <button
                key={service.idServicio}
                type="button"
                onClick={() => onSelectService(service.idServicio)}
                className={`min-h-[48px] p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                  isSelected
                    ? 'border-[#D4AF37] bg-[#FBF6E6] ring-2 ring-[#D4AF37]/30 shadow-xs'
                    : 'border-[#E2E6EA] bg-white hover:border-[#CBD2D9]'
                }`}
              >
                <div>
                  <p className="text-sm font-extrabold text-[#1E242B]">
                    {service.nombre}
                  </p>
                  <p className="text-xs text-[#8F99A3]">
                    Duración: {service.duracionMinutos} min • {service.requiereEspecialista ? 'Especialista' : 'General'}
                  </p>
                </div>
                {isSelected && (
                  <span className="h-5 w-5 rounded-full bg-[#D4AF37] text-white flex items-center justify-center text-xs font-bold">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selector de Doctor / Profesional Responsable */}
      <div>
        <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-2">
          Doctor / Profesional Encargado <span className="text-[#DC2626]">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {doctors.map((doctor) => {
            const isSelected = selectedDoctorId === doctor.idUsuario;
            return (
              <button
                key={doctor.idUsuario}
                type="button"
                onClick={() => onSelectDoctor(doctor.idUsuario)}
                className={`min-h-[48px] p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                  isSelected
                    ? 'border-[#D4AF37] bg-[#FBF6E6] ring-2 ring-[#D4AF37]/30 shadow-xs'
                    : 'border-[#E2E6EA] bg-white hover:border-[#CBD2D9]'
                }`}
              >
                <div>
                  <p className="text-sm font-extrabold text-[#1E242B]">
                    {doctor.nombreCompleto}
                  </p>
                  <p className="text-xs text-[#687380]">
                    {doctor.especialidad} {doctor.tarjetaProfesional ? `• ${doctor.tarjetaProfesional}` : ''}
                  </p>
                </div>
                {isSelected && (
                  <span className="h-5 w-5 rounded-full bg-[#D4AF37] text-white flex items-center justify-center text-xs font-bold">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
