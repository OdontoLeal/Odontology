// src/modules/clinical-records/ui/views/ActiveConsultationPage.tsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  DetailPageContainer,
  EmptyState,
  SECTION_CARD_CLASS,
  SectionCardHeader,
} from '../../../../shared/ui/components/DetailPage';
import { ToothIcon as SectionToothIcon } from '../../../../shared/ui/components/Icons';
import { formatLongDateCO } from '../../../../shared/ui/format';
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
  doctorSignature?: string | null;
  doctorRole?: string;
  treatmentTitle?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  onBackToAgenda: () => void;
  onFinishConsultation: (idCita: number) => void;
  /** RF-AGE-009: solo el profesional responsable finaliza la atención (la auxiliar solo guarda). */
  canFinishAttention?: boolean;
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
  doctorSignature = null,
  doctorRole = 'Odontólogo General',
  treatmentTitle = '',
  appointmentDate,
  appointmentTime,
  onBackToAgenda,
  onFinishConsultation,
  canFinishAttention = false,
}) => {
  const { history, currentOdontogram, isLoading, saveEvolutionEntry } = useClinicalRecord(idPaciente, '/api/v1', idCita);
  const { showAlert, showConfirm, AlertModalComponent } = useAlertModal();

  // Datos del doctor asignado a la cita (asociación y firma digital del profesional)
  const [attendingDoctor, setAttendingDoctor] = useState<{
    name: string;
    signature: string | null;
    role: string;
  }>({
    name: doctorName,
    signature: doctorSignature,
    role: doctorRole,
  });

  // Resolver el doctor real que atendió o tiene asignada la cita desde la BD y su firma digital
  useEffect(() => {
    let isMounted = true;
    if (doctorName && doctorSignature) {
      setAttendingDoctor({
        name: doctorName,
        signature: doctorSignature,
        role: doctorRole,
      });
    }

    if (idCita) {
      fetch('/api/v1/appointments/agenda')
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (!isMounted) return;
          const list: any[] = json?.data || [];
          const match = list.find((a: any) => Number(a.idCita) === Number(idCita));
          if (match && match.nombreProfesional) {
            setAttendingDoctor((prev) => ({
              name: match.nombreProfesional || prev.name,
              signature: match.firmaProfesional ?? prev.signature,
              role: prev.role,
            }));
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [idCita, doctorName, doctorSignature, doctorRole]);

  // Modal de Odontograma Ampliado
  const [isExpandedOdontogramOpen, setIsExpandedOdontogramOpen] = useState(false);
  const [workingOdontogram, setWorkingOdontogram] = useState(currentOdontogram);

  // Buscar si esta cita ya tiene evolución o si existe una previa para precargar
  const previousEvolution = useMemo(() => {
    if (!history || history.length === 0) return null;
    const sameCita = history.find((e) => Number(e.idCita) === Number(idCita));
    if (sameCita) return sameCita;
    const otherCita = history.find((e) => Number(e.idCita) !== Number(idCita));
    return otherCita || history[0];
  }, [history, idCita]);

  // Sincronizar el odontograma al cargar (precarga inteligente del odontograma anterior si existe)
  useEffect(() => {
    if (previousEvolution?.odontograma?.cuadrantes) {
      setWorkingOdontogram(previousEvolution.odontograma);
    } else if (currentOdontogram?.cuadrantes) {
      setWorkingOdontogram(currentOdontogram);
    }
  }, [previousEvolution, currentOdontogram]);

  // Si la evolución previa ya tiene datos del profesional que atendió, sincronizarlos
  useEffect(() => {
    if (previousEvolution?.profesional?.nombreCompleto) {
      setAttendingDoctor((prev) => ({
        name: previousEvolution.profesional.nombreCompleto || prev.name,
        signature: previousEvolution.profesional.firmaBase64 ?? prev.signature,
        role: previousEvolution.profesional.rol || prev.role,
      }));
    }
  }, [previousEvolution]);

  // Inicialización inteligente de datos (Precarga automática de la última consulta)
  const initialFormData = useMemo<Partial<EvolutionFormData>>(() => {
    const isSameCita = previousEvolution && Number(previousEvolution.idCita) === Number(idCita);

    if (isSameCita && previousEvolution) {
      // Reabriendo o editando la consulta actual
      return {
        motivoConsulta: previousEvolution.motivoConsulta || '',
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
        odontograma: previousEvolution.odontograma || currentOdontogram,
        planManejo: previousEvolution.planManejo || DEFAULT_PLAN_MANEJO,
      };
    }

    if (previousEvolution) {
      // Precarga automática desde la consulta previa para una NUEVA cita:
      return {
        motivoConsulta: '',
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
        odontograma: previousEvolution.odontograma || currentOdontogram,
        planManejo: previousEvolution.planManejo || DEFAULT_PLAN_MANEJO,
      };
    }

    // Primera vez que el paciente asiste (sin consultas previas)
    return {
      motivoConsulta: '',
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
      odontograma: currentOdontogram,
      planManejo: DEFAULT_PLAN_MANEJO,
    };
  }, [previousEvolution, idCita, currentOdontogram]);

  // Fecha legible
  const displayDate = useMemo(() => {
    if (appointmentDate) return formatLongDateCO(appointmentDate);
    return formatLongDateCO(new Date());
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

      if (canFinishAttention) {
        // RF-AGE-009: finalizar es una decisión explícita del profesional responsable
        showConfirm({
          title: 'Registro clínico guardado',
          message:
            '¿Desea finalizar la atención? La cita pasará a "Atendida" y la historia de esta consulta quedará en solo lectura (las correcciones posteriores se hacen con notas aclaratorias).',
          confirmText: 'Finalizar atención',
          cancelText: 'Seguir en la consulta',
          onConfirm: () => onFinishConsultation(idCita),
        });
      } else {
        showAlert({
          title: 'Registro clínico guardado',
          message: 'Los cambios quedaron en la historia clínica de esta consulta con su nombre como "Diligenciado por".',
          type: 'success',
          confirmText: 'Aceptar',
        });
      }
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


  return (
    <DetailPageContainer className="space-y-6">
      <AlertModalComponent />

      {/* Banner Informativo de Precarga Automática de Consulta Anterior */}
      {previousEvolution && Number(previousEvolution.idCita) !== Number(idCita) && (
        <div className="flex items-start gap-3 rounded-xl border border-[#E9C765] bg-[#FBF6E6] p-4 text-[14px] text-[#111111]">
          <SparklesIcon size={20} color="#D4AF37" className="shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <strong className="block font-bold text-[#926C15]">
              Precarga Automática de la Consulta Anterior ({previousEvolution.fechaRegistro})
            </strong>
            <p className="text-[#687380] text-[13px] mt-0.5">
              Se han precargado los antecedentes clínicos, hábitos higiénicos, examen físico estomatognático y el último odontograma registrado en el historial médico del paciente. Cada evolución es independiente y se guardará como un registro nuevo para esta cita.
            </p>
          </div>
        </div>
      )}

      {/* Editor Completo de Evolución con 5 Pestañas y Diseño Exacto */}
      <EvolutionTemplateEditor
        idPaciente={idPaciente}
        idCita={idCita}
        patientName={patientName}
        patientDoc={patientDoc}
        patientAge={patientAge}
        patientSex={patientSex}
        doctorName={attendingDoctor.name}
        doctorSignature={attendingDoctor.signature}
        doctorRole={attendingDoctor.role}
        displayDate={displayDate}
        initialData={initialFormData}
        odontogram={workingOdontogram}
        onOdontogramChange={setWorkingOdontogram}
        onSaveDraft={async (formData) => {
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
        }}
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
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
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
          />

          {/* Tabla inferior de Observaciones y Notas Clínicas por Pieza Dental */}
          <div className={SECTION_CARD_CLASS}>
            <SectionCardHeader title="Observaciones y Notas Clínicas por Pieza Dental" icon={<SectionToothIcon />} />
            {toothNotes.length > 0 ? (
              <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-3 gap-3 text-[14px]">
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
              <EmptyState>
                No hay observaciones o notas clínicas registradas en piezas dentales. Al seleccionar y modificar piezas en el odontograma, aparecerán aquí.
              </EmptyState>
            )}
          </div>
        </div>
      </Modal>
    </DetailPageContainer>
  );
};
