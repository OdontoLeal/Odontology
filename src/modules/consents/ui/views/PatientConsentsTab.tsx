// src/modules/consents/ui/views/PatientConsentsTab.tsx
import React, { useState, useEffect } from 'react';
import { useConsents, PatientConsentItem } from '../hooks/useConsents';
import { QrCodeTabletModal } from '../components/QrCodeTabletModal';
import { GuardianConfirmationModal } from '../components/GuardianConfirmationModal';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { Modal } from '../../../../shared/ui/components/Modal';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';

export interface PatientConsentsTabProps {
  idPaciente: number;
  patientName: string;
  doctorName?: string;
  isMinor?: boolean;
  onOpenTabletSigningView?: (consentItem: PatientConsentItem) => void;
}

export const PatientConsentsTab: React.FC<PatientConsentsTabProps> = ({
  idPaciente,
  patientName,
  doctorName = 'Dr. Eduar Leal Álvarez',
  isMinor = false,
  onOpenTabletSigningView,
}) => {
  const { templates, patientConsents, fetchPatientConsents, signConsent } = useConsents();
  const { showAlert, AlertModalComponent } = useAlertModal();

  const [selectedConsentForQR, setSelectedConsentForQR] = useState<PatientConsentItem | null>(null);
  const [selectedConsentForGuardian, setSelectedConsentForGuardian] = useState<PatientConsentItem | null>(null);
  const [viewingPdfConsent, setViewingPdfConsent] = useState<PatientConsentItem | null>(null);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);

  useEffect(() => {
    fetchPatientConsents(idPaciente);
  }, [idPaciente, fetchPatientConsents]);

  const handleStartSignatureFlow = (consent: PatientConsentItem) => {
    if (isMinor) {
      setSelectedConsentForGuardian(consent);
    } else {
      setSelectedConsentForQR(consent);
    }
  };

  return (
    <div className="space-y-6">
      <AlertModalComponent />
      {/* Header con botón para vincular consentimiento */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-extrabold text-[#1E242B]">
            Consentimientos Informados del Paciente
          </h3>
          <p className="text-xs text-[#8F99A3]">
            Suscripción digital médico-legal conforme a la Resolución 1995 de 1999.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsAttachModalOpen(true)}
          leftIcon={<span>+</span>}
        >
          Vincular Nuevo Consentimiento
        </Button>
      </div>

      {/* Lista de Consentimientos */}
      <div className="space-y-3">
        {patientConsents.map((c) => {
          const isSigned = c.estado === 'Firmado';

          return (
            <div
              key={c.idConsentimiento}
              className="rounded-2xl border border-[#E2E6EA] bg-white p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge label={`v${c.version}.0`} variant="neutral" size="sm" />
                  <Badge
                    label={c.estado}
                    variant={isSigned ? 'success' : 'warning'}
                    size="sm"
                  />
                  <h4 className="text-sm font-extrabold text-[#1E242B]">
                    {c.titulo}
                  </h4>
                </div>
                {isSigned && (
                  <p className="text-xs text-[#687380]">
                    Firmado el: <strong>{c.fechaFirma}</strong> por {c.firmadoPor} ({c.rolFirmante})
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {!isSigned ? (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleStartSignatureFlow(c)}
                    leftIcon={<span>📱</span>}
                  >
                    Firmar en Tablet
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setViewingPdfConsent(c)}
                    leftIcon={<span>📄</span>}
                  >
                    Consultar PDF
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal QR para Tablet */}
      <QrCodeTabletModal
        isOpen={Boolean(selectedConsentForQR)}
        onClose={() => setSelectedConsentForQR(null)}
        consentTitle={selectedConsentForQR?.titulo || ''}
        patientName={patientName}
        signingUrl={`/tablet-sign/${selectedConsentForQR?.idConsentimiento}`}
        onOpenDirectly={() => {
          if (selectedConsentForQR && onOpenTabletSigningView) {
            onOpenTabletSigningView(selectedConsentForQR);
            setSelectedConsentForQR(null);
          }
        }}
      />

      {/* Modal Confirmación de Acudiente en Menores */}
      <GuardianConfirmationModal
        isOpen={Boolean(selectedConsentForGuardian)}
        onClose={() => setSelectedConsentForGuardian(null)}
        patientName={patientName}
        onConfirmGuardian={(guardianData) => {
          const target = selectedConsentForGuardian;
          setSelectedConsentForGuardian(null);
          if (target) {
            setSelectedConsentForQR(target);
          }
        }}
      />

      {/* Modal Visor de Documento PDF */}
      <Modal
        isOpen={Boolean(viewingPdfConsent)}
        onClose={() => setViewingPdfConsent(null)}
        title={viewingPdfConsent?.titulo}
        subtitle={`Suscrito digitalmente por ${viewingPdfConsent?.firmadoPor} (${viewingPdfConsent?.fechaFirma})`}
        maxWidth="3xl"
        footer={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setViewingPdfConsent(null)}>
              Cerrar
            </Button>
            <Button variant="primary" onClick={() => window.print()} leftIcon={<span>🖨️</span>}>
              Imprimir Certificado
            </Button>
          </div>
        }
      >
        <div className="rounded-2xl border border-[#CBD2D9] bg-[#F8F9FA] p-6 space-y-6 text-xs leading-relaxed text-[#1E242B]">
          <div className="text-center pb-4 border-b border-[#E2E6EA]">
            <span className="font-extrabold text-[#D4AF37] uppercase tracking-wider block">
              Consultorio Odontológico Dr. Eduar Leal Álvarez
            </span>
            <h3 className="text-base font-extrabold mt-1">{viewingPdfConsent?.titulo}</h3>
            <span className="text-[11px] text-[#8F99A3]">Documento Clínico Cifrado (AES-256)</span>
          </div>

          <p>
            Certifico que el paciente <strong>{patientName}</strong> o su acudiente autorizado ha revisado las pautas de este procedimiento médico, aceptando los términos y riesgos informados.
          </p>

          {/* Firma renderizada */}
          <div className="pt-6 border-t border-[#E2E6EA] flex justify-between items-end">
            <div>
              <div className="h-14 border-b border-black w-48 flex items-center justify-center font-serif italic text-base">
                {viewingPdfConsent?.firmadoPor}
              </div>
              <p className="text-[11px] font-bold mt-1">Firma del Titular / Acudiente</p>
              <p className="text-[10px] text-[#8F99A3]">{viewingPdfConsent?.fechaFirma}</p>
            </div>

            <div className="text-right">
              <div className="h-14 border-b border-black w-48 flex items-center justify-center font-serif italic text-base">
                {doctorName}
              </div>
              <p className="text-[11px] font-bold mt-1">{doctorName}</p>
              <p className="text-[10px] text-[#8F99A3]">Director Odontológico • OdontoLeal</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Vincular Nuevo Consentimiento */}
      <Modal
        isOpen={isAttachModalOpen}
        onClose={() => setIsAttachModalOpen(false)}
        title="Vincular Consentimiento Informado"
        subtitle="Seleccione una plantilla médica activa para anexar a la consulta."
        maxWidth="md"
      >
        <div className="space-y-2">
          {templates.map((tpl) => (
            <button
              key={tpl.idPlantilla}
              type="button"
              onClick={() => {
                showAlert({
                  title: 'Consentimiento Vinculado',
                  message: `El consentimiento informado "${tpl.titulo}" ha sido anexado a la consulta del paciente.`,
                  type: 'success',
                });
                setIsAttachModalOpen(false);
              }}
              className="w-full text-left p-3 rounded-xl border border-[#E2E6EA] hover:border-[#D4AF37] hover:bg-[#FBF6E6]/40 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1E242B]">{tpl.titulo}</span>
                <Badge label={`v${tpl.version}.0`} variant="neutral" size="sm" />
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
};
