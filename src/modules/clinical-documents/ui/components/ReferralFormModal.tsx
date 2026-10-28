// src/modules/clinical-documents/ui/components/ReferralFormModal.tsx
import React, { useState } from 'react';
import { Modal } from '../../../../shared/ui/components/Modal';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';

export interface ReferralFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  onSaveReferral: (data: {
    especialidadDestino: string;
    prioridad: 'Prioritaria / Urgencia' | 'Programada / Ordinaria';
    motivoResumen: string;
    incluirFirma: boolean;
  }) => Promise<void> | void;
}

export const ReferralFormModal: React.FC<ReferralFormModalProps> = ({
  isOpen,
  onClose,
  patientName,
  onSaveReferral,
}) => {
  const [especialidad, setEspecialidad] = useState('Endodoncia Microscópica');
  const [prioridad, setPrioridad] = useState<'Prioritaria / Urgencia' | 'Programada / Ordinaria'>(
    'Prioritaria / Urgencia'
  );
  const [motivo, setMotivo] = useState('');
  const [incluirFirma, setIncluirFirma] = useState(true);
  const { showAlert, AlertModalComponent } = useAlertModal();

  const specialties = [
    'Endodoncia Microscópica',
    'Cirugía Maxilofacial',
    'Periodoncia e Implantología',
    'Ortodoncia y Ortopedia Maxilar',
    'Rehabilitación Oral y Prótesis',
    'Odontopediatría',
    'Patología y Medicina Oral',
  ];

  const handleSave = () => {
    if (!motivo.trim()) {
      showAlert({
        title: 'Motivo Requerido',
        message: 'Debe incluir el motivo y resumen clínico de la remisión especializada.',
        type: 'warning',
      });
      return;
    }
    onSaveReferral({
      especialidadDestino: especialidad,
      prioridad,
      motivoResumen: motivo.trim(),
      incluirFirma,
    });
    onClose();
  };

  return (
    <>
      <AlertModalComponent />
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Remisión Médica / Interconsulta Especializada"
      subtitle={`Paciente: ${patientName} • RF-DOC-003`}
      maxWidth="2xl"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} leftIcon={<span>🖨️</span>}>
            Generar e Imprimir Remisión
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-[#FBF6E6] border border-[#EAD89B] p-3 text-xs text-[#8F721A]">
          Conforme a RF-DOC-003, la remisión se formula a la <strong>especialidad de destino</strong> sin vincular a un especialista nominal específico para salvaguardar la libertad de elección del paciente.
        </div>

        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-1.5">
            Especialidad de Destino <span className="text-[#DC2626]">*</span>
          </label>
          <select
            value={especialidad}
            onChange={(e) => setEspecialidad(e.target.value)}
            className="w-full min-h-[44px] rounded-xl border border-[#E2E6EA] bg-white px-3.5 py-2 text-xs font-bold text-[#1E242B]"
          >
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-2">
            Prioridad de la Atención
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPrioridad('Prioritaria / Urgencia')}
              className={`min-h-[44px] rounded-xl border font-bold text-xs p-2 transition-all ${
                prioridad === 'Prioritaria / Urgencia'
                  ? 'border-[#DC2626] bg-[#FEF2F2] text-[#DC2626] ring-2 ring-[#DC2626]/30'
                  : 'border-[#E2E6EA] bg-white text-[#687380]'
              }`}
            >
              🚨 Prioritaria / Urgencia
            </button>
            <button
              type="button"
              onClick={() => setPrioridad('Programada / Ordinaria')}
              className={`min-h-[44px] rounded-xl border font-bold text-xs p-2 transition-all ${
                prioridad === 'Programada / Ordinaria'
                  ? 'border-[#1E242B] bg-[#1E242B] text-white'
                  : 'border-[#E2E6EA] bg-white text-[#687380]'
              }`}
            >
              🗓️ Programada / Ordinaria
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-1.5">
            Motivo y Resumen Clínico de la Remisión <span className="text-[#DC2626]">*</span>
          </label>
          <textarea
            rows={4}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full rounded-xl border border-[#E2E6EA] p-3 text-xs leading-relaxed text-[#1E242B] focus:border-[#D4AF37] focus:outline-none"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#1E242B]">
          <input
            type="checkbox"
            checked={incluirFirma}
            onChange={(e) => setIncluirFirma(e.target.checked)}
            className="h-4 w-4 rounded text-[#D4AF37]"
          />
          Incrustar firma digital registrada del odontólogo tratante (Flatten)
        </label>
      </div>
    </Modal>
    </>
  );
};
