// src/modules/appointments/ui/components/EditAppointmentModal.tsx
import React, { useState } from 'react';
import { Modal } from '../../../../shared/ui/components/Modal';
import { Button } from '../../../../shared/ui/components/Button';
import { AppointmentDetailData } from './AppointmentDetailModal';
import { DoctorCandidate } from './QuickScheduleModal';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';

export interface EditAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentDetailData | null;
  doctors: DoctorCandidate[];
  onSaveReschedule: (appointmentId: number, changes: {
    fecha: string;
    bloques: string[];
    idDoctor: number;
    motivo: string;
  }) => Promise<void> | void;
  isLoading?: boolean;
}

export const EditAppointmentModal: React.FC<EditAppointmentModalProps> = ({
  isOpen,
  onClose,
  appointment,
  doctors,
  onSaveReschedule,
  isLoading = false,
}) => {
  if (!appointment) return null;

  const [fecha, setFecha] = useState(appointment.fecha);
  const [selectedDoctorId, setSelectedDoctorId] = useState(appointment.idDoctor);
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([
    `${appointment.horaInicio}-${appointment.horaFin}`,
  ]);
  const [motivo, setMotivo] = useState(appointment.motivo);

  const availableBlocks = [
    '08:00-08:30',
    '08:30-09:00',
    '09:00-09:30',
    '10:00-10:30',
    '14:00-14:30',
    '14:30-15:00',
    '15:00-15:30',
    '16:00-16:30',
  ];

  const toggleBlock = (b: string) => {
    setSelectedBlocks((prev) =>
      prev.includes(b) ? prev.filter((item) => item !== b) : [...prev, b].sort()
    );
  };

  const { showAlert, AlertModalComponent } = useAlertModal();

  const handleSave = () => {
    if (selectedBlocks.length === 0) {
      showAlert({
        title: 'Bloque Requerido',
        message: 'Debe seleccionar al menos un bloque de horario para reprogramar la cita médica.',
        type: 'warning',
      });
      return;
    }
    onSaveReschedule(appointment.idCita, {
      fecha,
      bloques: selectedBlocks,
      idDoctor: selectedDoctorId,
      motivo,
    });
  };

  return (
    <>
      <AlertModalComponent />
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Editar Cita #D-RCT-${appointment.idCita}`}
      subtitle="Modifica los datos de la cita, reprograma la fecha y horario o reasigna el doctor a cargo."
      maxWidth="4xl"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Volver
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={isLoading}
            leftIcon={<span>💾</span>}
          >
            Guardar Cambios
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Comparativa de Reprogramación (Page 14) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[#CBD2D9] bg-[#F8F9FA] p-4 space-y-1">
            <span className="text-[11px] font-extrabold uppercase text-[#8F99A3]">
              Fecha y Hora Actual
            </span>
            <p className="text-sm font-extrabold text-[#1E242B]">
              {appointment.fecha} • {appointment.horaInicio} - {appointment.horaFin}
            </p>
            <p className="text-xs text-[#687380]">{appointment.doctorNombre}</p>
          </div>

          <div className="rounded-2xl border-2 border-[#D4AF37] bg-[#FBF6E6]/60 p-4 space-y-1">
            <span className="text-[11px] font-extrabold uppercase text-[#D4AF37]">
              Nueva Fecha y Hora Seleccionada
            </span>
            <p className="text-sm font-extrabold text-[#1E242B]">
              {fecha} • {selectedBlocks.join(', ') || 'Sin bloques seleccionados'}
            </p>
            <p className="text-xs text-[#8F721A]">
              {selectedBlocks.length * 30} min total ({selectedBlocks.length} bloques contiguos)
            </p>
          </div>
        </div>

        {/* Doctor y Motivo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-1.5">
              Doctor / Profesional Responsable
            </label>
            <select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(Number(e.target.value))}
              className="w-full min-h-[44px] rounded-xl border border-[#E2E6EA] bg-white px-3.5 py-2 text-sm text-[#1E242B]"
            >
              {doctors.map((d) => (
                <option key={d.idUsuario} value={d.idUsuario}>
                  {d.nombreCompleto} ({d.especialidad})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-1.5">
              Fecha para la Reprogramación
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#E2E6EA] px-3.5 py-2 text-sm font-semibold"
            />
          </div>
        </div>

        {/* Selección de Nuevos Bloques */}
        <div className="space-y-3">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380]">
            Seleccione Nuevos Bloques Horarios Disponibles
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {availableBlocks.map((b, idx) => {
              const isSelected = selectedBlocks.includes(b);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleBlock(b)}
                  className={`min-h-[44px] rounded-xl border text-xs font-bold p-2.5 transition-all text-center ${
                    isSelected
                      ? 'border-[#D4AF37] bg-[#FBF6E6] ring-2 ring-[#D4AF37]/50 shadow-xs'
                      : 'border-[#E2E6EA] bg-white text-[#687380] hover:border-[#CBD2D9]'
                  }`}
                >
                  {b}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
    </>
  );
};
