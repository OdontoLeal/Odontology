// src/modules/appointments/ui/components/detail/AppointmentEditView.tsx
import React from 'react';
import { UserIcon, ClockIcon, StethoscopeIcon } from '../../../../../shared/ui/components/Icons';
import {
  DetailAction,
  DetailPageContainer,
  DetailPageHeader,
  EmptyState,
  PatientSummaryBanner,
  SectionCard,
  StatusBadge,
} from '../../../../../shared/ui/components/DetailPage';
import { formatTimeCO } from '../../../../../shared/ui/format';
import { DoctorOption } from '../ServiceSelector';
import { AppointmentDetailPageData } from '../../views/AppointmentDetailPage';

export interface EditDaySlotItem {
  inicio: string;
  final: string;
  timeStart: string;
  timeEnd: string;
  label: string;
  isAssignedToThisAppt: boolean;
  isOccupiedByOther: boolean;
  occupantName?: string;
}

export interface AppointmentEditViewProps {
  appointment: AppointmentDetailPageData;
  doctorsList: DoctorOption[];
  editDoctorId: number;
  editTitulo: string;
  editDescripcion: string;
  editSelectedBlocks: string[];
  editDaySlots: EditDaySlotItem[];
  isLoadingEditSlots: boolean;
  isSavingEdit: boolean;
  formatSpanishHeaderDate: (dateStr: string) => string;
  getInitials?: (name: string) => string;
  onCancel: () => void;
  onDoctorChange: (id: number) => void;
  onTituloChange: (val: string) => void;
  onDescripcionChange: (val: string) => void;
  onToggleBlock: (slot: EditDaySlotItem) => void;
  onSave: () => Promise<void> | void;
}

export const AppointmentEditView: React.FC<AppointmentEditViewProps> = ({
  appointment,
  doctorsList,
  editDoctorId,
  editTitulo,
  editDescripcion,
  editSelectedBlocks,
  editDaySlots,
  isLoadingEditSlots,
  isSavingEdit,
  formatSpanishHeaderDate,
  onCancel,
  onDoctorChange,
  onTituloChange,
  onDescripcionChange,
  onToggleBlock,
  onSave,
}) => {
  const fieldClass =
    'w-full min-h-[44px] rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-[14px] text-[#1E242B] focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20';
  const labelClass = 'block text-[14px] font-semibold text-[#1E242B]';

  return (
    <DetailPageContainer>
      <DetailPageHeader
        backLabel="Volver al Detalle de la Cita"
        onBack={onCancel}
        title={`Editar Cita Médica #${appointment.idCita}`}
        badge={<StatusBadge tone="gold">Modo edición</StatusBadge>}
        subtitle="Modifica el profesional a cargo, el procedimiento y ajusta los bloques de horario continuos en la agenda."
        actions={
          <>
            <DetailAction disabled={isSavingEdit} onClick={onCancel}>
              Cancelar
            </DetailAction>
            <DetailAction
              variant="primary"
              disabled={isSavingEdit || editSelectedBlocks.length === 0}
              onClick={onSave}
            >
              {isSavingEdit ? 'Guardando cambios...' : 'Guardar cambios de la cita'}
            </DetailAction>
          </>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        {/* Columna izquierda: paciente y asignación clínica */}
        <div className="min-w-0 space-y-6">
          <SectionCard title="Paciente Programado" icon={<UserIcon />}>
            <PatientSummaryBanner
              nombre={appointment.nombrePaciente}
              documento={appointment.documentoIdentidad}
              telefono={appointment.telefono}
              correo={appointment.correo}
            />
          </SectionCard>

          <SectionCard title="Asignación Clínica" icon={<StethoscopeIcon />}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="edit-doctor" className={labelClass}>
                  Profesional odontológico encargado
                </label>
                <select
                  id="edit-doctor"
                  value={editDoctorId}
                  onChange={(e) => onDoctorChange(Number(e.target.value))}
                  className={`${fieldClass} cursor-pointer`}
                >
                  {doctorsList.map((doc) => (
                    <option key={doc.idUsuario} value={doc.idUsuario}>
                      {doc.nombreCompleto} {doc.especialidad ? `(${doc.especialidad})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-titulo" className={labelClass}>
                  Procedimiento / título de la cita
                </label>
                <input
                  id="edit-titulo"
                  type="text"
                  value={editTitulo}
                  onChange={(e) => onTituloChange(e.target.value)}
                  placeholder="Ej. Valoración para Implante Dental"
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-descripcion" className={labelClass}>
                  Observaciones / plan de tratamiento
                </label>
                <textarea
                  id="edit-descripcion"
                  rows={4}
                  value={editDescripcion}
                  onChange={(e) => onDescripcionChange(e.target.value)}
                  placeholder="Detalles clínicos o instrucciones específicas para esta cita..."
                  className={fieldClass}
                />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Columna derecha: bloques horarios */}
        <SectionCard
          title="Bloques Horarios Disponibles"
          icon={<ClockIcon />}
          action={
            <span className="text-[13px] font-semibold text-[#1E242B]">
              {formatSpanishHeaderDate(appointment.fecha)}
            </span>
          }
        >
          <p className="mb-4 text-[14px] leading-6 text-[#64748B]">
            Selecciona uno o más bloques contiguos (30 min c/u). Los bloques resaltados en dorado
            corresponden al horario de esta cita.
          </p>

          {isLoadingEditSlots ? (
            <EmptyState>Consultando disponibilidad de bloques en la base de datos...</EmptyState>
          ) : editDaySlots.length === 0 ? (
            <EmptyState>No hay bloques de horario generados para esta fecha.</EmptyState>
          ) : (
            <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
              {editDaySlots.map((slot) => {
                const isSelected = editSelectedBlocks.includes(slot.inicio);
                const isOccupied = slot.isOccupiedByOther;

                return (
                  <label
                    key={slot.inicio}
                    className={`flex min-h-[44px] flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-[14px] transition-all ${
                      isOccupied
                        ? 'cursor-not-allowed border-[#E2E8F0] bg-[#F1F5F9] text-[#64748B]'
                        : isSelected
                          ? 'cursor-pointer border-[#D4AF37] bg-[#FFFBEB] font-semibold text-[#92400E]'
                          : 'cursor-pointer border-[#E2E8F0] bg-white text-[#1E242B] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isOccupied}
                        onChange={() => onToggleBlock(slot)}
                        className="h-5 w-5 cursor-pointer rounded accent-[#D4AF37]"
                      />
                      <span className="font-semibold">{formatTimeCO(slot.label)}</span>
                    </span>

                    {isOccupied ? (
                      <StatusBadge tone="danger">
                        Ocupado ({slot.occupantName || 'Dr. asignado'})
                      </StatusBadge>
                    ) : isSelected ? (
                      <StatusBadge tone="gold">Asignado</StatusBadge>
                    ) : (
                      <StatusBadge tone="success">Disponible</StatusBadge>
                    )}
                  </label>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#F3F4F6] pt-3 text-[14px] font-semibold">
            <span className="text-[#64748B]">Duración seleccionada:</span>
            <StatusBadge tone="gold">
              {editSelectedBlocks.length * 30} minutos ({editSelectedBlocks.length} bloque
              {editSelectedBlocks.length !== 1 ? 's' : ''})
            </StatusBadge>
          </div>
        </SectionCard>
      </div>
    </DetailPageContainer>
  );
};
