// src/modules/patients/ui/components/PrivacyNoticeModal.tsx
import React from 'react';
import { Modal } from '../../../../shared/ui/components/Modal';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { usePrivacyNotice } from '../../../consents/ui/hooks/usePrivacyNotice';

export interface PrivacyNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
}

/**
 * RQNF-SEG-006 (ERS v1.3): el aviso es la plantilla vigente de autorización de
 * datos del Módulo D (antes era un texto fijo en el código).
 */
export const PrivacyNoticeModal: React.FC<PrivacyNoticeModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  showAcceptButton = false,
}) => {
  const { notice, isLoading, error } = usePrivacyNotice(isOpen);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>{notice?.nombre ?? 'Aviso de Privacidad y Tratamiento de Datos'}</span>
          <Badge label={notice ? `Versión ${notice.version}` : 'Ley 1581 de 2012'} variant="gold" size="sm" />
        </div>
      }
      subtitle="Consultorio Odontológico Dr. Eduar Leal Álvarez • OdontoLeal"
      maxWidth="2xl"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {showAcceptButton && notice && (
            <Button
              variant="primary"
              onClick={() => {
                onAccept?.();
                onClose();
              }}
            >
              Acepto el aviso de privacidad
            </Button>
          )}
        </div>
      }
    >
      <div className="text-xs leading-relaxed text-[#4B5563] max-h-[60vh] overflow-y-auto pr-2">
        {isLoading && <p>Cargando el aviso de privacidad...</p>}
        {error && <p className="text-[#DC2626]">{error}</p>}
        {notice && <div className="whitespace-pre-line text-[#1E242B]">{notice.texto}</div>}
      </div>
    </Modal>
  );
};
