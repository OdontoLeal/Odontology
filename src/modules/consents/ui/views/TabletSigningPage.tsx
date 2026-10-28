// src/modules/consents/ui/views/TabletSigningPage.tsx
import React, { useState } from 'react';
import { SignaturePadCanvas } from '../components/SignaturePadCanvas';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';

export interface TabletSigningPageProps {
  tituloConsentimiento?: string;
  cuerpoTexto?: string;
  nombrePaciente?: string;
  documentoPaciente?: string;
  onConsentSigned?: (signatureBase64: string) => void;
  onConsentRejected?: (motivo: string) => void;
  onExit?: () => void;
}

export const TabletSigningPage: React.FC<TabletSigningPageProps> = ({
  tituloConsentimiento = 'Consentimiento Informado para Procedimiento Quirúrgico Odontológico',
  cuerpoTexto = 'Por medio del presente documento, manifiesto libre y voluntariamente que he sido ampliamente informado(a) por el profesional tratante sobre el diagnóstico clínico, los objetivos del procedimiento, los riesgos inherentes y las posibles complicaciones. Declaro haber tenido la oportunidad de formular preguntas y que todas mis dudas han sido resueltas a satisfacción. Autorizo al equipo médico de OdontoLeal para la realización del tratamiento acordado.',
  nombrePaciente = 'Paciente Titular',
  documentoPaciente = '',
  onConsentSigned,
  onConsentRejected,
  onExit,
}) => {
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const { showAlert, AlertModalComponent } = useAlertModal();

  const handleFinishSigning = () => {
    if (!signatureData) {
      showAlert({
        title: 'Firma Requerida',
        message: 'Por favor capture su firma manuscrita en el recuadro inferior antes de continuar.',
        type: 'warning',
      });
      return;
    }
    if (!hasAcceptedTerms) {
      showAlert({
        title: 'Aceptación Requerida',
        message: 'Debe marcar la casilla de confirmación y aceptación de los términos leídos.',
        type: 'warning',
      });
      return;
    }
    onConsentSigned?.(signatureData);
    setIsSuccess(true);
  };

  const handleFinishReject = () => {
    if (!rejectReason.trim()) {
      showAlert({
        title: 'Motivo Requerido',
        message: 'Por favor ingrese el motivo del rechazo del procedimiento odontológico.',
        type: 'warning',
      });
      return;
    }
    onConsentRejected?.(rejectReason.trim());
    setIsSuccess(true);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full rounded-3xl bg-white border border-[#E2E6EA] border-t-4 border-t-[#D4AF37] p-8 shadow-xl space-y-4">
          <div className="h-16 w-16 rounded-full bg-[#E6F4EA] text-[#137333] flex items-center justify-center text-3xl mx-auto">
            ✓
          </div>
          <h2 className="text-2xl font-extrabold text-[#1E242B]">
            ¡Documento Procesado con Éxito!
          </h2>
          <p className="text-xs text-[#687380] leading-relaxed">
            El consentimiento se ha integrado al expediente clínico del paciente en el sistema médico.
          </p>
          <div className="pt-4">
            <Button variant="primary" className="w-full min-h-[48px]" onClick={onExit}>
              Finalizar y Regresar al Sistema
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1E242B] p-4 sm:p-6 lg:p-8 flex flex-col justify-between select-none">
      <AlertModalComponent />
      {/* Header Fijo Kiosco Tablet */}
      <header className="max-w-4xl w-full mx-auto pb-4 border-b border-[#E2E6EA] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[#111111] text-[#D4AF37] font-black flex items-center justify-center text-sm shadow-xs">
            OL
          </div>
          <div>
            <h1 className="text-base font-extrabold text-[#1E242B]">
              Terminal Táctil de Consentimiento Informado
            </h1>
            <p className="text-xs text-[#8F99A3]">
              Consultorio OdontoLeal • Dr. Eduar Leal Álvarez
            </p>
          </div>
        </div>
        <Badge label="Dispositivo Seguro • 30 min max" variant="gold" size="sm" />
      </header>

      {/* Contenido Central: Lectura y Firma */}
      <main className="max-w-4xl w-full mx-auto my-6 space-y-6">
        {/* Ficha del Titular */}
        <div className="rounded-2xl border border-[#E2E6EA] bg-white p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <span className="text-[11px] font-extrabold uppercase text-[#8F99A3]">
              Paciente Titular
            </span>
            <p className="text-sm font-extrabold text-[#1E242B]">
              {nombrePaciente}
            </p>
            <p className="text-xs text-[#687380]">
              Documento de Identidad: C.C. {documentoPaciente}
            </p>
          </div>
          <Badge label="En Consulta Activa" variant="info" />
        </div>

        {/* Texto Legal del Consentimiento */}
        <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs space-y-3">
          <h2 className="text-base font-extrabold text-[#1E242B]">
            {tituloConsentimiento}
          </h2>
          <div className="max-h-48 overflow-y-auto rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] p-4 text-xs leading-relaxed text-[#4B5563] space-y-2">
            <p>{cuerpoTexto}</p>
            <p className="text-[11px] text-[#8F99A3] italic">
              Conforme a la Ley 23 de 1981, Resolución 1995 de 1999 y Ley 1581 de 2012. Este documento no exime de la responsabilidad profesional legal pero certifica el consentimiento expreso e informado.
            </p>
          </div>

          <label className="flex items-start gap-3 p-3 rounded-xl bg-[#FBF6E6]/60 border border-[#EAD89B] cursor-pointer">
            <input
              type="checkbox"
              checked={hasAcceptedTerms}
              onChange={(e) => setHasAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded text-[#D4AF37] focus:ring-[#D4AF37]"
            />
            <span className="text-xs font-semibold text-[#1E242B]">
              He leído y comprendido plenamente la totalidad del documento, se me han explicado los riesgos y alternativas, y otorgo mi consentimiento informado.
            </span>
          </label>
        </div>

        {/* Lienzo de Firma Digital (RQNF-COM-002: botones >= 44x44px) */}
        {!isRejecting ? (
          <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1E242B]">
                Firma Digital Manuscrita en Pantalla
              </h3>
              {signatureData && (
                <Badge label="Firma capturada ✓" variant="success" size="sm" />
              )}
            </div>

            <SignaturePadCanvas
              onSaveSignature={(data) => setSignatureData(data)}
              onClear={() => setSignatureData(null)}
            />
          </div>
        ) : (
          <div className="rounded-3xl border border-[#DC2626] bg-[#FEF2F2] p-6 shadow-xs space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#DC2626]">
              Constancia de No Aceptación / Disentimiento
            </h3>
            <p className="text-xs text-[#687380]">
              El paciente tiene el derecho legal de rechazar el procedimiento propuesto. Ingrese las razones o manifestaciones del paciente:
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Indique las manifestaciones del paciente respecto a su negativa..."
              className="w-full rounded-xl border border-[#DC2626]/40 p-3 text-xs text-[#1E242B] bg-white focus:outline-none"
            />
          </div>
        )}
      </main>

      {/* Botones de Acción Táctiles (mínimo 44px de alto) */}
      <footer className="max-w-4xl w-full mx-auto pt-4 border-t border-[#E2E6EA] flex items-center justify-between gap-4">
        {!isRejecting ? (
          <>
            <button
              type="button"
              onClick={() => setIsRejecting(true)}
              className="min-h-[48px] px-5 py-2.5 rounded-xl border border-[#DC2626] text-xs font-extrabold text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
            >
              Rechazar Procedimiento (No Acepto)
            </button>
            <Button
              variant="primary"
              size="lg"
              className="min-h-[50px] px-8 text-base shadow-lg"
              onClick={handleFinishSigning}
              disabled={!signatureData || !hasAcceptedTerms}
              leftIcon={<span>✍️</span>}
            >
              Sustentar y Concluir Firma
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              className="min-h-[48px]"
              onClick={() => setIsRejecting(false)}
            >
              ← Volver a Firma
            </Button>
            <Button
              variant="danger"
              size="lg"
              className="min-h-[50px] px-8"
              onClick={handleFinishReject}
            >
              Confirmar Disentimiento (No Aceptado)
            </Button>
          </>
        )}
      </footer>
    </div>
  );
};
