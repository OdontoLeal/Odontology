// src/modules/appointments/ui/components/AppointmentDetailModal.tsx
import React, { useState } from 'react';
import { Modal } from '../../../../shared/ui/components/Modal';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';

export interface AppointmentDetailData {
  idCita: number;
  idPaciente: number;
  nombrePaciente: string;
  documentoIdentidad: string;
  telefono: string;
  correo: string;
  motivo: string;
  descripcion?: string;
  doctorNombre: string;
  idDoctor: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  sillon?: string;
  estado:
    | 'Confirmada'
    | 'En consulta'
    | 'En espera'
    | 'Completada'
    | 'Cancelada'
    | 'No asistió';
  consentimientos?: Array<{
    id: number;
    titulo: string;
    firmado: boolean;
  }>;
}

export interface AppointmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentDetailData | null;
  onStartAttention: (idCita: number) => void;
  onEndAttention: (idCita: number) => void;
  onOpenEvolution: (appointment: AppointmentDetailData) => void;
  onEditAppointment: (appointment: AppointmentDetailData) => void;
  onMarkNoShow: (idCita: number, motivo: string) => Promise<void> | void;
  onCancelAppointment: (idCita: number, motivo: string) => Promise<void> | void;
  onSignConsent: (idConsentimiento: number) => void;
  isLoading?: boolean;
}

export const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  isOpen,
  onClose,
  appointment,
  onStartAttention,
  onEndAttention,
  onOpenEvolution,
  onEditAppointment,
  onMarkNoShow,
  onCancelAppointment,
  onSignConsent,
  isLoading = false,
}) => {
  const [cancelReasonPrompt, setCancelReasonPrompt] = useState(false);
  const [noShowReasonPrompt, setNoShowReasonPrompt] = useState(false);
  const [reasonInput, setReasonInput] = useState('');
  const { showAlert, AlertModalComponent } = useAlertModal();

  if (!appointment) return null;

  const isConfirmed = appointment.estado === 'Confirmada';
  const isInConsultation = appointment.estado === 'En consulta';

  const handleConfirmCancel = () => {
    if (!reasonInput.trim()) {
      showAlert({
        title: 'Motivo Requerido',
        message: 'Debe ingresar el motivo de cancelación de la cita médica.',
        type: 'warning',
      });
      return;
    }
    onCancelAppointment(appointment.idCita, reasonInput.trim());
    setCancelReasonPrompt(false);
    setReasonInput('');
  };

  const handleConfirmNoShow = () => {
    if (!reasonInput.trim()) {
      showAlert({
        title: 'Justificación Requerida',
        message: 'Debe indicar la justificación o causa de la inasistencia del paciente.',
        type: 'warning',
      });
      return;
    }
    onMarkNoShow(appointment.idCita, reasonInput.trim());
    setNoShowReasonPrompt(false);
    setReasonInput('');
  };

  return (
    <>
      <AlertModalComponent />
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <span>{appointment.motivo}</span>
          <Badge
            label={appointment.estado}
            variant={
              appointment.estado === 'Completada'
                ? 'success'
                : appointment.estado === 'En consulta'
                ? 'gold'
                : appointment.estado === 'Confirmada'
                ? 'info'
                : 'neutral'
            }
          />
        </div>
      }
      subtitle={`📅 ${appointment.fecha} • ${appointment.horaInicio} - ${appointment.horaFin} • Sillón: ${appointment.sillon || 'Gabinete 02'}`}
      maxWidth="4xl"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>

          {isConfirmed && !cancelReasonPrompt && !noShowReasonPrompt && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setReasonInput('');
                  setCancelReasonPrompt(true);
                }}
              >
                Cancelar Cita
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setReasonInput('El paciente no se presentó ni notificó cancelación previa.');
                  setNoShowReasonPrompt(true);
                }}
              >
                Marcar Inasistencia
              </Button>
              <Button
                variant="outline"
                onClick={() => onEditAppointment(appointment)}
              >
                Editar Cita
              </Button>
              <Button
                variant="primary"
                onClick={() => onStartAttention(appointment.idCita)}
                leftIcon={<span>🩺</span>}
              >
                Iniciar Cita
              </Button>
            </>
          )}

          {isInConsultation && (
            <>
              <Button
                variant="primary"
                onClick={() => onOpenEvolution(appointment)}
                leftIcon={<span>📝</span>}
              >
                Redactar Evolución y Odontograma
              </Button>
              <Button
                variant="secondary"
                onClick={() => onEndAttention(appointment.idCita)}
                leftIcon={<span>🏁</span>}
              >
                Terminar Cita
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Descripción clínica de la cita */}
        {appointment.descripcion && (
          <div className="rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] p-4 text-xs text-[#4B5563]">
            <span className="font-extrabold text-[#1E242B] block mb-1">
              Descripción y Observaciones Clínicas:
            </span>
            {appointment.descripcion}
            <div className="mt-2 text-[#8F99A3]">
              👨‍⚕️ Profesional a cargo: <strong className="text-[#1E242B]">{appointment.doctorNombre}</strong>
            </div>
          </div>
        )}

        {/* Prompt para Cancelación */}
        {cancelReasonPrompt && (
          <div className="rounded-2xl border border-[#DC2626] bg-[#FEF2F2] p-4 space-y-3">
            <h4 className="text-xs font-extrabold text-[#DC2626] uppercase">
              Confirmar Cancelación de la Cita
            </h4>
            <p className="text-xs text-[#687380]">
              Indique el motivo por el cual se cancela la cita médica. Se notificará al paciente por correo.
            </p>
            <input
              type="text"
              placeholder="Motivo de la cancelación..."
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              className="w-full rounded-xl border border-[#E2E6EA] p-2.5 text-xs text-[#1E242B] bg-white"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setCancelReasonPrompt(false)}>
                Regresar
              </Button>
              <Button size="sm" variant="danger" onClick={handleConfirmCancel}>
                Confirmar Cancelación
              </Button>
            </div>
          </div>
        )}

        {/* Prompt para Inasistencia */}
        {noShowReasonPrompt && (
          <div className="rounded-2xl border border-[#DC2626] bg-[#FEF2F2] p-4 space-y-3">
            <h4 className="text-xs font-extrabold text-[#DC2626] uppercase">
              Registrar Inasistencia (No Asistió)
            </h4>
            <p className="text-xs text-[#687380]">
              Conforme a RF-AGE-013, la inasistencia quedará registrada en el historial cronológico del paciente y los bloques de tiempo NO serán liberados para preservar la auditoría médica.
            </p>
            <input
              type="text"
              placeholder="Justificación de la inasistencia..."
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              className="w-full rounded-xl border border-[#E2E6EA] p-2.5 text-xs text-[#1E242B] bg-white"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setNoShowReasonPrompt(false)}>
                Regresar
              </Button>
              <Button size="sm" variant="danger" onClick={handleConfirmNoShow}>
                Guardar Inasistencia
              </Button>
            </div>
          </div>
        )}

        {/* Información del Paciente (Page 12) */}
        <div className="rounded-2xl border border-[#E2E6EA] p-4 space-y-2">
          <span className="text-xs font-extrabold uppercase text-[#687380]">
            Información del Paciente
          </span>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-[#1E242B] text-[#D4AF37] font-bold flex items-center justify-center flex-shrink-0">
              {appointment.nombrePaciente
                .split(' ')
                .slice(0, 2)
                .map((w) => w[0])
                .join('')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 text-xs">
              <div>
                <span className="text-[#8F99A3]">Nombre:</span>
                <p className="font-extrabold text-[#1E242B]">{appointment.nombrePaciente}</p>
              </div>
              <div>
                <span className="text-[#8F99A3]">Teléfono:</span>
                <p className="font-bold text-[#1E242B]">+57 {appointment.telefono}</p>
              </div>
              <div>
                <span className="text-[#8F99A3]">Correo:</span>
                <p className="font-bold text-[#1E242B]">{appointment.correo}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Consentimientos Informados (Page 12) */}
        <div className="rounded-2xl border border-[#E2E6EA] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">✍️</span>
              <span className="text-xs font-extrabold uppercase text-[#1E242B]">
                Consentimientos Informados
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {(appointment.consentimientos || [
              {
                id: 1,
                titulo: 'Consentimiento para Cirugía de Implante Dental y Regeneración Ósea',
                firmado: false,
              },
              {
                id: 2,
                titulo: 'Consentimiento Informado para Anestesia Local y Sedación Consciente',
                firmado: false,
              },
              {
                id: 3,
                titulo: 'Consentimiento General de Tratamiento Odontológico y Diagnóstico 3D',
                firmado: true,
              },
            ]).map((cons) => (
              <div
                key={cons.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA] text-xs"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    label={cons.firmado ? 'Firmado digitalmente' : 'Sin firmar'}
                    variant={cons.firmado ? 'success' : 'warning'}
                    size="sm"
                  />
                  <span className="font-bold text-[#1E242B]">{cons.titulo}</span>
                </div>
                <div className="flex items-center gap-2">
                  {!cons.firmado && (
                    <button
                      type="button"
                      onClick={() => onSignConsent(cons.id)}
                      className="text-xs font-bold text-[#D4AF37] hover:underline"
                    >
                      Firmar 📱
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onSignConsent(cons.id)}
                    className="text-xs text-[#687380] hover:underline"
                  >
                    Consultar →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
    </>
  );
};
