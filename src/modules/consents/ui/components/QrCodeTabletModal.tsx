// src/modules/consents/ui/components/QrCodeTabletModal.tsx
import React, { useEffect, useState } from 'react';
import { Modal } from '../../../../shared/ui/components/Modal';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';

export interface QrCodeTabletModalProps {
  isOpen: boolean;
  onClose: () => void;
  consentTitle: string;
  patientName: string;
  signingUrl: string;
  onOpenDirectly?: () => void;
}

export const QrCodeTabletModal: React.FC<QrCodeTabletModalProps> = ({
  isOpen,
  onClose,
  consentTitle,
  patientName,
  signingUrl,
  onOpenDirectly,
}) => {
  // Cuenta regresiva de 15 minutos (900 segundos) según RF-CON-006
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(900);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeftSeconds(900);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Firma en Tablet / Dispositivo Táctil</span>
          <Badge label="Enlace Seguro Único" variant="gold" size="sm" />
        </div>
      }
      subtitle={`Paciente: ${patientName} • Consentimiento: ${consentTitle}`}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {onOpenDirectly && (
            <Button variant="primary" onClick={onOpenDirectly} rightIcon={<span>📱</span>}>
              Abrir Vista Tablet en este equipo
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6 text-center">
        {/* Temporizador */}
        <div className="inline-flex items-center gap-2 rounded-2xl bg-[#FBF6E6] border border-[#EAD89B] px-4 py-2 text-xs font-bold text-[#8F721A]">
          <span>⏳ Vigencia del enlace:</span>
          <span className="text-sm font-extrabold text-[#111111]">{formattedTime}</span>
        </div>

        {/* QR Code Placeholder Accesible y Generado por SVG */}
        <div className="mx-auto w-56 h-56 rounded-3xl border-2 border-[#D4AF37] p-3 bg-white shadow-md flex flex-col items-center justify-center">
          <svg className="w-44 h-44 text-[#111111]" viewBox="0 0 100 100" fill="currentColor">
            {/* Patrón estilizado de QR */}
            <rect x="10" y="10" width="24" height="24" rx="4" fill="currentColor" />
            <rect x="14" y="14" width="16" height="16" rx="2" fill="white" />
            <rect x="18" y="18" width="8" height="8" fill="currentColor" />

            <rect x="66" y="10" width="24" height="24" rx="4" fill="currentColor" />
            <rect x="70" y="14" width="16" height="16" rx="2" fill="white" />
            <rect x="74" y="18" width="8" height="8" fill="currentColor" />

            <rect x="10" y="66" width="24" height="24" rx="4" fill="currentColor" />
            <rect x="14" y="70" width="16" height="16" rx="2" fill="white" />
            <rect x="18" y="74" width="8" height="8" fill="currentColor" />

            <rect x="42" y="12" width="6" height="6" fill="#D4AF37" />
            <rect x="52" y="12" width="6" height="6" fill="currentColor" />
            <rect x="42" y="24" width="16" height="6" fill="currentColor" />
            <rect x="42" y="42" width="16" height="16" rx="3" fill="#D4AF37" />
            <rect x="12" y="42" width="8" height="8" fill="currentColor" />
            <rect x="24" y="52" width="8" height="8" fill="currentColor" />
            <rect x="66" y="42" width="8" height="8" fill="currentColor" />
            <rect x="78" y="52" width="12" height="6" fill="currentColor" />
            <rect x="66" y="70" width="20" height="8" fill="currentColor" />
            <rect x="42" y="78" width="16" height="10" fill="#D4AF37" />
          </svg>
          <span className="text-[10px] font-bold text-[#8F99A3] mt-1">
            Escanee con la cámara de la tablet
          </span>
        </div>

        <p className="text-xs text-[#687380] max-w-sm mx-auto">
          El paciente o acudiente visualizará el texto completo del consentimiento en la tablet para leer y firmar digitalmente. Una vez firmado, se sincronizará automáticamente en menos de 10 segundos (RF-CON-002).
        </p>
      </div>
    </Modal>
  );
};
