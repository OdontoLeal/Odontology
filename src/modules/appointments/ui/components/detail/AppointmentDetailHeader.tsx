// src/modules/appointments/ui/components/detail/AppointmentDetailHeader.tsx
import React from 'react';
import { ClockIcon } from '../../../../../shared/ui/components/Icons';
import {
  AppointmentStatusBadge,
  DetailAction,
  DetailPageHeader,
  StatusBadge,
  UserAvatar,
} from '../../../../../shared/ui/components/DetailPage';
import { formatTimeRangeCO } from '../../../../../shared/ui/format';
import { AppointmentDetailPageData } from '../../views/AppointmentDetailPage';

export interface AppointmentDetailHeaderProps {
  appointment: AppointmentDetailPageData;
  canStartAttention: boolean;
  canAssistConsultation?: boolean;
  formatSpanishHeaderDate: (dateStr: string) => string;
  /** Se conserva por compatibilidad; el avatar usa <UserAvatar />. */
  getInitials?: (name: string) => string;
  onBack?: () => void;
  onStartAttention?: (idCita: number, idPaciente: number) => void;
  onOpenEditMode: () => void;
  onOpenNoShowModal: () => void;
  onOpenCancelModal: () => void;
}

export const AppointmentDetailHeader: React.FC<AppointmentDetailHeaderProps> = ({
  appointment,
  canStartAttention,
  canAssistConsultation,
  formatSpanishHeaderDate,
  onBack,
  onStartAttention,
  onOpenEditMode,
  onOpenNoShowModal,
  onOpenCancelModal,
}) => {
  const { estado } = appointment;

  const actions =
    estado === 'Confirmada' ? (
      <>
        <DetailAction variant="danger" onClick={onOpenCancelModal}>
          Cancelar cita
        </DetailAction>
        <DetailAction onClick={onOpenNoShowModal}>Marcar inasistencia</DetailAction>
        <DetailAction onClick={onOpenEditMode}>Editar cita</DetailAction>
        {canStartAttention && (
          <DetailAction
            variant="primary"
            onClick={() => onStartAttention?.(appointment.idCita, appointment.idPaciente)}
            leftIcon={<span>▶</span>}
          >
            Iniciar cita
          </DetailAction>
        )}
      </>
    ) : estado === 'En consulta' && (canStartAttention || canAssistConsultation) ? (
      <DetailAction
        variant="dark"
        onClick={() => onStartAttention?.(appointment.idCita, appointment.idPaciente)}
      >
        {canStartAttention ? 'Continuar en espacio clínico' : 'Asistir en espacio clínico'}
      </DetailAction>
    ) : undefined;

  const stateNote =
    estado === 'Inasistencia'
      ? { tone: 'danger' as const, text: 'Inasistencia registrada (bloques conservados)' }
      : estado === 'Cancelada'
        ? { tone: 'neutral' as const, text: 'Cita cancelada (bloques liberados)' }
        : estado === 'Atendida'
          ? { tone: 'success' as const, text: 'Atención finalizada' }
          : null;

  return (
    <DetailPageHeader
      backLabel="Volver a la Agenda"
      onBack={onBack}
      title={appointment.titulo || 'Valoración Odontológica'}
      badge={<AppointmentStatusBadge estado={estado} />}
      subtitle={
        <span className="inline-flex items-start gap-2">
          <ClockIcon size={14} color="#D4AF37" className="mt-[3px] shrink-0" />
          <span className="min-w-0">
            {formatSpanishHeaderDate(appointment.fecha)} ·{' '}
            {formatTimeRangeCO(appointment.horaInicio, appointment.horaFin)}
            {appointment.sillon ? ` · ${appointment.sillon}` : ''}
          </span>
        </span>
      }
      meta={
        <div className="space-y-3">
          {appointment.descripcion && (
            <p className="text-break max-w-3xl text-[14px] leading-6 text-[#475569]">
              {appointment.descripcion}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-[#64748B]">
            <span className="inline-flex min-w-0 items-center gap-2">
              <UserAvatar name={appointment.doctorNombre} size="sm" tone="dark" />
              <span className="text-break">
                Doctor encargado:{' '}
                <strong className="font-semibold text-[#1E242B]">{appointment.doctorNombre}</strong>
              </span>
            </span>
            <span>
              Agendado por:{' '}
              <strong className="font-semibold text-[#1E242B]">
                {appointment.agendadoPor || 'Portal Web'}
              </strong>
            </span>
          </div>
          {stateNote && <StatusBadge tone={stateNote.tone}>{stateNote.text}</StatusBadge>}
        </div>
      }
      actions={actions}
    />
  );
};
