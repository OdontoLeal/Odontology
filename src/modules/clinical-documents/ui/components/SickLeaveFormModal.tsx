// src/modules/clinical-documents/ui/components/SickLeaveFormModal.tsx
import React, { useState } from 'react';
import { Modal } from '../../../../shared/ui/components/Modal';
import { Button } from '../../../../shared/ui/components/Button';
import { Input } from '../../../../shared/ui/components/Input';
import { Badge } from '../../../../shared/ui/components/Badge';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';

export interface SickLeaveFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  isMinor?: boolean;
  guardianName?: string;
  onSaveSickLeave: (data: {
    diasIncapacidad: number;
    fechaInicio: string;
    fechaFin: string;
    diagnostico: string;
    justificacion: string;
    incluirFirma: boolean;
  }) => Promise<void> | void;
}

export const SickLeaveFormModal: React.FC<SickLeaveFormModalProps> = ({
  isOpen,
  onClose,
  patientName,
  isMinor = false,
  guardianName,
  onSaveSickLeave,
}) => {
  const [dias, setDias] = useState(2);
  const [fechaInicio, setFechaInicio] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [diagnostico, setDiagnostico] = useState(
    'K04.0 - Pulpitis irreversible sintomática y exodoncia quirúrgica de molar'
  );
  const [justificacion, setJustificacion] = useState(
    'Paciente sometido(a) a intervención quirúrgica y desbridamiento endodóntico. Requiere reposo relativo de 48 horas sin esfuerzos físicos moderados y dieta blanda estricta para evitar hemorragias.'
  );
  const [incluirFirma, setIncluirFirma] = useState(true);

  // Cálculo automático de fecha fin (RF-DOC-002: 1 a 30 días)
  const calculateEndDate = (startDate: string, numDays: number): string => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + (numDays - 1));
    return d.toISOString().split('T')[0];
  };

  const fechaFin = calculateEndDate(fechaInicio, dias);
  const { showAlert, AlertModalComponent } = useAlertModal();

  const handleSave = () => {
    if (dias < 1 || dias > 30) {
      showAlert({
        title: 'Duración Fuera de Rango',
        message: 'La incapacidad odontológica debe tener una duración entre 1 y 30 días calendario (RF-DOC-002).',
        type: 'warning',
      });
      return;
    }
    if (!justificacion.trim()) {
      showAlert({
        title: 'Justificación Requerida',
        message: 'Debe ingresar la justificación clínica y médica de la incapacidad.',
        type: 'warning',
      });
      return;
    }

    onSaveSickLeave({
      diasIncapacidad: dias,
      fechaInicio,
      fechaFin,
      diagnostico: diagnostico.trim(),
      justificacion: justificacion.trim(),
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
      title="Certificado de Incapacidad Médica / Excusa Laboral"
      subtitle={`Paciente: ${patientName} • RF-DOC-002`}
      maxWidth="2xl"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} leftIcon={<span>🖨️</span>}>
            Generar e Imprimir Excusa
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {isMinor && (
          <div className="rounded-xl bg-[#FBF6E6] border border-[#EAD89B] p-3 text-xs text-[#8F721A] flex items-center justify-between">
            <span>
              👶 Paciente Menor de Edad. Se incluirá constancia para el acudiente:{' '}
              <strong>{guardianName || 'Acudiente Legal'}</strong>.
            </span>
            <Badge label="Ley 27 de 1977" variant="warning" size="sm" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-1.5">
              Días de Incapacidad (1 a 30) <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
              className="w-full min-h-[44px] rounded-xl border border-[#E2E6EA] px-3 text-sm font-extrabold text-[#1E242B]"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-1.5">
              Fecha de Inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#E2E6EA] px-3 text-xs font-bold text-[#1E242B]"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-1.5">
              Fecha de Culminación (Auto)
            </label>
            <input
              type="date"
              disabled
              value={fechaFin}
              className="w-full min-h-[44px] rounded-xl border border-[#CBD2D9] bg-[#F8F9FA] px-3 text-xs font-extrabold text-[#1E242B]"
            />
          </div>
        </div>

        <Input
          label="Diagnóstico Clínico (CIE-10)"
          value={diagnostico}
          onChange={(e) => setDiagnostico(e.target.value)}
          required
        />

        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-1.5">
            Diagnóstico y Justificación Médica <span className="text-[#DC2626]">*</span>
          </label>
          <textarea
            rows={3}
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
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
