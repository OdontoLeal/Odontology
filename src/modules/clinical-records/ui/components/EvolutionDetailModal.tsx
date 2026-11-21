// src/modules/clinical-records/ui/components/EvolutionDetailModal.tsx
import React, { useState } from 'react';
import { ClinicalEvolutionEntry } from '../hooks/useClinicalRecord';
import { OdontogramCanvas } from './OdontogramCanvas';
import { Modal } from '../../../../shared/ui/components/Modal';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { AddClarificationNoteModal } from './AddClarificationNoteModal';
import { formatDateTimeCO } from '../../../../shared/ui/format';

export interface EvolutionDetailModalProps {
  evolution: ClinicalEvolutionEntry | null;
  isOpen: boolean;
  onClose: () => void;
  canAddClarificationNote?: boolean;
  onSaveClarificationNote?: (idCita: number, texto: string) => Promise<any>;
  patientName?: string;
}

export const EvolutionDetailModal: React.FC<EvolutionDetailModalProps> = ({
  evolution,
  isOpen,
  onClose,
  canAddClarificationNote = false,
  onSaveClarificationNote,
  patientName,
}) => {
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);

  if (!evolution) return null;

  const handleSaveClarification = async (texto: string) => {
    if (!evolution || !onSaveClarificationNote) return;
    const result = await onSaveClarificationNote(evolution.idCita, texto);
    const newNote = {
      idNota: String(result?.idNota || Date.now()),
      texto: result?.texto || texto,
      fechaRegistro: result?.fecha ? formatDateTimeCO(result.fecha) : formatDateTimeCO(new Date()),
      autor: result?.diligenciadoPor?.nombreUsuario || evolution.profesional.nombreCompleto,
    };
    if (!evolution.notasAclaratorias) {
      evolution.notasAclaratorias = [];
    }
    evolution.notasAclaratorias = [...evolution.notasAclaratorias, newNote];
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Evolución Clínica Odontológica"
      subtitle={`Atención del ${evolution.fechaRegistro} • ${evolution.profesional.nombreCompleto}`}
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Header del profesional tratante y estado inmutable */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA]">
          <div>
            <p className="text-xs font-extrabold text-[#1E242B]">
              👨‍⚕️ {evolution.profesional.nombreCompleto}
            </p>
            <p className="text-[13px] text-[#687380] mt-0.5">
              {evolution.profesional.rol}
              {evolution.profesional.tarjetaProfesional && ` • TP: ${evolution.profesional.tarjetaProfesional}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge label="Solo Lectura" variant="neutral" size="sm" />
            <Badge label="Registro Inmutable" variant="gold" size="sm" />
          </div>
        </div>

        {/* Motivo y Diagnóstico */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] space-y-1">
            <span className="font-extrabold text-[13px] uppercase tracking-wider text-[#8F99A3] block">
              1. Motivo de Consulta
            </span>
            <p className="text-[#1E242B] font-semibold leading-relaxed">
              {evolution.motivoConsulta || 'Consulta odontológica programada'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] space-y-1">
            <span className="font-extrabold text-[13px] uppercase tracking-wider text-[#8F99A3] block">
              Diagnóstico (CIE-10 / Presuntivo)
            </span>
            <p className="text-[#1E242B] font-semibold leading-relaxed">
              {evolution.diagnostico || 'Evaluación clínica general'}
            </p>
          </div>
        </div>

        {/* Enfermedad Actual */}
        {evolution.enfermedadActual && evolution.enfermedadActual !== 'N/A' && (
          <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] space-y-1 text-xs">
            <span className="font-extrabold text-[13px] uppercase tracking-wider text-[#8F99A3] block">
              Enfermedad Actual
            </span>
            <p className="text-[#4B5563] leading-relaxed whitespace-pre-line">
              {evolution.enfermedadActual}
            </p>
          </div>
        )}

        {/* Antecedentes Clínicos y Hábitos de Higiene */}
        {(evolution.antecedentesClinicos || evolution.habitosHigiene) && (
          <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] space-y-3 text-xs">
            <span className="font-extrabold text-[13px] uppercase tracking-wider text-[#8F99A3] block">
              2. Antecedentes Clínicos y Hábitos Bucodentales
            </span>

            {evolution.antecedentesClinicos && Object.keys(evolution.antecedentesClinicos).length > 0 && (
              <div className="space-y-2">
                <span className="font-bold text-[13px] text-[#1E242B] block">Antecedentes Registrados:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(evolution.antecedentesClinicos).map(([k, val]: [string, any]) => (
                    <div key={k} className="p-2.5 rounded-xl bg-white border border-[#E2E6EA] text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1E242B] capitalize">{k.replace(/_/g, ' ')}</span>
                        <Badge
                          label={val?.presenta ? 'Sí presenta' : 'No presenta'}
                          variant={val?.presenta ? 'danger' : 'neutral'}
                          size="sm"
                        />
                      </div>
                      {val?.observaciones && (
                        <p className="text-[13px] text-[#687380] mt-1 italic">{val.observaciones}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {evolution.habitosHigiene && Object.keys(evolution.habitosHigiene).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#E2E6EA]">
                <span className="font-bold text-[13px] text-[#1E242B] block">Hábitos y Rutina de Higiene:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {Object.entries(evolution.habitosHigiene).map(([k, val]: [string, any]) => (
                    <div key={k} className="p-2 rounded-xl bg-white border border-[#E2E6EA] text-[13px]">
                      <span className="font-bold text-[#1E242B] capitalize block">{k.replace(/_/g, ' ')}</span>
                      <span className="text-[#687380]">
                        {val?.aplica ? 'Aplica' : 'No aplica'} • {val?.frecuencia_cantidad || 'N/A'}
                      </span>
                      {val?.observaciones && (
                        <p className="text-[13px] text-[#8F99A3] mt-0.5 italic">{val.observaciones}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Examen Físico Estomatognático */}
        {(evolution.examenEstomatognatico || evolution.examenFisicoObservaciones) && (
          <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] space-y-3 text-xs">
            <span className="font-extrabold text-[13px] uppercase tracking-wider text-[#8F99A3] block">
              3. Examen Físico Estomatognático
            </span>

            {evolution.examenEstomatognatico && Object.keys(evolution.examenEstomatognatico).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(evolution.examenEstomatognatico).map(([k, val]: [string, any]) => (
                  <div key={k} className="p-2.5 rounded-xl bg-white border border-[#E2E6EA] text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1E242B] capitalize">{k.replace(/_/g, ' ')}</span>
                      <Badge
                        label={val?.presenta_anormalidades ? 'Anormalidad' : 'Normal'}
                        variant={val?.presenta_anormalidades ? 'warning' : 'neutral'}
                        size="sm"
                      />
                    </div>
                    {val?.observaciones && (
                      <p className="text-[13px] text-[#687380] mt-1">{val.observaciones}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {evolution.examenFisicoObservaciones && (
              <div className="pt-2 border-t border-[#E2E6EA]">
                <span className="font-bold text-[13px] text-[#1E242B] block">Observaciones Generales:</span>
                <p className="text-[#4B5563] text-xs leading-relaxed whitespace-pre-line mt-0.5">
                  {evolution.examenFisicoObservaciones}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Procedimiento Realizado */}
        <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] space-y-1 text-xs">
          <span className="font-extrabold text-[13px] uppercase tracking-wider text-[#8F99A3] block">
            4. Procedimiento Realizado
          </span>
          <p className="text-[#1E242B] font-medium leading-relaxed whitespace-pre-line">
            {evolution.procedimientoRealizado || 'Sin procedimiento detallado'}
          </p>
        </div>

        {/* Observaciones Clínicas */}
        {evolution.observaciones && (
          <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] space-y-1 text-xs">
            <span className="font-extrabold text-[13px] uppercase tracking-wider text-[#8F99A3] block">
              Hallazgos y Observaciones Clínicas
            </span>
            <p className="text-[#4B5563] leading-relaxed whitespace-pre-line">
              {evolution.observaciones}
            </p>
          </div>
        )}

        {/* Acciones a Realizar / Recomendaciones */}
        {evolution.accionesARealizar && (
          <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] space-y-1 text-xs">
            <span className="font-extrabold text-[13px] uppercase tracking-wider text-[#8F99A3] block">
              Acciones a Realizar / Plan de Tratamiento
            </span>
            <p className="text-[#4B5563] leading-relaxed whitespace-pre-line">
              {evolution.accionesARealizar}
            </p>
          </div>
        )}

        {/* Plan de Manejo y Conducta */}
        {evolution.planManejo && (
          <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] space-y-3 text-xs">
            <span className="font-extrabold text-[13px] uppercase tracking-wider text-[#8F99A3] block">
              5. Plan de Manejo y Conducta
            </span>

            {evolution.planManejo.conducta && (
              <div>
                <span className="font-bold text-[13px] text-[#1E242B] block">Conducta y Recomendaciones:</span>
                <p className="text-[#4B5563] leading-relaxed whitespace-pre-line mt-0.5">
                  {evolution.planManejo.conducta}
                </p>
              </div>
            )}

            {Array.isArray(evolution.planManejo.prescripcion_farmacologica) &&
              evolution.planManejo.prescripcion_farmacologica.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-[#E2E6EA]">
                  <span className="font-bold text-[13px] text-[#1E242B] block">💊 Prescripción Farmacológica:</span>
                  <div className="space-y-1.5">
                    {evolution.planManejo.prescripcion_farmacologica.map((med: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-xl bg-white border border-[#E2E6EA] flex flex-wrap justify-between items-center text-xs">
                        <span className="font-bold text-[#1E242B]">
                          {med.medicamento_principio_activo} {med.dosis_concentracion}
                        </span>
                        <span className="text-[#687380]">
                          {med.frecuencia_via} • {med.duracion_tratamiento}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {evolution.planManejo.incapacidad_medica?.requiere_incapacidad && (
              <div className="p-3 rounded-xl bg-white border border-[#E2E6EA] space-y-1 text-xs">
                <span className="font-bold text-[#1E242B] block">🛌 Incapacidad Médica Otorgada:</span>
                <p className="text-[#687380]">
                  Vigencia: {evolution.planManejo.incapacidad_medica.fecha_inicio} al {evolution.planManejo.incapacidad_medica.fecha_culminacion}
                </p>
                {evolution.planManejo.incapacidad_medica.diagnostico_justificacion && (
                  <p className="text-[#4B5563] italic mt-1">
                    {evolution.planManejo.incapacidad_medica.diagnostico_justificacion}
                  </p>
                )}
              </div>
            )}

            {evolution.planManejo.remision_medica?.requiere_remision && (
              <div className="p-3 rounded-xl bg-white border border-[#E2E6EA] space-y-1 text-xs">
                <span className="font-bold text-[#1E242B] block">↗️ Remisión Médica:</span>
                <p className="text-[#687380]">
                  Destino: {evolution.planManejo.remision_medica.especialidad_destino} (Prioridad: {evolution.planManejo.remision_medica.prioridad_atencion})
                </p>
                {evolution.planManejo.remision_medica.motivo_resumen_clinico && (
                  <p className="text-[#4B5563] italic mt-1">
                    {evolution.planManejo.remision_medica.motivo_resumen_clinico}
                  </p>
                )}
              </div>
            )}

            {Array.isArray(evolution.planManejo.documentos) && evolution.planManejo.documentos.length > 0 && (
              <div className="pt-2 flex flex-wrap gap-2 border-t border-[#E2E6EA]">
                {evolution.planManejo.documentos.map((doc: any, i: number) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-white border border-[#CBD2D9] font-bold text-[#1E242B] text-[13px]">
                    📄 {doc.tipoDocumento === 'ORDEN_MEDICAMENTOS' ? 'Fórmula / Receta' : doc.tipoDocumento === 'INCAPACIDAD' ? 'Incapacidad' : 'Remisión'}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Odontograma Clínico en Modo Lectura */}
        {evolution.odontograma && (
          <div className="space-y-2 pt-2 border-t border-[#E2E6EA]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase text-[#1E242B]">
                Estado del Odontograma en esta consulta:
              </span>
              <span className="text-[13px] text-[#8F99A3] italic">
                Modo Lectura • Simbología FDI Inalterable
              </span>
            </div>
            <div className="p-2 sm:p-3 rounded-2xl bg-white border border-[#E2E6EA] overflow-hidden">
              <OdontogramCanvas
                key={evolution.idEvolucion}
                initialData={evolution.odontograma}
                readOnly={true}
              />
            </div>
          </div>
        )}

        {/* 6. Notas Aclaratorias Post-Cierre (Resolución 1995 de 1999 / RF-HCL-009) */}
        <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-extrabold text-[13px] uppercase tracking-wider text-[#8F99A3] block">
              6. Notas Aclaratorias Post-Cierre (Resolución 1995 de 1999)
            </span>
            {evolution.notasAclaratorias && evolution.notasAclaratorias.length > 0 ? (
              <Badge
                label={`${evolution.notasAclaratorias.length} registrada${
                  evolution.notasAclaratorias.length > 1 ? 's' : ''
                }`}
                variant="gold"
                size="sm"
              />
            ) : (
              <Badge label="Sin aclaraciones" variant="neutral" size="sm" />
            )}
          </div>

          {evolution.notasAclaratorias && evolution.notasAclaratorias.length > 0 ? (
            <div className="space-y-2">
              {evolution.notasAclaratorias.map((nota, i) => (
                <div
                  key={nota.idNota || i}
                  className="p-3.5 rounded-xl bg-white border border-[#E2E6EA] space-y-2 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                    <span className="font-bold text-[#1E242B] flex items-center gap-1.5">
                      👨‍⚕️ {nota.autor || evolution.profesional.nombreCompleto}
                    </span>
                    <span className="text-[#64748B]">{nota.fechaRegistro}</span>
                  </div>
                  <p className="text-[#1E242B] text-xs leading-relaxed whitespace-pre-line border-t border-[#F1F3F5] pt-2">
                    {nota.texto}
                  </p>
                  <div className="flex justify-end pt-1">
                    <span className="text-[11px] font-semibold text-[#D4AF37] italic">
                      Inmutable · Folio Aditivo (Res. 1995/1999)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#8F99A3] text-xs italic">
              Esta consulta no cuenta con notas aclaratorias registradas con posterioridad a su cierre.
            </p>
          )}
        </div>

        {/* Footer: Acción para agregar nota aclaratoria + botón para cerrar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E2E6EA]">
          {canAddClarificationNote && onSaveClarificationNote ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsAddNoteModalOpen(true)}
            >
              ➕ Agregar Nota Aclaratoria
            </Button>
          ) : (
            <div />
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar Visualización
          </Button>
        </div>
      </div>

      {/* Modal especializado para registrar nota aclaratoria */}
      {canAddClarificationNote && onSaveClarificationNote && (
        <AddClarificationNoteModal
          isOpen={isAddNoteModalOpen}
          onClose={() => setIsAddNoteModalOpen(false)}
          idCita={evolution.idCita}
          evolutionDate={evolution.fechaRegistro}
          patientName={patientName}
          onSave={handleSaveClarification}
        />
      )}
    </Modal>
  );
};
