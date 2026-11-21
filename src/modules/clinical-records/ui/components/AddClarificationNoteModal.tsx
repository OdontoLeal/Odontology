// src/modules/clinical-records/ui/components/AddClarificationNoteModal.tsx
import React, { useState, useEffect } from 'react';
import { Modal } from '../../../../shared/ui/components/Modal';
import { Button } from '../../../../shared/ui/components/Button';
import { ShieldIcon, FileTextIcon } from '../../../../shared/ui/components/Icons';

export interface AddClarificationNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  idCita: number;
  evolutionDate?: string;
  patientName?: string;
  onSave: (texto: string) => Promise<void>;
}

export const AddClarificationNoteModal: React.FC<AddClarificationNoteModalProps> = ({
  isOpen,
  onClose,
  idCita: _idCita,
  evolutionDate,
  patientName,
  onSave,
}) => {
  const [texto, setTexto] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTexto('');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const trimmed = texto.trim();
  const isValid = trimmed.length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setErrorMessage('La nota aclaratoria debe tener al menos 10 caracteres explicativos.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onSave(trimmed);
      onClose();
    } catch (err: any) {
      console.error('Error al guardar nota aclaratoria:', err);
      setErrorMessage(err.message || 'No se pudo guardar la nota aclaratoria. Intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="Agregar Nota Aclaratoria"
      subtitle={
        evolutionDate
          ? `Folio de evolución del ${evolutionDate}${patientName ? ` • Paciente: ${patientName}` : ''}`
          : 'Corrección o adición formal posterior al cierre de la atención'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Advertencia médico-legal obligatoria (Resolución 1995 de 1999) */}
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#FEFCE8] border border-[#FEF08A] text-xs">
          <ShieldIcon size={20} color="#CA8A04" className="shrink-0 mt-0.5" />
          <div className="space-y-1 text-[#713F12]">
            <strong className="block font-bold">
              Inmutabilidad y Validez Legal (Resolución 1995 de 1999 / Ley 23 de 1981)
            </strong>
            <p className="leading-relaxed">
              Las consultas finalizadas son de solo lectura. Las notas aclaratorias se anexan de forma permanente e inalterable al expediente médico con su nombre, fecha y hora exacta de registro.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
            {errorMessage}
          </div>
        )}

        {/* Campo de texto de la nota */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="notaAclaratoriaInput" className="font-bold text-[#1E242B] flex items-center gap-1.5">
              <FileTextIcon size={14} color="#687380" />
              Texto de la Nota Aclaratoria:
            </label>
            <span
              className={`text-[11px] font-semibold ${
                trimmed.length < 10 ? 'text-[#8F99A3]' : 'text-[#15803D]'
              }`}
            >
              {trimmed.length} / mín. 10 caracteres
            </span>
          </div>

          <textarea
            id="notaAclaratoriaInput"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={isSubmitting}
            placeholder="Describa con precisión la aclaración, salvedad médica o información complementaria de la atención realizada..."
            rows={5}
            className="w-full p-3 rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#1E242B] placeholder-[#94A3B8] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] focus:outline-none disabled:bg-[#F8FAFC] disabled:cursor-not-allowed resize-none leading-relaxed"
          />
        </div>

        {/* Footer de acciones */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[#E2E6EA]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!isValid || isSubmitting}
            isLoading={isSubmitting}
          >
            {isSubmitting ? 'Guardando...' : 'Guardar Nota Aclaratoria'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
