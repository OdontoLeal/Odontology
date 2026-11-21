// src/modules/appointments/ui/components/ActiveConsultationConflictModal.tsx
import React, { useState } from 'react';
import { Modal } from '../../../../shared/ui/components/Modal';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { ClockIcon } from '../../../../shared/ui/components/Icons';

export interface ActiveConsultationConflictData {
  idCita: number;
  idPaciente: number;
  nombrePaciente: string;
  horaInicio: string;
  horaFin: string;
  minutosTranscurridos?: number;
  tiempoExcedido?: boolean;
}

export interface ActiveConsultationConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflictData: ActiveConsultationConflictData;
  newAppointment: {
    idCita: number;
    idPaciente: number;
    patientName: string;
    doctorName?: string;
  };
  onGoToActiveConsultation: (idCita: number, idPaciente: number) => void;
  onConfirmForceCloseAndStartNew: (activeIdCita: number, newIdCita: number) => Promise<void>;
}

export const ActiveConsultationConflictModal: React.FC<ActiveConsultationConflictModalProps> = ({
  isOpen,
  onClose,
  conflictData,
  newAppointment,
  onGoToActiveConsultation,
  onConfirmForceCloseAndStartNew,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleForceClose = async () => {
    setIsSubmitting(true);
    try {
      await onConfirmForceCloseAndStartNew(conflictData.idCita, newAppointment.idCita);
      onClose();
    } catch {
      // El error lo maneja el invoker
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoToPrevious = () => {
    onGoToActiveConsultation(conflictData.idCita, conflictData.idPaciente);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Atención Clínica Previa en Curso"
      subtitle={`Cita activa #${conflictData.idCita} • Dr(a). ${newAppointment.doctorName || 'responsable'}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Banner de advertencia */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[13px] text-[#92400E]">
          <span className="text-lg shrink-0 mt-0.5">⚠️</span>
          <div className="space-y-1">
            <strong className="block font-bold">
              Existe una consulta sin finalizar para este profesional (RF-AGE-009)
            </strong>
            <p className="leading-relaxed">
              De acuerdo con las reglas de atención clínica, un profesional solo puede tener una cita en estado{' '}
              <strong>"En consulta"</strong> a la vez para proteger la trazabilidad de la historia clínica.
            </p>
          </div>
        </div>

        {/* Comparativa visual de consultas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Tarjeta Cita Actual en Curso */}
          <div className="p-3.5 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B]">
                Consulta en Curso
              </span>
              <Badge
                variant={conflictData.tiempoExcedido ? 'danger' : 'warning'}
                label={conflictData.tiempoExcedido ? 'Tiempo Excedido' : 'En Consulta'}
              />
            </div>

            <div>
              <h4 className="font-bold text-[14px] text-[#1E242B]">
                {conflictData.nombrePaciente || 'Paciente en consulta'}
              </h4>
              <p className="text-xs text-[#64748B] flex items-center gap-1.5 mt-1">
                <ClockIcon size={13} color="#D4AF37" className="shrink-0" />
                <span>
                  {conflictData.horaInicio} - {conflictData.horaFin}
                </span>
              </p>
            </div>

            <div className="pt-2 border-t border-[#E2E8F0] text-[11px] text-[#64748B] flex items-center justify-between">
              <span>Tiempo transcurrido:</span>
              <strong className="text-[#1E242B] font-semibold">
                {conflictData.minutosTranscurridos ?? 0} minutos
              </strong>
            </div>
          </div>

          {/* Tarjeta Nueva Cita a Iniciar */}
          <div className="p-3.5 rounded-xl border border-[#D4AF37]/40 bg-[#FFFDF7] flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#D4AF37]">
                Nueva Cita por Iniciar
              </span>
              <Badge variant="info" label="Confirmada" />
            </div>

            <div>
              <h4 className="font-bold text-[14px] text-[#1E242B]">
                {newAppointment.patientName || 'Nuevo paciente'}
              </h4>
              <p className="text-xs text-[#64748B] mt-1">
                Cita identificador #{newAppointment.idCita}
              </p>
            </div>

            <div className="pt-2 border-t border-[#F1E8D2] text-[11px] text-[#8F741E]">
              ℹ️ Se iniciará inmediatamente al confirmar el traspaso.
            </div>
          </div>
        </div>

        {/* Nota explicativa de auditoría */}
        <p className="text-[11px] text-[#64748B] italic">
          💡 Al seleccionar <strong>"Finalizar anterior e Iniciar esta cita"</strong>, la consulta previa pasará a estado <strong>"Atendida"</strong> con reporte de traspaso en la bitácora de auditoría, desbloqueando al profesional de inmediato.
        </p>

        {/* Botones de acción */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-[#E2E8F0]">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleGoToPrevious}
            disabled={isSubmitting}
          >
            Ir a Consulta de {conflictData.nombrePaciente?.split(' ')[0] || 'paciente'}
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleForceClose}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Finalizando e iniciando...' : 'Finalizar anterior e Iniciar esta cita'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
