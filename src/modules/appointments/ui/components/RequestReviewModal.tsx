// src/modules/appointments/ui/components/RequestReviewModal.tsx
import React, { useState } from 'react';
import { formatLongDateCO, formatTimeCO } from '../../../../shared/ui/format';
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
  existingPatientContact?: {
    telefono?: string;
    correo?: string;
  };
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
  const { showAlert, showConfirm, AlertModalComponent } = useAlertModal();

  if (!request) return null;

  const hasDifferingContact = Boolean(
    request.existingPatientContact &&
      ((request.existingPatientContact.telefono &&
        request.existingPatientContact.telefono.trim() !== request.telefono.trim()) ||
        (request.existingPatientContact.correo &&
          request.existingPatientContact.correo.trim().toLowerCase() !==
            request.correo.trim().toLowerCase()))
  );

  const handleApproveWithValidation = () => {
    if (hasDifferingContact && request.existingPatientContact) {
      showConfirm({
        title: 'Confirmar Cita con Datos de Contacto Diferentes',
        confirmText: 'Sí, confirmar cita',
        cancelText: 'Revisar',
        children: (
          <div className="space-y-2 text-xs sm:text-sm text-[#4B5563]">
            <p>
              El paciente ya existe en el directorio pero sus datos de contacto en la solicitud difieren de los registrados:
            </p>
            <div className="rounded-xl border border-[#D4AF37]/30 bg-[#FEFCE8] p-3 text-xs space-y-1">
              <p>
                <strong>Ficha actual:</strong> Tel: {request.existingPatientContact.telefono || 'Sin tel'} · Email: {request.existingPatientContact.correo || 'Sin email'}
              </p>
              <p className="text-[#15803D]">
                <strong>En solicitud:</strong> Tel: {request.telefono} · Email: {request.correo}
              </p>
            </div>
            <p className="text-xs text-[#64748B]">
              ¿Desea confirmar la cita médica de todos modos?
            </p>
          </div>
        ),
        onConfirm: () => {
          onApprove(request.idSolicitud);
        },
      });
      return;
    }
    onApprove(request.idSolicitud);
  };

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
                  onClick={handleApproveWithValidation}
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
              <span className="text-[13px] font-extrabold uppercase text-[#8F99A3]">
                Fecha Solicitada
              </span>
              <p className="text-sm font-extrabold text-[#1E242B] mt-0.5">
                {formatLongDateCO(request.fechaSolicitada)}
              </p>
            </div>
            <div>
              <span className="text-[13px] font-extrabold uppercase text-[#8F99A3]">
                Hora Solicitada
              </span>
              <p className="text-sm font-extrabold text-[#1E242B] mt-0.5">
                {formatTimeCO(request.horaSolicitada)}
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
                <span className="text-[#8F99A3]">Teléfono:</span>
                <p className="font-bold text-[#1E242B]">+57 {request.telefono}</p>
              </div>
              <div>
                <span className="text-[#8F99A3]">Correo Electrónico:</span>
                <p className="font-bold text-[#1E242B]">{request.correo}</p>
              </div>
            </div>

            {/* Alerta de datos de contacto discrepantes si el paciente ya existe en el directorio */}
            {hasDifferingContact && request.existingPatientContact && (
              <div className="rounded-xl border border-[#D4AF37]/40 bg-[#FEFCE8] p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-[#B59428]">
                  <span>⚠</span>
                  <span>Diferencia en datos de contacto detectada</span>
                </div>
                <p className="text-[#4B5563]">
                  El documento de identidad corresponde a un paciente registrado pero con datos de contacto distintos:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-lg bg-white/80 border border-[#E5E7EB] text-[11px]">
                  <div>
                    <span className="text-[#64748B] block font-bold">En Ficha Clínica:</span>
                    <span>Tel: {request.existingPatientContact.telefono || 'Sin registrar'}</span><br />
                    <span>Email: {request.existingPatientContact.correo || 'Sin registrar'}</span>
                  </div>
                  <div>
                    <span className="text-[#15803D] block font-bold">En esta Solicitud:</span>
                    <span className="font-semibold text-[#1F2937]">Tel: {request.telefono}</span><br />
                    <span className="font-semibold text-[#1F2937]">Email: {request.correo}</span>
                  </div>
                </div>
              </div>
            )}
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
                placeholder="Escribe el motivo por el cual no se puede atender esta cita en la fecha u horario solicitados..."
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                className="w-full rounded-xl border border-[#E2E6EA] p-2.5 text-xs text-[#1E242B] bg-white focus:outline-none focus:border-[#DC2626]"
              />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
