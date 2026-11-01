// src/modules/clinical-documents/ui/views/PatientDocumentsTab.tsx
import React, { useState } from 'react';
import { useClinicalDocuments, ClinicalDocumentItem } from '../hooks/useClinicalDocuments';
import { PrescriptionFormModal } from '../components/PrescriptionFormModal';
import { SickLeaveFormModal } from '../components/SickLeaveFormModal';
import { ReferralFormModal } from '../components/ReferralFormModal';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';
import { printClinicalDocument } from '../../application/print-clinical-document.service';

export interface PatientDocumentsTabProps {
  idPaciente: number;
  patientName: string;
  doctorName?: string;
}

export const PatientDocumentsTab: React.FC<PatientDocumentsTabProps> = ({
  idPaciente,
  patientName,
  doctorName = 'Dr. Eduar Leal Álvarez',
}) => {
  const { documents, addDocument } = useClinicalDocuments(idPaciente);
  const { showAlert, AlertModalComponent } = useAlertModal();

  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [isSickLeaveModalOpen, setIsSickLeaveModalOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);

  const handlePrintItem = (doc: ClinicalDocumentItem) => {
    if (doc.tipoDocumento === 'FORMULA') {
      const meds = Array.isArray(doc.detalle?.medicamentos)
        ? doc.detalle.medicamentos.map((m: any) => ({
            medicamento_principio_activo: m.nombre || m.medicamento_principio_activo || '',
            dosis_concentracion: m.dosis || m.dosis_concentracion || '',
            frecuencia_via: m.frecuencia || m.frecuencia_via || '',
            duracion_tratamiento: m.duracion || m.duracion_tratamiento || '',
          }))
        : [];
      printClinicalDocument({
        tipo: 'RECETA',
        patientName,
        doctorName: doc.profesionalNombre || doctorName,
        doctorSignature: doc.detalle?.doctorSignature || (doc as any).firmaProfesional || null,
        displayDate: doc.fechaEmision,
        medications: meds,
      });
    } else if (doc.tipoDocumento === 'INCAPACIDAD') {
      printClinicalDocument({
        tipo: 'INCAPACIDAD',
        patientName,
        doctorName: doc.profesionalNombre || doctorName,
        doctorSignature: doc.detalle?.doctorSignature || (doc as any).firmaProfesional || null,
        displayDate: doc.fechaEmision,
        diagnostico: doc.detalle?.diagnostico || doc.detalle?.diagnostico_justificacion,
        incapacidad: {
          dias_incapacidad: doc.detalle?.diasIncapacidad || doc.detalle?.dias_incapacidad,
          fecha_inicio: doc.detalle?.fechaInicio || doc.detalle?.fecha_inicio,
          fecha_fin: doc.detalle?.fechaFin || doc.detalle?.fecha_culminacion,
          diagnostico_cie10: doc.detalle?.diagnostico,
          observaciones: doc.detalle?.justificacion || doc.detalle?.observaciones,
        },
      });
    } else if (doc.tipoDocumento === 'REMISION') {
      printClinicalDocument({
        tipo: 'REMISION',
        patientName,
        doctorName: doc.profesionalNombre || doctorName,
        doctorSignature: doc.detalle?.doctorSignature || (doc as any).firmaProfesional || null,
        displayDate: doc.fechaEmision,
        remision: {
          especialidad_destino: doc.detalle?.especialidadDestino || doc.detalle?.especialidad_destino,
          motivo_remision: doc.detalle?.motivoResumen || doc.detalle?.motivo_resumen_clinico,
          resumen_clinico: doc.detalle?.prioridad ? `Prioridad: ${doc.detalle.prioridad}` : undefined,
        },
      });
    }
  };

  const getDocBadge = (tipo: ClinicalDocumentItem['tipoDocumento']) => {
    switch (tipo) {
      case 'FORMULA':
        return <Badge label="Fórmula Médica" variant="success" size="sm" />;
      case 'INCAPACIDAD':
        return <Badge label="Incapacidad Laboral" variant="warning" size="sm" />;
      case 'REMISION':
        return <Badge label="Remisión Especializada" variant="info" size="sm" />;
    }
  };

  return (
    <div className="space-y-6">
      <AlertModalComponent />
      {/* Botones para generar documentos */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-[#1E242B]">
            Documentos Clínicos Derivados
          </h3>
          <p className="text-xs text-[#8F99A3]">
            Prescripciones de medicamentos, incapacidades laborales y remisiones extramurales.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPrescriptionModalOpen(true)}
            leftIcon={<span>💊</span>}
          >
            Nueva Receta
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsSickLeaveModalOpen(true)}
            leftIcon={<span>🛌</span>}
          >
            Nueva Incapacidad
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsReferralModalOpen(true)}
            leftIcon={<span>↗️</span>}
          >
            Nueva Remisión
          </Button>
        </div>
      </div>

      {/* Lista de Documentos */}
      <div className="space-y-3">
        {documents.map((doc) => (
          <div
            key={doc.idDocumento}
            className="rounded-2xl border border-[#E2E6EA] bg-white p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {getDocBadge(doc.tipoDocumento)}
                <h4 className="text-sm font-extrabold text-[#1E242B]">
                  {doc.titulo}
                </h4>
              </div>
              <p className="text-xs text-[#687380]">
                Emitido el {doc.fechaEmision} por <strong>{doc.profesionalNombre}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePrintItem(doc)}
                leftIcon={<span>🖨️</span>}
              >
                Imprimir
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Modales de Formulación */}
      <PrescriptionFormModal
        isOpen={isPrescriptionModalOpen}
        onClose={() => setIsPrescriptionModalOpen(false)}
        patientName={patientName}
        doctorName={doctorName}
        onSavePrescription={(data) => {
          addDocument({
            tipoDocumento: 'FORMULA',
            titulo: 'Fórmula Médica Odontológica',
            fechaEmision: new Date().toISOString().replace('T', ' ').slice(0, 16),
            profesionalNombre: doctorName,
            idPaciente,
            firmadoDigitalmente: data.incluirFirmaDigital,
            detalle: data,
          });
          showAlert({
            title: 'Fórmula Médica Generada',
            message: 'La fórmula médica ha sido creada y firmada digitalmente con éxito (RF-DOC-001).',
            type: 'success',
          });
        }}
      />

      <SickLeaveFormModal
        isOpen={isSickLeaveModalOpen}
        onClose={() => setIsSickLeaveModalOpen(false)}
        patientName={patientName}
        onSaveSickLeave={(data) => {
          addDocument({
            tipoDocumento: 'INCAPACIDAD',
            titulo: `Incapacidad Médica Laboral (${data.diasIncapacidad} días)`,
            fechaEmision: new Date().toISOString().replace('T', ' ').slice(0, 16),
            profesionalNombre: doctorName,
            idPaciente,
            firmadoDigitalmente: data.incluirFirma,
            detalle: data,
          });
          showAlert({
            title: 'Incapacidad Médica Emitida',
            message: 'El certificado de incapacidad ha sido emitido y archivado en el expediente clínico (RF-DOC-002).',
            type: 'success',
          });
        }}
      />

      <ReferralFormModal
        isOpen={isReferralModalOpen}
        onClose={() => setIsReferralModalOpen(false)}
        patientName={patientName}
        onSaveReferral={(data) => {
          addDocument({
            tipoDocumento: 'REMISION',
            titulo: `Remisión a ${data.especialidadDestino}`,
            fechaEmision: new Date().toISOString().replace('T', ' ').slice(0, 16),
            profesionalNombre: doctorName,
            idPaciente,
            firmadoDigitalmente: data.incluirFirma,
            detalle: data,
          });
          showAlert({
            title: 'Remisión Generada',
            message: 'La orden de remisión especializada ha sido generada exitosamente (RF-DOC-003).',
            type: 'success',
          });
        }}
      />

    </div>
  );
};
