// src/modules/appointments/ui/components/detail/AppointmentEditView.tsx
import React from 'react';
import { UserIcon, ClockIcon } from '../../../../../shared/ui/components/Icons';
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
  getInitials: (name: string) => string;
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
  getInitials,
  onCancel,
  onDoctorChange,
  onTituloChange,
  onDescripcionChange,
  onToggleBlock,
  onSave,
}) => {
  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-fadeIn">
      {/* Encabezado con botón de volver */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#687380] hover:text-[#1E242B] transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Cancelar Edición y Volver
        </button>
        <span className="text-xs text-[#8F99A3]">Modo de Modificación de Cita Confirmada</span>
      </div>

      {/* Tarjeta de Edición Principal */}
      <div className="rounded-3xl border border-[#E2E6EA] border-t-5 border-t-[#D4AF37] bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-[#E2E6EA]">
          <div className="h-12 w-12 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] text-[#D4AF37] flex items-center justify-center shrink-0">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E242B]">
              Editar Cita Médica • #{appointment.idCita}
            </h1>
            <p className="text-xs text-[#687380] mt-0.5">
              Modifica el profesional a cargo, el procedimiento y ajusta los bloques de horario continuos en la agenda.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Izquierda: Información del Paciente y Datos del Tratamiento */}
          <div className="lg:col-span-6 space-y-6">
            <div className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-[#D4AF37] tracking-wider">
                <UserIcon size={14} color="#D4AF37" />
                <h3>Paciente Programado</h3>
              </div>

              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-[#111827] text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                  {getInitials(appointment.nombrePaciente)}
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-[#1E242B]">{appointment.nombrePaciente}</h4>
                  <span className="text-xs text-[#687380]">Doc: {appointment.documentoIdentidad}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#E2E6EA] text-xs">
                <div>
                  <span className="text-[11px] font-bold text-[#8F99A3] block">Teléfono</span>
                  <span className="font-semibold text-[#1E242B]">{appointment.telefono}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-[#8F99A3] block">Correo</span>
                  <span className="font-semibold text-[#1E242B]">{appointment.correo}</span>
                </div>
              </div>
            </div>

            {/* Asignación clínica */}
            <div className="rounded-2xl border border-[#E2E6EA] bg-white p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-[#D4AF37] tracking-wider">
                <span>🩺</span>
                <h3>Asignación Clínica</h3>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#1E242B]">Profesional Odontológico Encargado</label>
                <select
                  value={editDoctorId}
                  onChange={(e) => onDoctorChange(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#E2E6EA] p-2.5 text-xs text-[#1E242B] font-semibold bg-white focus:border-[#D4AF37] focus:outline-none cursor-pointer"
                >
                  {doctorsList.map((doc) => (
                    <option key={doc.idUsuario} value={doc.idUsuario}>
                      {doc.nombreCompleto} {doc.especialidad ? `(${doc.especialidad})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#1E242B]">Procedimiento / Título de la Cita</label>
                <input
                  type="text"
                  value={editTitulo}
                  onChange={(e) => onTituloChange(e.target.value)}
                  placeholder="Ej. Valoración para Implante Dental"
                  className="w-full rounded-xl border border-[#E2E6EA] p-2.5 text-xs text-[#1E242B] font-semibold focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#1E242B]">Observaciones / Plan de Tratamiento</label>
                <textarea
                  rows={4}
                  value={editDescripcion}
                  onChange={(e) => onDescripcionChange(e.target.value)}
                  placeholder="Detalles clínicos o instrucciones específicas para esta cita..."
                  className="w-full rounded-xl border border-[#E2E6EA] p-3 text-xs text-[#1E242B] focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Columna Derecha: Selector de Bloques Horarios Continuos */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E6EA]">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-[#D4AF37] tracking-wider">
                  <ClockIcon size={14} color="#D4AF37" />
                  <h3>Bloques Horarios Disponibles</h3>
                </div>
                <span className="text-xs font-bold text-[#1E242B]">
                  {formatSpanishHeaderDate(appointment.fecha)}
                </span>
              </div>

              <p className="text-xs text-[#687380] leading-relaxed">
                Selecciona uno o más bloques contiguos (30 min c/u). Los bloques marcados en amarillo corresponden al horario de esta cita.
              </p>

              {isLoadingEditSlots ? (
                <div className="py-12 text-center text-xs text-[#8F99A3]">
                  Consultando disponibilidad de bloques en la base de datos...
                </div>
              ) : editDaySlots.length === 0 ? (
                <div className="py-8 text-center rounded-xl border border-dashed border-[#E2E6EA] text-xs text-[#8F99A3]">
                  No hay bloques de horario generados en base de datos para esta fecha.
                </div>
              ) : (
                <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                  {editDaySlots.map((slot) => {
                    const isSelected = editSelectedBlocks.includes(slot.inicio);
                    const isOccupied = slot.isOccupiedByOther;

                    return (
                      <div
                        key={slot.inicio}
                        onClick={() => onToggleBlock(slot)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${
                          isOccupied
                            ? 'border-[#E2E6EA] bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed opacity-75'
                            : isSelected
                            ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#92400E] font-bold shadow-xs cursor-pointer'
                            : 'border-[#E2E6EA] bg-white text-[#1E242B] hover:bg-[#F8F9FA] cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isOccupied}
                            onChange={() => {}}
                            className="h-4 w-4 rounded accent-[#D4AF37] cursor-pointer"
                          />
                          <span className="font-semibold">{slot.label}</span>
                        </div>

                        <div>
                          {isOccupied ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEE2E2] text-[#DC2626]">
                              🔒 Ocupado ({slot.occupantName || 'Dr. Asignado'})
                            </span>
                          ) : isSelected ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D4AF37] text-white">
                              ✓ Asignado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#059669]">
                              Disponible
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-3 border-t border-[#E2E6EA] flex items-center justify-between text-xs font-bold">
                <span className="text-[#687380]">Duración seleccionada:</span>
                <span className="px-3 py-1 rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">
                  {editSelectedBlocks.length * 30} minutos ({editSelectedBlocks.length} bloque
                  {editSelectedBlocks.length !== 1 ? 's' : ''})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2E6EA]">
          <button
            type="button"
            disabled={isSavingEdit}
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-[#E2E6EA] text-xs font-bold text-[#687380] hover:bg-[#F3F4F6] cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={isSavingEdit || editSelectedBlocks.length === 0}
            onClick={onSave}
            className="px-6 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C29E2F] text-black text-xs font-extrabold flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSavingEdit ? (
              <>
                <svg className="animate-spin h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Guardando cambios...</span>
              </>
            ) : (
              <>
                <span>✓</span>
                <span>Guardar Cambios de la Cita</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
