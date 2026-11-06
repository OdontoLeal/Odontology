// src/modules/appointments/ui/components/detail/AppointmentPatientCard.tsx
import React from 'react';
import { UserIcon } from '../../../../../shared/ui/components/Icons';
import {
  PatientSummaryBanner,
  SectionAction,
  SectionCard,
} from '../../../../../shared/ui/components/DetailPage';
import { AppointmentDetailPageData } from '../../views/AppointmentDetailPage';

export interface AppointmentPatientCardProps {
  appointment: AppointmentDetailPageData;
  /** Se conserva por compatibilidad; el avatar usa <UserAvatar />. */
  getInitials?: (name: string) => string;
  onNavigateToPatientProfile?: (idPaciente: number) => void;
}

export const AppointmentPatientCard: React.FC<AppointmentPatientCardProps> = ({
  appointment,
  onNavigateToPatientProfile,
}) => {
  const goToProfile = onNavigateToPatientProfile
    ? () => onNavigateToPatientProfile(appointment.idPaciente)
    : undefined;

  return (
    <SectionCard
      title="Información del Paciente"
      icon={<UserIcon />}
      action={
        goToProfile ? <SectionAction onClick={goToProfile}>Ver ficha completa →</SectionAction> : undefined
      }
    >
      <PatientSummaryBanner
        nombre={appointment.nombrePaciente}
        documento={appointment.documentoIdentidad}
        telefono={appointment.telefono}
        correo={appointment.correo}
        onNameClick={goToProfile}
      />
    </SectionCard>
  );
};
