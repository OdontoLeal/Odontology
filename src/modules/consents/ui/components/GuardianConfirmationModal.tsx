// src/modules/consents/ui/components/GuardianConfirmationModal.tsx
import React, { useState } from 'react';
import { Modal } from '../../../../shared/ui/components/Modal';
import { Button } from '../../../../shared/ui/components/Button';
import { Input } from '../../../../shared/ui/components/Input';
import { Badge } from '../../../../shared/ui/components/Badge';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';

export interface GuardianData {
  nombreCompleto: string;
  documentoIdentidad: string;
  parentesco: string;
  telefono: string;
}

export interface GuardianConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  initialGuardian?: GuardianData | null;
  onConfirmGuardian: (guardian: GuardianData) => void;
}

export const GuardianConfirmationModal: React.FC<GuardianConfirmationModalProps> = ({
  isOpen,
  onClose,
  patientName,
  initialGuardian,
  onConfirmGuardian,
}) => {
  const [nombre, setNombre] = useState(initialGuardian?.nombreCompleto || '');
  const [documento, setDocumento] = useState(initialGuardian?.documentoIdentidad || '');
  const [parentesco, setParentesco] = useState(initialGuardian?.parentesco || 'Madre');
  const [telefono, setTelefono] = useState(initialGuardian?.telefono || '');
  const { showAlert, AlertModalComponent } = useAlertModal();

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !documento.trim() || !telefono.trim()) {
      showAlert({
        title: 'Datos Incompletos del Acudiente',
        message: 'Todos los datos del acudiente (nombre, documento y teléfono) son obligatorios para pacientes menores de edad (Ley 27 de 1977 / RF-CON-005).',
        type: 'warning',
      });
      return;
    }
    onConfirmGuardian({
      nombreCompleto: nombre.trim(),
      documentoIdentidad: documento.trim(),
      parentesco,
      telefono: telefono.trim(),
    });
  };

  return (
    <>
      <AlertModalComponent />
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Confirmación de Acudiente Legal</span>
          <Badge label="Menor de 18 años" variant="warning" size="sm" />
        </div>
      }
      subtitle={`Paciente: ${patientName} • Requerido por la Ley 27 de 1977 y RF-CON-005`}
      maxWidth="md"
    >
      <form onSubmit={handleConfirm} className="space-y-4">
        <div className="rounded-xl bg-[#FBF6E6] border border-[#EAD89B] p-3 text-xs text-[#8F721A]">
          Para la suscripción de consentimientos informados en pacientes menores de edad, es imperativa la comparecencia y firma del acudiente o representante legal.
        </div>

        <Input
          label="Nombre Completo del Acudiente"
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Carlos Mariana Carvajal"
        />

        <Input
          label="Documento de Identidad del Acudiente"
          required
          value={documento}
          onChange={(e) => setDocumento(e.target.value)}
          placeholder="C.C. sin puntos"
        />

        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-1.5">
            Parentesco o Vínculo Legal <span className="text-[#DC2626]">*</span>
          </label>
          <select
            value={parentesco}
            onChange={(e) => setParentesco(e.target.value)}
            className="w-full min-h-[44px] rounded-xl border border-[#E2E6EA] bg-white px-3 text-xs font-semibold text-[#1E242B]"
          >
            <option value="Madre">Madre</option>
            <option value="Padre">Padre</option>
            <option value="Tutor Legal">Tutor Legal</option>
            <option value="Familiar Responsable">Familiar Responsable</option>
          </select>
        </div>

        <Input
          label="Teléfono Móvil del Acudiente"
          required
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="3158901234"
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-[#E2E6EA]">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit">
            Confirmar y Habilitar Firma
          </Button>
        </div>
      </form>
    </Modal>
    </>
  );
};
