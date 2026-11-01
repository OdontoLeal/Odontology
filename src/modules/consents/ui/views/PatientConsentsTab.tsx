// src/modules/consents/ui/views/PatientConsentsTab.tsx
import React, { useState, useEffect } from 'react';
import { useConsents, PatientConsentItem, ConsentTemplateItem } from '../hooks/useConsents';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { Modal } from '../../../../shared/ui/components/Modal';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';

export interface PatientConsentsTabProps {
  idPaciente: number;
  patientName: string;
  documentoPaciente?: string;
  doctorName?: string;
  isMinor?: boolean;
  onOpenTabletSigningView?: (template: ConsentTemplateItem) => void;
}

export const PatientConsentsTab: React.FC<PatientConsentsTabProps> = ({
  idPaciente,
  patientName,
  documentoPaciente = '',
  doctorName = 'Dr. Eduar Leal Álvarez',
  isMinor = false,
  onOpenTabletSigningView,
}) => {
  const {
    templates,
    patientConsents,
    fetchPatientConsents,
    downloadConsentPdf,
    isLoading,
  } = useConsents();
  const { showAlert, AlertModalComponent } = useAlertModal();

  const [viewingPdfConsent, setViewingPdfConsent] = useState<PatientConsentItem | null>(null);
  const [isSelectTemplateModalOpen, setIsSelectTemplateModalOpen] = useState(false);

  useEffect(() => {
    fetchPatientConsents(idPaciente);
  }, [idPaciente, fetchPatientConsents]);

  const handleSelectTemplateToSign = (tpl: ConsentTemplateItem) => {
    // RF-CON-001: Si el paciente ya firmó esa plantilla en su versión vigente, rechazar
    const alreadySigned = patientConsents.find(
      (c) => c.idPlantilla === tpl.idPlantilla && c.version === tpl.version
    );

    if (alreadySigned) {
      showAlert({
        title: 'Consentimiento ya Firmado',
        message: `El paciente ya firmó este consentimiento el ${alreadySigned.fechaFirma || 'previamente'} en su versión vigente (v${tpl.version}.0).`,
        type: 'warning',
      });
      return;
    }

    setIsSelectTemplateModalOpen(false);
    if (onOpenTabletSigningView) {
      onOpenTabletSigningView(tpl);
    }
  };

  const handleDownloadPdf = async (consent: PatientConsentItem) => {
    if (!consent.idConsentimientoFirmado) return;
    try {
      await downloadConsentPdf(
        consent.idConsentimientoFirmado,
        `Consentimiento_${consent.titulo.replace(/\s+/g, '_')}_v${consent.version}.pdf`
      );
    } catch (err: any) {
      showAlert({
        title: 'Error al Generar PDF',
        message: err.message || 'No se pudo generar el documento PDF en memoria.',
        type: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      <AlertModalComponent />
      {/* Header con botón para suscribir consentimiento */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-extrabold text-[#1E242B]">
            Consentimientos Informados del Paciente (RF-CON-001 a RF-CON-005)
          </h3>
          <p className="text-xs text-[#8F99A3]">
            Suscripción digital médico-legal sin cita ni almacenamiento externo de archivos.
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsSelectTemplateModalOpen(true)}
          leftIcon={<span>✍️</span>}
        >
          Tomar Consentimiento
        </Button>
      </div>

      {/* Lista de Consentimientos Firmados */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-4 rounded-2xl bg-[#F8F9FA] text-center text-xs text-[#687380]">
            Cargando consentimientos...
          </div>
        ) : patientConsents.length > 0 ? (
          patientConsents.map((c) => (
            <div
              key={c.idConsentimientoFirmado || c.idConsentimiento}
              className="rounded-2xl border border-[#E2E6EA] bg-white p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge label={`v${c.version}.0`} variant="neutral" size="sm" />
                  <Badge label="Firmado" variant="success" size="sm" />
                  <h4 className="text-sm font-extrabold text-[#1E242B]">
                    {c.titulo}
                  </h4>
                </div>
                <p className="text-xs text-[#687380]">
                  Firmado el: <strong>{c.fechaFirma}</strong> por {c.firmadoPor} ({c.rolFirmante})
                  {c.diligenciadoPor && ` • Diligenciado por: ${c.diligenciadoPor}`}
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setViewingPdfConsent(c)}
                  leftIcon={<span>👁️</span>}
                >
                  Ver Detalle
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleDownloadPdf(c)}
                  leftIcon={<span>📄</span>}
                >
                  Descargar PDF
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 rounded-2xl border border-dashed border-[#CBD2D9] text-center text-xs text-[#8F99A3]">
            El paciente no tiene consentimientos registrados.
          </div>
        )}
      </div>

      {/* Modal Visor de Documento en Memoria (RF-CON-003) */}
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
            {viewingPdfConsent?.idConsentimientoFirmado && (
              <Button
                variant="primary"
                onClick={() => viewingPdfConsent && handleDownloadPdf(viewingPdfConsent)}
                leftIcon={<span>📄</span>}
              >
                Descargar Certificado PDF
              </Button>
            )}
          </div>
        }
      >
        <div className="rounded-2xl border border-[#CBD2D9] bg-[#F8F9FA] p-6 space-y-6 text-xs leading-relaxed text-[#1E242B]">
          <div className="text-center pb-4 border-b border-[#E2E6EA]">
            <span className="font-extrabold text-[#D4AF37] uppercase tracking-wider block">
              Consultorio Odontológico Dr. Eduar Leal Álvarez
            </span>
            <h3 className="text-base font-extrabold mt-1">{viewingPdfConsent?.titulo}</h3>
            <span className="text-[11px] text-[#8F99A3]">Versión suscripta v{viewingPdfConsent?.version}.0</span>
          </div>

          <div className="rounded-xl bg-white border border-[#E2E6EA] p-4 text-xs leading-relaxed text-[#4B5563]">
            <p className="whitespace-pre-line">
              {viewingPdfConsent?.textoFirmado ||
                'Texto del consentimiento informado aceptado libre y voluntariamente por el paciente o su acudiente legal.'}
            </p>
          </div>

          {/* Firma manuscrita en base64 fusionada */}
          <div className="pt-6 border-t border-[#E2E6EA] flex justify-between items-end">
            <div>
              {viewingPdfConsent?.firmaBase64 ? (
                <img
                  src={viewingPdfConsent.firmaBase64}
                  alt="Firma del Titular"
                  className="h-16 max-w-[200px] object-contain border-b border-black"
                />
              ) : (
                <div className="h-14 border-b border-black w-48 flex items-center justify-center font-serif italic text-base">
                  {viewingPdfConsent?.firmadoPor}
                </div>
              )}
              <p className="text-[11px] font-bold mt-1">
                {viewingPdfConsent?.firmaPorAcudiente
                  ? `Firma del acudiente / representante legal: ${viewingPdfConsent.nombreDocumentoAcudiente}`
                  : `Firma del paciente: ${patientName}`}
              </p>
              <p className="text-[10px] text-[#8F99A3]">{viewingPdfConsent?.fechaFirma}</p>
            </div>

            <div className="text-right">
              <div className="h-14 border-b border-black w-48 flex items-center justify-center font-serif italic text-base">
                {doctorName}
              </div>
              <p className="text-[11px] font-bold mt-1">{doctorName}</p>
              <p className="text-[10px] text-[#8F99A3]">Odontólogo Responsable</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Seleccionar Plantilla para Tomar Consentimiento (RF-CON-001) */}
      <Modal
        isOpen={isSelectTemplateModalOpen}
        onClose={() => setIsSelectTemplateModalOpen(false)}
        title="Seleccionar Consentimiento Informado"
        subtitle="Elija la plantilla de consentimiento activa para proceder a su lectura y suscripción."
        maxWidth="md"
      >
        <div className="space-y-2">
          {templates
            .filter((t) => t.activo)
            .map((tpl) => {
              const alreadySigned = patientConsents.find(
                (c) => c.idPlantilla === tpl.idPlantilla && c.version === tpl.version
              );

              return (
                <button
                  key={tpl.idPlantilla}
                  type="button"
                  onClick={() => handleSelectTemplateToSign(tpl)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    alreadySigned
                      ? 'border-[#E2E6EA] bg-[#F8F9FA] opacity-75 cursor-not-allowed'
                      : 'border-[#E2E6EA] hover:border-[#D4AF37] hover:bg-[#FBF6E6]/40 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1E242B]">{tpl.titulo}</span>
                    <Badge label={`v${tpl.version}.0`} variant="neutral" size="sm" />
                  </div>
                  {alreadySigned && (
                    <p className="text-[11px] text-[#137333] font-semibold mt-1">
                      ✓ Ya firmado el {alreadySigned.fechaFirma}
                    </p>
                  )}
                </button>
              );
            })}

          {templates.filter((t) => t.activo).length === 0 && (
            <div className="text-center py-6 px-4 space-y-2 bg-[#F8F9FA] rounded-2xl border border-[#E2E6EA]">
              <div className="text-2xl" aria-hidden="true">📋</div>
              <p className="text-xs font-bold text-[#1E242B]">
                No hay plantillas de consentimientos activas en la base de datos
              </p>
              <p className="text-[11px] text-[#687380] leading-relaxed">
                Un usuario con rol Administrador debe registrar o activar plantillas en el módulo de Consentimientos Informados para poder suscribirlas con el paciente (RF-CON-001).
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
