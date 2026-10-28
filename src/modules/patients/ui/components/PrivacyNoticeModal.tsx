// src/modules/patients/ui/components/PrivacyNoticeModal.tsx
import React from 'react';
import { Modal } from '../../../../shared/ui/components/Modal';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';

export interface PrivacyNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
}

export const PrivacyNoticeModal: React.FC<PrivacyNoticeModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  showAcceptButton = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Aviso de Privacidad y Tratamiento de Datos</span>
          <Badge label="Ley 1581 de 2012" variant="gold" size="sm" />
        </div>
      }
      subtitle="Consultorio Odontológico Dr. Eduar Leal Álvarez • OdontoLeal"
      maxWidth="2xl"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {showAcceptButton && (
            <Button
              variant="primary"
              onClick={() => {
                onAccept?.();
                onClose();
              }}
            >
              Acepto los Términos y Autorizo el Tratamiento
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-xs leading-relaxed text-[#4B5563] max-h-[60vh] overflow-y-auto pr-2">
        <p className="font-semibold text-[#1E242B]">
          En cumplimiento de la Ley Estatutaria 1581 de 2012, el Decreto Reglamentario 1377 de 2013 y demás normas concordantes:
        </p>

        <section className="space-y-1.5">
          <h4 className="font-bold text-[#1E242B] uppercase text-[11px] tracking-wide">
            1. Responsable del Tratamiento
          </h4>
          <p>
            El <strong>Consultorio Odontológico Dr. Eduar Leal Álvarez (OdontoLeal)</strong>, ubicado en la Calle 127 # 14-54, Edificio Medical Prestige, Suite 402, Bogotá D.C., Colombia, es el responsable del tratamiento de los datos personales y datos sensibles recolectados.
          </p>
        </section>

        <section className="space-y-1.5">
          <h4 className="font-bold text-[#1E242B] uppercase text-[11px] tracking-wide">
            2. Finalidad del Tratamiento de Datos Sensibles Médicos
          </h4>
          <p>
            Los datos de salud, antecedentes médicos, evoluciones clínicas, odontogramas y fotografías de diagnóstico serán tratados exclusivamente para:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>La correcta prestación de servicios de salud odontológica, diagnóstico y plan de tratamiento (Resolución 1995 de 1999).</li>
            <li>Agendamiento, confirmación y recordatorio de citas médicas mediante correo electrónico y/o mensajería.</li>
            <li>Cumplimiento de las obligaciones legales, auditorías del Sistema Obligatorio de Garantía de Calidad en Salud (SOGCS) y requerimientos de autoridades judiciales o sanitarias competentes.</li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <h4 className="font-bold text-[#1E242B] uppercase text-[11px] tracking-wide">
            3. Derechos del Titular (Habeas Data)
          </h4>
          <p>
            El paciente o su representante legal tienen derecho a conocer, actualizar y rectificar sus datos personales. De conformidad con el Artículo 34 de la Ley 23 de 1981 y la Resolución 1995 de 1999, la historia clínica es un documento privado sometido a reserva legal, custodiado por el consultorio médico por un periodo mínimo legal de conservación.
          </p>
        </section>

        <section className="space-y-1.5">
          <h4 className="font-bold text-[#1E242B] uppercase text-[11px] tracking-wide">
            4. Seguridad y Cifrado
          </h4>
          <p>
            OdontoLeal implementa controles de seguridad técnicos, administrativos y humanos (cifrado AES-256 en reposo, protocolos TLS 1.2+ en tránsito y segregación estricta por roles RBAC) para garantizar la confidencialidad e integridad de la información médica.
          </p>
        </section>
      </div>
    </Modal>
  );
};
