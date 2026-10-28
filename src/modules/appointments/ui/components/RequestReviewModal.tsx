// src/modules/appointments/ui/components/RequestReviewModal.tsx
import React, { useState } from 'react';
import { Modal } from '../../../../shared/ui/components/Modal';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';

export interface AppointmentRequestDetail {
  idSolicitud: number;
  nombrePaciente: string;
  documentoIdentidad: string;
  telefono: string;
  correo: string;
  fechaSolicitada: string;
  horaSolicitada: string;
  motivoConsulta: string;
  doctorAsignado?: string;
  esPacienteNuevo?: boolean;
}

export interface RequestReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: AppointmentRequestDetail | null;
  onApprove: (idSolicitud: number) => Promise<void> | void;
  onReject: (idSolicitud: number, motivoRechazo: string) => Promise<void> | void;
  isLoading?: boolean;
}

export const RequestReviewModal: React.FC<RequestReviewModalProps> = ({
  isOpen,
  onClose,
  request,
  onApprove,
  onReject,
  isLoading = false,
}) => {
  const [isRejecting, setIsRejecting] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const { showAlert, AlertModalComponent } = useAlertModal();

  if (!request) return null;

  const handleConfirmReject = () => {
    if (!motivoRechazo.trim()) {
      showAlert({
        title: 'Motivo de Rechazo Requerido',
        message: 'Debe ingresar el motivo por el cual se rechaza la solicitud de cita para notificar al solicitante.',
        type: 'warning',
      });
      return;
    }
    onReject(request.idSolicitud, motivoRechazo.trim());
    setIsRejecting(false);
  };

  return (
    <>
      <AlertModalComponent />
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Detalle de Solicitud de Cita</span>
          <Badge label="Pendiente de Aprobación" variant="warning" size="sm" />
        </div>
      }
      subtitle="Revisa la información enviada por el paciente y confirma o rechaza la reserva en la agenda médica."
      maxWidth="3xl"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cerrar
          </Button>
          {!isRejecting ? (
            <>
              <Button
                variant="danger"
                onClick={() => setIsRejecting(true)}
                disabled={isLoading}
              >
                Rechazar Solicitud
              </Button>
              <Button
                variant="primary"
                onClick={() => onApprove(request.idSolicitud)}
                isLoading={isLoading}
                leftIcon={<span>✓</span>}
              >
                Crear cita y Confirmar
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setIsRejecting(false)}>
                Cancelar Rechazo
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmReject}
                isLoading={isLoading}
              >
                Confirmar Rechazo
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Fecha y Horario */}
        <div className="rounded-2xl border border-[#E2E6EA] p-4 bg-[#F8F9FA] grid grid-cols-2 gap-4">
          <div>
            <span className="text-[11px] font-extrabold uppercase text-[#8F99A3]">
              Fecha Solicitada
            </span>
            <p className="text-sm font-extrabold text-[#1E242B] mt-0.5">
              {request.fechaSolicitada}
            </p>
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase text-[#8F99A3]">
              Hora Solicitada
            </span>
            <p className="text-sm font-extrabold text-[#1E242B] mt-0.5">
              {request.horaSolicitada}
            </p>
          </div>
        </div>

        {/* Datos del Paciente */}
        <div className="rounded-2xl border border-[#E2E6EA] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-[#687380]">
              Datos del Paciente
            </span>
            {request.esPacienteNuevo && (
              <Badge label="Paciente Nuevo" variant="info" size="sm" />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[#8F99A3]">Nombre:</span>
              <p className="font-bold text-[#1E242B]">{request.nombrePaciente}</p>
            </div>
            <div>
              <span className="text-[#8F99A3]">Documento:</span>
              <p className="font-bold text-[#1E242B]">{request.documentoIdentidad}</p>
            </div>
            <div>
              <span className="text-[#8F99A3]">Teléfono / WhatsApp:</span>
              <p className="font-bold text-[#1E242B]">+57 {request.telefono}</p>
            </div>
            <div>
              <span className="text-[#8F99A3]">Correo Electrónico:</span>
              <p className="font-bold text-[#1E242B]">{request.correo}</p>
            </div>
          </div>
        </div>

        {/* Motivo de Consulta Registrado */}
        <div className="rounded-2xl border border-[#E2E6EA] p-4 space-y-2">
          <span className="text-xs font-extrabold uppercase text-[#687380]">
            Motivo de Consulta Registrado
          </span>
          <blockquote className="rounded-xl bg-[#FBF6E6]/60 border-l-4 border-[#D4AF37] p-3 text-xs italic text-[#1E242B]">
            &ldquo;{request.motivoConsulta}&rdquo;
          </blockquote>
        </div>

        {/* Impacto de la confirmación */}
        <div className="rounded-2xl bg-[#EEF7FF] border border-[#BFDBFE] p-4 text-xs text-[#1E40AF] flex items-center gap-3">
          <span className="text-lg">ℹ️</span>
          <div>
            <p className="font-bold">Impacto de la confirmación:</p>
            <p className="mt-0.5">
              Al aceptar la solicitud, el bloque horario se reservará automáticamente en la agenda médica y se notificará de inmediato al paciente por correo electrónico. Si es un paciente nuevo, se creará su ficha con estado &ldquo;Datos incompletos&rdquo; (RF-AGE-005).
            </p>
          </div>
        </div>

        {/* Campo de Rechazo si está activo */}
        {isRejecting && (
          <div className="rounded-2xl border border-[#DC2626] bg-[#FEF2F2] p-4 space-y-2">
            <label className="block text-xs font-extrabold text-[#DC2626] uppercase">
              Motivo del Rechazo de la Solicitud <span className="text-[#DC2626]">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Indique al paciente el motivo por el cual no es posible atender la solicitud en este horario..."
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              className="w-full rounded-xl border border-[#DC2626]/40 p-2.5 text-xs text-[#1E242B] focus:outline-none"
            />
          </div>
        )}
      </div>
    </Modal>
    </>
  );
};
