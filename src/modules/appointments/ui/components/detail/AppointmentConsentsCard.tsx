// src/modules/appointments/ui/components/detail/AppointmentConsentsCard.tsx
import React from 'react';

export interface ConsentItem {
  id_consentimiento?: number;
  id?: number;
  nombre_plantilla?: string;
  nombre_documento?: string;
  title?: string;
  firmado?: boolean;
  fecha_creacion?: string;
}

export interface AppointmentConsentsCardProps {
  idPaciente: number;
  consentItems: ConsentItem[];
  isLoadingConsents: boolean;
  onOpenAttachModal: () => void;
  onSignConsent?: (idConsentimiento: number) => void;
  onNavigateToPatientProfile?: (idPaciente: number) => void;
}

export const AppointmentConsentsCard: React.FC<AppointmentConsentsCardProps> = ({
  idPaciente,
  consentItems,
  isLoadingConsents,
  onOpenAttachModal,
  onSignConsent,
  onNavigateToPatientProfile,
}) => {
  return (
    <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-[#E2E6EA]">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#111827] text-white flex items-center justify-center shrink-0">
            📋
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-[#1E242B]">Consentimientos Informados</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F3F4F6] text-[#4B5563]">
              {consentItems.length} documento{consentItems.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenAttachModal}
            className="px-3 py-1.5 rounded-xl bg-[#D4AF37] hover:bg-[#C29E2F] text-black text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>+</span> Adjuntar consentimiento
          </button>
          <span className="text-xs text-[#687380] font-bold">Ver documentos ⌃</span>
        </div>
      </div>

      {isLoadingConsents ? (
        <div className="py-6 text-center text-xs text-[#8F99A3]">
          Consultando consentimientos desde la base de datos...
        </div>
      ) : consentItems.length === 0 ? (
        <div className="py-6 text-center rounded-2xl border border-dashed border-[#E2E6EA] text-xs text-[#8F99A3]">
          No hay consentimientos informados registrados para este paciente en la base de datos.
        </div>
      ) : (
        <div className="divide-y divide-[#E2E6EA]">
          {consentItems.map((c, i) => (
            <div
              key={c.id_consentimiento || c.id || i}
              className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
            >
              <div>
                <h4 className="font-bold text-[#1E242B]">
                  {c.nombre_plantilla || c.nombre_documento || c.title || 'Consentimiento Odontológico'}
                </h4>
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F3F4F6] text-[#687380] text-[11px] font-semibold">
                    ⚪ {c.firmado ? 'Firmado' : 'Sin firmar'}
                  </span>
                  {c.fecha_creacion && (
                    <span className="text-[11px] text-[#8F99A3]">{String(c.fecha_creacion).split('T')[0]}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!c.firmado && (
                  <button
                    type="button"
                    onClick={() => onSignConsent?.(c.id_consentimiento || c.id!)}
                    className="px-3 py-1.5 rounded-xl border border-[#E2E6EA] text-[#1E242B] hover:bg-[#F3F4F6] font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>✏</span> Firmar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigateToPatientProfile?.(idPaciente)}
                  className="font-bold text-[#D4AF37] hover:text-[#B8942A] pl-2 cursor-pointer"
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
