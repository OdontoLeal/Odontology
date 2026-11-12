// src/modules/clinical-records/ui/views/ClinicalHistoryListPage.tsx
import React, { useState } from 'react';
import { useClinicalRecord, ClinicalEvolutionEntry } from '../hooks/useClinicalRecord';
import { EvolutionDetailModal } from '../components/EvolutionDetailModal';
import { printCompleteClinicalHistory } from '../../application/print-clinical-history.service';
import { PatientListItem } from '../../../patients/ui/hooks/usePatients';
import { ClipboardIcon, PrinterIcon } from '../../../../shared/ui/components/Icons';
import {
  DetailAction,
  DetailPageContainer,
  DetailPageHeader,
  EmptyState,
  SectionCard,
  StatusBadge,
} from '../../../../shared/ui/components/DetailPage';

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
    sexo: 'Ambiguo',
    correo: '',
    telefono: '',
  };

  const handleDirectPrint = () => {
    printCompleteClinicalHistory({ patient: fullPatient, history });
  };

  const field = (label: string, value?: string | null) => (
    <div className="min-w-0 rounded-lg bg-[#F8FAFC] p-3.5">
      <p className="text-[13px] font-semibold text-[#64748B]">{label}</p>
      <p className="text-break mt-1 text-[14px] leading-6 text-[#1E242B]">{value || '—'}</p>
    </div>
  );

  return (
    <DetailPageContainer className="space-y-6">
      <DetailPageHeader
        backLabel="Volver a la Ficha del Paciente"
        onBack={onBack}
        title="Historial Clínico Integral"
        badge={<StatusBadge tone="gold">Resolución 1995 de 1999</StatusBadge>}
        subtitle={`Expediente médico de ${patientName} (C.C. ${patientDoc}) ordenado de forma cronológica inversa.`}
        actions={
          <DetailAction
            variant="primary"
            onClick={handleDirectPrint}
            disabled={history.length === 0}
            leftIcon={<PrinterIcon size={16} />}
          >
            Imprimir historia completa
          </DetailAction>
        }
      />

      {/* Línea de tiempo de evoluciones e inasistencias (RF-HCL-008) */}
      {isLoading ? (
        <EmptyState>Cargando historial clínico: notas de evolución y odontogramas del paciente...</EmptyState>
      ) : history.length > 0 ? (
        history.map((entry) => (
          <SectionCard
            key={entry.idEvolucion}
            icon={<ClipboardIcon />}
            title={entry.fechaRegistro || 'Fecha no registrada'}
            description={
              <>
                Atendido por: <strong className="font-semibold text-[#1E242B]">{entry.profesional.nombreCompleto}</strong>{' '}
                ({entry.profesional.rol})
                {entry.profesional.tarjetaProfesional && ` · TP: ${entry.profesional.tarjetaProfesional}`}
              </>
            }
            action={<StatusBadge tone="neutral">Atención finalizada · Inmutable</StatusBadge>}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
                {field('Motivo de consulta', entry.motivoConsulta)}
                {field('Diagnóstico (CIE-10)', entry.diagnostico)}
              </div>
              {field('Procedimiento realizado', entry.procedimientoRealizado)}
              <div className="flex justify-end">
                <DetailAction onClick={() => setSelectedEntry(entry)}>
                  Ver odontograma y detalle completo
                </DetailAction>
              </div>
            </div>
          </SectionCard>
        ))
      ) : (
        <EmptyState>
          Este paciente no tiene evoluciones clínicas asentadas todavía. Al finalizar una consulta
          médica en la agenda, se generará su primer registro formal.
        </EmptyState>
      )}

      {/* Visor de ficha detallada de evolución (compartido con la Ficha del Paciente) */}
      <EvolutionDetailModal
        evolution={selectedEntry}
        isOpen={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
      />
    </DetailPageContainer>
  );
};
