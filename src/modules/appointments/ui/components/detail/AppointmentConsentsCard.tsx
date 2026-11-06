// src/modules/appointments/ui/components/detail/AppointmentConsentsCard.tsx
import React from 'react';
import { FileTextIcon } from '../../../../../shared/ui/components/Icons';
import {
  DetailAction,
  EmptyState,
  SectionAction,
  SectionCard,
  StatusBadge,
} from '../../../../../shared/ui/components/DetailPage';
import { formatDateCO } from '../../../../../shared/ui/format';

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
}) => (
  <SectionCard
    title="Consentimientos Informados"
    icon={<FileTextIcon />}
    count={`${consentItems.length} documento${consentItems.length !== 1 ? 's' : ''}`}
    action={
      <DetailAction variant="primary" onClick={onOpenAttachModal} leftIcon={<span>+</span>}>
        Adjuntar consentimiento
      </DetailAction>
    }
  >
    {isLoadingConsents ? (
      <EmptyState>Consultando consentimientos desde la base de datos...</EmptyState>
    ) : consentItems.length === 0 ? (
      <EmptyState>
        No hay consentimientos informados registrados para este paciente en la base de datos.
      </EmptyState>
    ) : (
      <ul className="divide-y divide-[#F3F4F6]">
        {consentItems.map((c, i) => (
          <li
            key={c.id_consentimiento || c.id || i}
            className="flex min-w-0 flex-col items-stretch gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <h3 className="text-break text-[14px] font-semibold text-[#1E242B]">
                {c.nombre_plantilla || c.nombre_documento || c.title || 'Consentimiento Odontológico'}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[#64748B]">
                <StatusBadge tone={c.firmado ? 'success' : 'warning'}>
                  {c.firmado ? 'Firmado' : 'Sin firmar'}
                </StatusBadge>
                {c.fecha_creacion && <span>{formatDateCO(c.fecha_creacion)}</span>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              {!c.firmado && (
                <DetailAction onClick={() => onSignConsent?.(c.id_consentimiento || c.id!)}>
                  Firmar
                </DetailAction>
              )}
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
