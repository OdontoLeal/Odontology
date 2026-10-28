// src/modules/clinical-documents/ui/components/PrescriptionFormModal.tsx
import React, { useState } from 'react';
import { Modal } from '../../../../shared/ui/components/Modal';
import { Button } from '../../../../shared/ui/components/Button';
import { Input } from '../../../../shared/ui/components/Input';
import { Badge } from '../../../../shared/ui/components/Badge';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';

export interface MedicationItem {
  nombre: string;
  dosis: string;
  frecuencia: string;
  duracion: string;
  indicaciones?: string;
}

export interface PrescriptionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  doctorName?: string;
  onSavePrescription: (prescriptionData: {
    medicamentos: MedicationItem[];
    incluirFirmaDigital: boolean;
    recomendacionesGenerales?: string;
  }) => Promise<void> | void;
}

export const PrescriptionFormModal: React.FC<PrescriptionFormModalProps> = ({
  isOpen,
  onClose,
  patientName,
  doctorName = 'Dr. Eduar Leal Álvarez',
  onSavePrescription,
}) => {
  const [medicamentos, setMedicamentos] = useState<MedicationItem[]>([]);
  const { showAlert, AlertModalComponent } = useAlertModal();

  const [newNombre, setNewNombre] = useState('');
  const [newDosis, setNewDosis] = useState('');
  const [newFrecuencia, setNewFrecuencia] = useState('');
  const [newDuracion, setNewDuracion] = useState('');
  const [incluirFirmaDigital, setIncluirFirmaDigital] = useState(true);
  const [recomendaciones, setRecomendaciones] = useState('');

  const handleAddMedication = () => {
    if (!newNombre.trim() || !newDosis.trim()) {
      showAlert({
        title: 'Medicamento Incompleto',
        message: 'Debe ingresar al menos el nombre y la dosis del fármaco a prescribir.',
        type: 'warning',
      });
      return;
    }
    setMedicamentos((prev) => [
      ...prev,
      {
        nombre: newNombre.trim(),
        dosis: newDosis.trim(),
        frecuencia: newFrecuencia.trim() || 'Cada 8 horas',
        duracion: newDuracion.trim() || '5 días',
      },
    ]);
    setNewNombre('');
    setNewDosis('');
    setNewFrecuencia('');
    setNewDuracion('');
  };

  const handleRemoveMedication = (index: number) => {
    setMedicamentos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = () => {
    if (medicamentos.length === 0) {
      showAlert({
        title: 'Prescripción Vacía',
        message: 'Debe prescribir al menos un fármaco antes de generar la fórmula médica.',
        type: 'warning',
      });
      return;
    }
    onSavePrescription({
      medicamentos,
      incluirFirmaDigital,
      recomendacionesGenerales: recomendaciones,
    });
    onClose();
  };

  return (
    <>
      <AlertModalComponent />
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Prescripción Farmacológica / Fórmula Médica"
      subtitle={`Paciente: ${patientName} • Profesional tratante: ${doctorName}`}
      maxWidth="3xl"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} leftIcon={<span>📄</span>}>
            Generar Fórmula y Descargar PDF
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Tabla de Medicamentos Agregados (Page 20) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#1E242B]">
              Medicamentos Prescritos ({medicamentos.length})
            </h4>
            <Badge label="Norma Resolución 1995" variant="gold" size="sm" />
          </div>

          <div className="rounded-2xl border border-[#E2E6EA] bg-white overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FA] text-[10px] font-extrabold uppercase text-[#687380] border-b border-[#E2E6EA]">
                <tr>
                  <th className="p-3">Principio Activo</th>
                  <th className="p-3">Dosis / Conc.</th>
                  <th className="p-3">Frecuencia / Vía</th>
                  <th className="p-3">Duración</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E6EA]">
                {medicamentos.map((m, idx) => (
                  <tr key={idx} className="hover:bg-[#FBF6E6]/40">
                    <td className="p-3 font-bold text-[#1E242B]">{m.nombre}</td>
                    <td className="p-3 text-[#4B5563]">{m.dosis}</td>
                    <td className="p-3 text-[#4B5563]">{m.frecuencia}</td>
                    <td className="p-3 text-[#4B5563]">{m.duracion}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveMedication(idx)}
                        className="text-[#DC2626] font-bold hover:underline"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Formulario para Agregar Fármaco */}
        <div className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-4 space-y-3">
          <span className="text-xs font-extrabold uppercase text-[#1E242B]">
            + Agregar Nuevo Medicamento
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Medicamento / Principio..."
              value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)}
              className="rounded-xl border border-[#CBD2D9] px-3 py-2 text-xs bg-white"
            />
            <input
              type="text"
              placeholder="Dosis (ej: 500 mg)..."
              value={newDosis}
              onChange={(e) => setNewDosis(e.target.value)}
              className="rounded-xl border border-[#CBD2D9] px-3 py-2 text-xs bg-white"
            />
            <input
              type="text"
              placeholder="Frecuencia (ej: c/8h)..."
              value={newFrecuencia}
              onChange={(e) => setNewFrecuencia(e.target.value)}
              className="rounded-xl border border-[#CBD2D9] px-3 py-2 text-xs bg-white"
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Duración..."
                value={newDuracion}
                onChange={(e) => setNewDuracion(e.target.value)}
                className="rounded-xl border border-[#CBD2D9] px-3 py-2 text-xs bg-white flex-1"
              />
              <Button size="sm" variant="primary" type="button" onClick={handleAddMedication}>
                +
              </Button>
            </div>
          </div>
        </div>

        {/* Recomendaciones Generales */}
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-1.5">
            Recomendaciones y Cuidados Especiales
          </label>
          <textarea
            rows={2}
            value={recomendaciones}
            onChange={(e) => setRecomendaciones(e.target.value)}
            className="w-full rounded-xl border border-[#E2E6EA] p-3 text-xs text-[#1E242B]"
          />
        </div>

        {/* Selector de modo de firma (RF-DOC-004) */}
        <div className="rounded-2xl bg-[#EEF7FF] border border-[#BFDBFE] p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#1E40AF]">
              Modo de Firma Digital del Odontólogo (RF-DOC-004)
            </p>
            <p className="text-[11px] text-[#3B82F6] mt-0.5">
              Si se desmarca, se generará el documento con el espacio en blanco para firma manuscrita y sello.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#1E40AF]">
            <input
              type="checkbox"
              checked={incluirFirmaDigital}
              onChange={(e) => setIncluirFirmaDigital(e.target.checked)}
              className="h-4 w-4 rounded text-[#3B82F6]"
            />
            Incrustar Firma Registrada (Flatten)
          </label>
        </div>
      </div>
    </Modal>
    </>
  );
};
