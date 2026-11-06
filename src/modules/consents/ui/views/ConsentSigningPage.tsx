// src/modules/consents/ui/views/ConsentSigningPage.tsx
// RF-CON-001, RF-CON-002, RF-CON-005 (ERS v1.3): pantalla de lectura y firma dentro de la
// sesión del profesional o la auxiliar, en tablet o computador. Ya no existe la firma por
// enlace de un solo uso ni QR (RF-CON-006 se eliminó en la v1.2).
import React, { useState, useMemo } from 'react';
import { SignaturePadCanvas } from '../components/SignaturePadCanvas';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { FileTextIcon, UserIcon } from '../../../../shared/ui/components/Icons';
import {
  DetailPageHeader,
  SectionCard,
  SectionCardHeader,
  StatusBadge,
  UserAvatar,
} from '../../../../shared/ui/components/DetailPage';
import { Input } from '../../../../shared/ui/components/Input';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';
import { interpolateConsentTemplate } from '../../domain/consent-template-interpolator';

export interface ConsentSignPayload {
  firmaBase64: string;
  firmaPorAcudiente: boolean;
  nombreDocumentoAcudiente: string | null;
  textoFirmado: string;
}

export interface ConsentSigningPageProps {
  idConsentimiento?: number;
  idPaciente?: number;
  tituloConsentimiento?: string;
  cuerpoTexto?: string;
  nombrePaciente?: string;
  documentoPaciente?: string;
  isMinor?: boolean;
  /** Guarda la firma en el servidor; si lanza un error, la pantalla lo muestra y no da el éxito. */
  onConsentSigned?: (result: ConsentSignPayload) => Promise<void> | void;
  onConsentRejected?: (motivo: string) => void;
  onExit?: () => void;
}

export const ConsentSigningPage: React.FC<ConsentSigningPageProps> = ({
  tituloConsentimiento = 'Consentimiento Informado para Procedimiento Odontológico',
  cuerpoTexto = 'Por medio del presente documento, manifiesto libre y voluntariamente que he sido informado(a) por el profesional tratante sobre el diagnóstico clínico, los objetivos del procedimiento, los riesgos inherentes y las posibles complicaciones. Declaro haber tenido la oportunidad de formular preguntas y resuelto todas mis dudas. Autorizo la realización del tratamiento acordado en las instalaciones de OdontoLeal.',
  nombrePaciente = 'Paciente Titular',
  documentoPaciente = '',
  isMinor = false,
  onConsentSigned,
  onConsentRejected,
  onExit,
}) => {
  const activeTitle = tituloConsentimiento;
  const activeBody = cuerpoTexto;
  const activePatientName = nombrePaciente;
  const activePatientDoc = documentoPaciente;
  // RF-CON-005: para un menor la casilla de acudiente aparece marcada y no se puede desmarcar
  const activeIsMinor = isMinor;
  const [isSaving, setIsSaving] = useState(false);

  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [isGuardianSigning, setIsGuardianSigning] = useState<boolean>(Boolean(isMinor));
  const [guardianNameAndDoc, setGuardianNameAndDoc] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const { showAlert, AlertModalComponent } = useAlertModal();

  const interpolatedText = useMemo(() => {
    return interpolateConsentTemplate(activeBody, {
      nombrePaciente: activePatientName,
      documentoPaciente: activePatientDoc,
      firmaPorAcudiente: isGuardianSigning,
      nombreDocumentoAcudiente: isGuardianSigning ? guardianNameAndDoc : null,
    });
  }, [activeBody, activePatientName, activePatientDoc, isGuardianSigning, guardianNameAndDoc]);

  const handleFinishSigning = () => {
    if (!signatureData) {
      showAlert({
        title: 'Firma Requerida',
        message: 'Por favor capture su firma manuscrita en el recuadro inferior antes de continuar (RF-CON-002).',
        type: 'warning',
      });
      return;
    }
    if (!hasAcceptedTerms) {
      showAlert({
        title: 'Aceptación Requerida',
        message: 'Debe marcar la casilla de confirmación y aceptación de los términos leídos (RF-CON-002).',
        type: 'warning',
      });
      return;
    }
    if (isGuardianSigning && !guardianNameAndDoc.trim()) {
      showAlert({
        title: 'Datos de Acudiente Obligatorios',
        message: 'Debe ingresar el nombre y documento de identidad del acudiente o representante legal (RF-CON-005).',
        type: 'warning',
      });
      return;
    }

    const payload: ConsentSignPayload = {
      firmaBase64: signatureData,
      firmaPorAcudiente: isGuardianSigning,
      nombreDocumentoAcudiente: isGuardianSigning ? guardianNameAndDoc.trim() : null,
      textoFirmado: interpolatedText,
    };
    setIsSaving(true);
    Promise.resolve(onConsentSigned?.(payload))
      .then(() => setIsSuccess(true))
      .catch((err: any) => {
        showAlert({
          title: 'No se guardó el consentimiento',
          message: err?.message || 'Error al registrar la firma en el servidor.',
          type: 'error',
        });
      })
      .finally(() => setIsSaving(false));
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

  const handleExit = () => {
    if (onExit) {
      onExit();
    } else if (typeof window !== 'undefined') {
      window.history.back();
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full rounded-3xl bg-white border border-[#E2E6EA] border-t-4 border-t-[#D4AF37] p-8 shadow-xl space-y-4">
          <div className="h-16 w-16 rounded-full bg-[#E6F4EA] text-[#137333] flex items-center justify-center text-3xl mx-auto">
            ✓
          </div>
          <h2 className="text-2xl font-extrabold text-[#1E242B]">
            ¡Consentimiento Firmado con Éxito!
          </h2>
          <p className="text-xs text-[#687380] leading-relaxed">
            El consentimiento se ha registrado en la historia clínica del paciente con firma digitalizada.
          </p>
          <div className="pt-4">
            <Button variant="primary" className="w-full min-h-[48px]" onClick={onExit}>
              Finalizar y Regresar a la Ficha del Paciente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1E242B] p-4 sm:p-6 lg:p-8 flex flex-col justify-between">
      <AlertModalComponent />
      <main className="max-w-4xl w-full min-w-0 mx-auto space-y-6">
        <DetailPageHeader
          backLabel="Volver a la Ficha del Paciente"
          onBack={handleExit}
          title="Firma de Consentimiento Informado"
          badge={
            <>
              <StatusBadge tone="gold">Dispositivo seguro</StatusBadge>
              {activeIsMinor && <StatusBadge tone="warning">Acudiente obligatorio</StatusBadge>}
            </>
          }
          subtitle="Terminal táctil de lectura y firma · Consultorio OdontoLeal."
        />

        {/* Ficha del titular */}
        <SectionCard
          title="Paciente Titular"
          icon={<UserIcon />}
          action={<StatusBadge tone="neutral">{activeIsMinor ? 'Menor de 18 años' : 'Adulto'}</StatusBadge>}
        >
          <div className="flex min-w-0 items-center gap-4">
            <UserAvatar name={activePatientName} size="md" />
            <div className="min-w-0">
              <p className="text-break text-[18px] font-bold leading-6 text-[#1E242B]">{activePatientName}</p>
              {activePatientDoc && (
                <p className="mt-0.5 text-[14px] text-[#64748B]">Documento: {activePatientDoc}</p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Texto Legal del Consentimiento */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-5 sm:px-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
          <SectionCardHeader title={activeTitle} icon={<FileTextIcon />} />
          <div className="max-h-60 overflow-y-auto rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] p-4 text-sm leading-relaxed text-[#1E242B] space-y-3">
            <div className="whitespace-pre-line text-break">{interpolatedText}</div>
            <p className="text-[13px] text-[#687380] italic pt-2 border-t border-[#E2E6EA]">
              Conforme a la Ley 23 de 1981, Resolución 1995 de 1999 y Ley 1581 de 2012. Este documento certifica el consentimiento libre, previo y expreso.
            </p>
          </div>

          {/* RF-CON-005: Casilla y campo de acudiente */}
          <div className="p-4 rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] space-y-3">
            <label className="flex min-h-[44px] items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isGuardianSigning}
                disabled={activeIsMinor}
                onChange={(e) => {
                  if (!activeIsMinor) {
                    setIsGuardianSigning(e.target.checked);
                  }
                }}
                className="touch-checkbox"
              />
              <span className="min-w-0 text-left text-sm font-bold text-[#1E242B]">
                Firma en calidad de acudiente / representante legal
                {activeIsMinor && ' (Obligatorio para menores de 18 años - RF-CON-005)'}
              </span>
            </label>

            {isGuardianSigning && (
              <div className="pt-2">
                <Input
                  label="Nombre y Documento del Acudiente / Representante Legal *"
                  required
                  value={guardianNameAndDoc}
                  onChange={(e) => setGuardianNameAndDoc(e.target.value)}
                  placeholder="Ej: Claudia Patricia Gómez - C.C. 37.890.123"
                />
              </div>
            )}
          </div>

          <label className="flex min-h-[44px] items-center gap-3 p-3 rounded-xl bg-[#FBF6E6]/60 border border-[#EAD89B] cursor-pointer">
            <input
              type="checkbox"
              checked={hasAcceptedTerms}
              onChange={(e) => setHasAcceptedTerms(e.target.checked)}
              className="touch-checkbox"
            />
            <span className="min-w-0 text-left text-sm font-semibold text-[#1E242B]">
              He leído y comprendido plenamente la totalidad del documento, se me han explicado los riesgos y alternativas, y otorgo mi consentimiento informado.
            </span>
          </label>
        </div>

        {/* Lienzo de Firma Digital (RQNF-COM-002: controles >= 44x44px) */}
        {!isRejecting ? (
          <div className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-4 py-5 sm:px-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-3">
            <SectionCardHeader
              title={
                isGuardianSigning
                  ? `Firma del Acudiente / Representante Legal de ${activePatientName}`
                  : 'Firma del Paciente'
              }
              icon={
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              }
              description="Realice su trazo manuscrito en el recuadro con el dedo, lápiz óptico o mouse."
              action={signatureData ? <StatusBadge tone="success">Firma capturada</StatusBadge> : undefined}
            />

            <SignaturePadCanvas
              onSaveSignature={(data) => setSignatureData(data)}
              onClear={() => setSignatureData(null)}
            />
          </div>
        ) : (
          <div className="rounded-3xl border border-[#DC2626] bg-[#FEF2F2] p-4 sm:p-6 shadow-xs space-y-3">
            <h3 className="text-[16px] font-bold leading-6 text-[#B91C1C]">
              Constancia de No Aceptación / Disentimiento
            </h3>
            <p className="text-xs text-[#687380]">
              El paciente tiene el derecho legal de rechazar el procedimiento propuesto. Ingrese las razones:
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Indique las manifestaciones del paciente respecto a su negativa..."
              className="w-full rounded-xl border border-[#DC2626]/40 p-3 text-sm text-[#1E242B] bg-white focus:outline-none"
            />
          </div>
        )}
      </main>

      {/* Botones de Acción Táctiles (mínimo 44px de alto) */}
      <footer className="max-w-4xl w-full mx-auto pt-4 border-t border-[#E2E6EA] flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="min-h-[48px] min-w-[44px] w-full sm:w-auto px-6 text-xs font-extrabold text-[#687380] border-[#CBD2D9] hover:bg-[#F8F9FA] hover:text-[#1E242B]"
            onClick={handleExit}
            leftIcon={<span>←</span>}
          >
            Salir
          </Button>

          {/* El rechazo solo se ofrece si hay dónde registrarlo; si no, mostraría un éxito falso */}
          {!onConsentRejected ? null : !isRejecting ? (
            <button
              type="button"
              onClick={() => setIsRejecting(true)}
              className="min-h-[48px] min-w-[44px] w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#DC2626] text-xs font-extrabold text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
            >
              Rechazar Procedimiento (No Acepto)
            </button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="min-h-[48px] w-full sm:w-auto"
              onClick={() => setIsRejecting(false)}
            >
              ← Volver a Firma
            </Button>
          )}
        </div>

        <div className="w-full sm:w-auto">
          {!isRejecting ? (
            <Button
              variant="primary"
              size="lg"
              className="min-h-[50px] min-w-[44px] w-full sm:w-auto px-6 sm:px-8 text-base shadow-lg text-center"
              onClick={handleFinishSigning}
              disabled={!signatureData || !hasAcceptedTerms || isSaving}
              leftIcon={<span>✍️</span>}
            >
              Guardar Consentimiento Firmado
            </Button>
          ) : (
            <Button
              variant="danger"
              size="lg"
              className="min-h-[50px] min-w-[44px] w-full sm:w-auto px-6 sm:px-8 text-center"
              onClick={handleFinishReject}
            >
              Confirmar Disentimiento (No Aceptado)
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
};
