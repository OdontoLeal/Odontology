// src/modules/clinical-records/ui/views/ClinicalHistoryListPage.tsx
import React, { useState } from 'react';
import { useClinicalRecord, ClinicalEvolutionEntry } from '../hooks/useClinicalRecord';
import { EvolutionDetailModal } from '../components/EvolutionDetailModal';
import { printCompleteClinicalHistory } from '../../application/print-clinical-history.service';
import { PatientListItem } from '../../../patients/ui/hooks/usePatients';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';

export interface ClinicalHistoryListPageProps {
  idPaciente: number;
  patientName: string;
  patientDoc: string;
  patientData?: PatientListItem;
  onBack: () => void;
}

export const ClinicalHistoryListPage: React.FC<ClinicalHistoryListPageProps> = ({
  idPaciente,
  patientName,
  patientDoc,
  patientData,
  onBack,
}) => {
  const { history, isLoading } = useClinicalRecord(idPaciente);
  const [selectedEntry, setSelectedEntry] = useState<ClinicalEvolutionEntry | null>(null);

  // Garantizar objeto PatientListItem completo
  const fullPatient: PatientListItem = patientData || {
    idPaciente,
    nombreCompleto: patientName,
    documentoIdentidad: patientDoc,
    fechaNacimiento: '',
    sexo: 'Indeterminado',
    correo: '',
    telefono: '',
  };

  const handleDirectPrint = () => {
    printCompleteClinicalHistory({
      patient: fullPatient,
      history,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fadeIn">
      {/* Botón Volver e Imprimir */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#687380] hover:text-[#1E242B] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver al Paciente
        </button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleDirectPrint}
          leftIcon={<span>🖨️</span>}
        >
          Imprimir Historia Completa
        </Button>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E242B]">
            Historial Clínico Integral
          </h1>
          <Badge label="Resolución 1995 de 1999" variant="gold" size="sm" />
        </div>
        <p className="mt-1 text-xs sm:text-sm text-[#687380]">
          Expediente médico de {patientName} (CC {patientDoc}) ordenado de forma cronológica inversa.
        </p>
      </div>

      {/* Timeline de Evoluciones e Inasistencias (RF-HCL-008) */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-12 rounded-3xl bg-white border border-[#E2E6EA] text-center space-y-4 shadow-2xs">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-[#FFFBEB] text-[#D4AF37] flex items-center justify-center border border-[#FDE68A]">
              <div className="w-5 h-5 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-sm font-bold text-[#1E242B]">Cargando historial clínico...</p>
            <p className="text-xs text-[#687380]">Consultando notas de evolución y odontogramas del paciente...</p>
          </div>
        ) : history.length > 0 ? (
          history.map((entry) => (
            <div
              key={entry.idEvolucion}
              className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs space-y-4 hover:border-[#D4AF37] transition-all"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-[#E2E6EA]">
                <div>
                  <span className="text-sm font-extrabold text-[#1E242B]">
                    📅 {entry.fechaRegistro}
                  </span>
                  <p className="text-xs text-[#687380]">
                    Atendido por: <strong>{entry.profesional.nombreCompleto}</strong> ({entry.profesional.rol})
                    {entry.profesional.tarjetaProfesional && ` • TP: ${entry.profesional.tarjetaProfesional}`}
                  </p>
                </div>
                <Badge label="Atención Finalizada • Inmutable" variant="neutral" size="sm" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
                  <strong className="text-[#1E242B] block mb-1">Motivo de Consulta:</strong>
                  <p className="text-[#4B5563]">{entry.motivoConsulta}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
                  <strong className="text-[#1E242B] block mb-1">Diagnóstico (CIE-10):</strong>
                  <p className="text-[#4B5563]">{entry.diagnostico}</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA] text-xs">
                <strong className="text-[#1E242B] block mb-1">Procedimiento Realizado:</strong>
                <p className="text-[#4B5563] leading-relaxed">{entry.procedimientoRealizado}</p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedEntry(entry)}
                  leftIcon={<span>🔍</span>}
                >
                  Ver Odontograma y Detalle Completo
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-[#E2E6EA] bg-white p-12 text-center space-y-3">
            <span className="text-3xl">📋</span>
            <h3 className="text-base font-extrabold text-[#1E242B]">
              Sin registros en la Historia Clínica
            </h3>
            <p className="text-xs text-[#687380] max-w-md mx-auto">
              Este paciente no tiene evoluciones clínicas asentadas todavía. Al finalizar una consulta médica en la agenda, se generará su primer registro formal.
            </p>
          </div>
        )}
      </div>

      {/* Modal Visor de Ficha Detallada de Evolución (Compartido con Ficha del Paciente) */}
      <EvolutionDetailModal
        evolution={selectedEntry}
        isOpen={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
};
