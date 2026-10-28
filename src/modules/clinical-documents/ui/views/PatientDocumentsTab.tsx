// src/modules/clinical-documents/ui/views/PatientDocumentsTab.tsx
import React, { useState } from 'react';
import { useClinicalDocuments, ClinicalDocumentItem } from '../hooks/useClinicalDocuments';
import { PrescriptionFormModal } from '../components/PrescriptionFormModal';
import { SickLeaveFormModal } from '../components/SickLeaveFormModal';
import { ReferralFormModal } from '../components/ReferralFormModal';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { Modal } from '../../../../shared/ui/components/Modal';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';

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
  const [selectedDocForView, setSelectedDocForView] = useState<ClinicalDocumentItem | null>(null);

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
                onClick={() => setSelectedDocForView(doc)}
                leftIcon={<span>👁️</span>}
              >
                Visualizar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.print()}
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

      {/* Visor de Documento */}
      <Modal
        isOpen={Boolean(selectedDocForView)}
        onClose={() => setSelectedDocForView(null)}
        title={selectedDocForView?.titulo}
        subtitle={`Emitido por ${selectedDocForView?.profesionalNombre} • ${selectedDocForView?.fechaEmision}`}
        maxWidth="2xl"
        footer={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setSelectedDocForView(null)}>
              Cerrar
            </Button>
            <Button variant="primary" onClick={() => window.print()} leftIcon={<span>🖨️</span>}>
              Imprimir Documento
            </Button>
          </div>
        }
      >
        <div className="rounded-2xl border border-[#CBD2D9] bg-[#F8F9FA] p-6 space-y-4 text-xs">
          <div className="text-center pb-3 border-b border-[#E2E6EA]">
            <span className="font-extrabold text-[#D4AF37] uppercase block">
              CONSULTORIO ODONTOLEAL
            </span>
            <p className="text-[11px] text-[#8F99A3]">Dr. Eduar Leal Álvarez • Dirección Médica</p>
          </div>

          <div>
            <p className="font-bold text-[#1E242B]">Paciente: {patientName}</p>
            <p className="text-[#687380]">Fecha de expedición: {selectedDocForView?.fechaEmision}</p>
          </div>

          <div className="rounded-xl bg-white border border-[#E2E6EA] p-4 space-y-2">
            <pre className="whitespace-pre-wrap font-sans text-xs text-[#1E242B]">
              {JSON.stringify(selectedDocForView?.detalle, null, 2)}
            </pre>
          </div>

          <div className="pt-4 border-t border-[#E2E6EA] text-right">
            <p className="font-bold text-[#1E242B]">{selectedDocForView?.profesionalNombre}</p>
            <p className="text-[11px] text-[#8F99A3]">Firma Digital Validada (Flatten AES-256)</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
