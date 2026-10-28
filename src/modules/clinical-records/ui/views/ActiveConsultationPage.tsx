// src/modules/clinical-records/ui/views/ActiveConsultationPage.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { EvolutionTemplateEditor, EvolutionFormData } from '../components/EvolutionTemplateEditor';
import { OdontogramCanvas } from '../components/OdontogramCanvas';
import { useClinicalRecord } from '../hooks/useClinicalRecord';
import { Button } from '../../../../shared/ui/components/Button';
import { Modal } from '../../../../shared/ui/components/Modal';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';
import { SparklesIcon } from '../../../../shared/ui/components/Icons';
import {
  DEFAULT_ANTECEDENTES_CLINICOS,
  DEFAULT_HABITOS_HIGIENE,
  DEFAULT_EXAMEN_ESTOMATOGNATICO,
  DEFAULT_PLAN_MANEJO,
} from '../../infrastructure/clinical-record.model';

export interface ActiveConsultationPageProps {
  idPaciente: number;
  idCita: number;
  patientName: string;
  patientDoc: string;
  patientPhone?: string;
  patientEmail?: string;
  patientAge?: number;
  patientSex?: string;
  doctorName?: string;
  treatmentTitle?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  onBackToAgenda: () => void;
  onFinishConsultation: (idCita: number) => void;
}

export const ActiveConsultationPage: React.FC<ActiveConsultationPageProps> = ({
  idPaciente,
  idCita,
  patientName,
  patientDoc,
  patientPhone = '',
  patientEmail = '',
  patientAge,
  patientSex,
  doctorName = 'Dr. Eduar Leal Álvarez',
  treatmentTitle = 'Atención y Valoración Odontológica',
  appointmentDate,
  appointmentTime,
  onBackToAgenda,
  onFinishConsultation,
}) => {
  const { history, currentOdontogram, isLoading, saveEvolutionEntry } = useClinicalRecord(idPaciente);
  const { showAlert, showConfirm, AlertModalComponent } = useAlertModal();

  // Modal de Odontograma Ampliado
  const [isExpandedOdontogramOpen, setIsExpandedOdontogramOpen] = useState(false);
  const [workingOdontogram, setWorkingOdontogram] = useState(currentOdontogram);

  // Sincronizar el odontograma al cargar
  useEffect(() => {
    if (currentOdontogram?.cuadrantes) {
      setWorkingOdontogram(currentOdontogram);
    }
  }, [currentOdontogram]);

  // Buscar si esta cita ya tiene evolución o si existe una previa para precargar
  const previousEvolution = useMemo(() => {
    if (!history || history.length === 0) return null;
    const sameCita = history.find((e) => Number(e.idCita) === Number(idCita));
    if (sameCita) return sameCita;
    const otherCita = history.find((e) => Number(e.idCita) !== Number(idCita));
    return otherCita || history[0];
  }, [history, idCita]);

  // Inicialización inteligente de datos (Precarga automática de la última consulta)
  const initialFormData = useMemo<Partial<EvolutionFormData>>(() => {
    const isSameCita = previousEvolution && Number(previousEvolution.idCita) === Number(idCita);

    if (isSameCita && previousEvolution) {
      // Reabriendo o editando la consulta actual
      return {
        motivoConsulta: previousEvolution.motivoConsulta || treatmentTitle || '',
        enfermedadActual: previousEvolution.enfermedadActual || '',
        antecedentesClinicos: previousEvolution.antecedentesClinicos || DEFAULT_ANTECEDENTES_CLINICOS,
        habitosHigiene: previousEvolution.habitosHigiene || DEFAULT_HABITOS_HIGIENE,
        examenEstomatognatico: previousEvolution.examenEstomatognatico || DEFAULT_EXAMEN_ESTOMATOGNATICO,
        examenFisicoObservaciones: previousEvolution.examenFisicoObservaciones || '',
        procedimientoRealizado: previousEvolution.procedimientoRealizado || '',
        diagnostico: previousEvolution.diagnostico || '',
        diagnosticoGenerado: previousEvolution.diagnosticoGenerado || previousEvolution.diagnostico || '',
        accionesARealizar: previousEvolution.accionesARealizar || '',
        observaciones: previousEvolution.observaciones || previousEvolution.hallazgosObservaciones || '',
        odontograma: previousEvolution.odontograma || workingOdontogram || currentOdontogram,
        planManejo: previousEvolution.planManejo || DEFAULT_PLAN_MANEJO,
      };
    }

    if (previousEvolution) {
      // Precarga automática desde la consulta previa para una NUEVA cita:
      return {
        motivoConsulta: treatmentTitle || '',
        enfermedadActual: '',
        antecedentesClinicos: previousEvolution.antecedentesClinicos || DEFAULT_ANTECEDENTES_CLINICOS,
        habitosHigiene: previousEvolution.habitosHigiene || DEFAULT_HABITOS_HIGIENE,
        examenEstomatognatico: previousEvolution.examenEstomatognatico || DEFAULT_EXAMEN_ESTOMATOGNATICO,
        examenFisicoObservaciones: previousEvolution.examenFisicoObservaciones || '',
        procedimientoRealizado: '',
        diagnostico: previousEvolution.diagnostico || '',
        diagnosticoGenerado: previousEvolution.diagnosticoGenerado || previousEvolution.diagnostico || '',
        accionesARealizar: previousEvolution.accionesARealizar || '',
        observaciones: '',
        odontograma: previousEvolution.odontograma || workingOdontogram || currentOdontogram,
        planManejo: previousEvolution.planManejo || DEFAULT_PLAN_MANEJO,
      };
    }

    // Primera vez que el paciente asiste (sin consultas previas)
    return {
      motivoConsulta: treatmentTitle || '',
      enfermedadActual: '',
      antecedentesClinicos: DEFAULT_ANTECEDENTES_CLINICOS,
      habitosHigiene: DEFAULT_HABITOS_HIGIENE,
      examenEstomatognatico: DEFAULT_EXAMEN_ESTOMATOGNATICO,
      examenFisicoObservaciones: '',
      procedimientoRealizado: '',
      diagnostico: '',
      diagnosticoGenerado: '',
      accionesARealizar: '',
      observaciones: '',
      odontograma: workingOdontogram || currentOdontogram,
      planManejo: DEFAULT_PLAN_MANEJO,
    };
  }, [previousEvolution, idCita, treatmentTitle, workingOdontogram, currentOdontogram]);

  // Fecha legible
  const displayDate = useMemo(() => {
    if (appointmentDate) return appointmentDate;
    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date());
  }, [appointmentDate]);

  // Hallazgos y notas clínicas reales del odontograma activo
  const toothNotes = useMemo(() => {
    const list: Array<{ fdi: number; zona: string; descripcion: string }> = [];
    if (workingOdontogram?.cuadrantes) {
      Object.values(workingOdontogram.cuadrantes).forEach((quadrant) => {
        if (quadrant?.piezas) {
          Object.values(quadrant.piezas).forEach((tooth) => {
            if (tooth.nota_clinica?.descripcion) {
              list.push({
                fdi: tooth.codigo_fdi,
                zona: tooth.nota_clinica.zona_afectada || 'General',
                descripcion: tooth.nota_clinica.descripcion,
              });
            } else if (tooth.simbolos_tecnicos) {
              const syms = tooth.simbolos_tecnicos;
              const activeSyms: string[] = [];
              if (syms.corona) activeSyms.push('Corona');
              if (syms.implante) activeSyms.push('Implante');
              if (syms.endodoncia) activeSyms.push('Endodoncia');
              if (syms.diente_extraido) activeSyms.push('Diente Extraído');
              if (syms.extraccion_requerida) activeSyms.push('Extracción Requerida');
              if (syms.protesis_fija) activeSyms.push('Prótesis Fija');
              if (syms.puente) activeSyms.push('Puente');
              if (activeSyms.length > 0) {
                list.push({
                  fdi: tooth.codigo_fdi,
                  zona: tooth.nombre_anatomico || `Pieza ${tooth.codigo_fdi}`,
                  descripcion: `Hallazgo clínico: ${activeSyms.join(', ')}.`,
                });
              }
            }
          });
        }
      });
    }
    return list;
  }, [workingOdontogram]);

  const handleOfficialSubmit = async (formData: EvolutionFormData) => {
    try {
      await saveEvolutionEntry({
        idCita,
        motivoConsulta: formData.motivoConsulta,
        enfermedadActual: formData.enfermedadActual,
        antecedentesClinicos: formData.antecedentesClinicos,
        habitosHigiene: formData.habitosHigiene,
        examenEstomatognatico: formData.examenEstomatognatico,
        examenFisicoObservaciones: formData.examenFisicoObservaciones,
        procedimientoRealizado: formData.procedimientoRealizado,
        diagnostico: formData.diagnostico,
        diagnosticoGenerado: formData.diagnosticoGenerado || formData.diagnostico,
        accionesARealizar: formData.accionesARealizar,
        observaciones: formData.observaciones,
        hallazgosObservaciones: formData.hallazgosObservaciones || formData.observaciones,
        odontograma: workingOdontogram || formData.odontograma,
        planManejo: formData.planManejo,
      });

      showAlert({
        title: '¡Evolución Registrada con Éxito!',
        message:
          'La evolución clínica, antecedentes, examen físico, plan de manejo y odontograma se han firmado y guardado inalterablemente en la Historia Clínica del paciente.',
        type: 'success',
        confirmText: 'Aceptar',
        onConfirm: () => onFinishConsultation(idCita),
      });
    } catch (err: any) {
      showAlert({
        title: 'No se pudo guardar la evolución clínica',
        message:
          err.message ||
          'Ocurrió un error al procesar el registro clínico. Por favor verifique los campos obligatorios e intente nuevamente.',
        type: 'error',
      });
    }
  };

  const handleFinishConsultationClick = () => {
    showConfirm({
      title: '¿Finalizar Atención de la Cita?',
      message:
        'Esta acción dará por concluida la consulta activa y registrará la cita como Atendida en la agenda médica sin registrar evolución.',
      confirmText: 'Sí, finalizar cita',
      cancelText: 'Volver a la consulta',
      onConfirm: () => onFinishConsultation(idCita),
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fadeIn">
      <AlertModalComponent />

      {/* Banner Informativo de Precarga Automática de Consulta Anterior */}
      {previousEvolution && Number(previousEvolution.idCita) !== Number(idCita) && (
        <div className="flex items-start sm:items-center gap-3 p-4 rounded-2xl bg-[#FBF6E6] border border-[#E9C765] text-xs text-[#111111]">
          <SparklesIcon size={20} color="#D4AF37" className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-black text-[#926C15] block">
              Precarga Automática de la Consulta Anterior ({previousEvolution.fechaRegistro})
            </strong>
            <p className="text-[#687380] text-[11px] mt-0.5">
              Se han precargado los antecedentes clínicos, hábitos higiénicos, examen físico estomatognático y el último odontograma registrado en el historial médico del paciente. Cada evolución es independiente y se guardará como un registro nuevo para esta cita.
            </p>
          </div>
        </div>
      )}

      {/* Editor Completo de Evolución con 5 Pestañas y Diseño Exacto */}
      <EvolutionTemplateEditor
        patientName={patientName}
        patientDoc={patientDoc}
        patientAge={patientAge}
        patientSex={patientSex}
        doctorName={doctorName}
        displayDate={displayDate}
        initialData={initialFormData}
        odontogram={workingOdontogram}
        onOdontogramChange={setWorkingOdontogram}
        onSubmitOfficial={handleOfficialSubmit}
        onOpenExpandedOdontogram={() => setIsExpandedOdontogramOpen(true)}
        onBackToDetail={onBackToAgenda}
      />

      {/* MODAL PANTALLA COMPLETA: Odontograma Clínico FDI - Modo Edición Ampliada */}
      <Modal
        isOpen={isExpandedOdontogramOpen}
        onClose={() => setIsExpandedOdontogramOpen(false)}
        maxWidth="full"
        title="Odontograma Clínico FDI — Modo Edición Ampliada"
        subtitle={`Paciente: ${patientName} • Odontólogo: ${doctorName}`}
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" onClick={() => setIsExpandedOdontogramOpen(false)}>
              ✕ Cerrar
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setIsExpandedOdontogramOpen(false);
                showAlert({
                  title: 'Odontograma Actualizado',
                  message:
                    'Los hallazgos y notas del odontograma ampliado se han aplicado correctamente a la consulta activa.',
                  type: 'success',
                });
              }}
              leftIcon={<span>✓</span>}
            >
              Guardar y Aplicar Cambios
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <OdontogramCanvas
            initialData={workingOdontogram}
            onChange={(updated) => setWorkingOdontogram(updated)}
            onSave={(updated) => setWorkingOdontogram(updated)}
          />

          {/* Tabla inferior de Observaciones y Notas Clínicas por Pieza Dental */}
          <div className="rounded-2xl border border-[#E7E7E3] bg-[#F6F6F4] p-4 space-y-2">
            <span className="text-xs font-black uppercase text-[#111111] block">
              Observaciones y Notas Clínicas por Pieza Dental
            </span>
            {toothNotes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {toothNotes.map((note) => (
                  <div key={note.fdi} className="p-2.5 rounded-xl bg-white border border-[#E7E7E3]">
                    <strong className="text-[#D4AF37]">
                      Pieza {note.fdi} ({note.zona}):
                    </strong>
                    <p className="text-[#687380] mt-0.5">{note.descripcion}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#8F99A3] italic py-2">
                No hay observaciones o notas clínicas registradas en piezas dentales. Al seleccionar y modificar piezas en el odontograma, aparecerán aquí.
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
