// src/modules/clinical-records/ui/components/EvolutionTemplateEditor.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  OdontogramDataDTO,
  AntecedentesClinicosDTO,
  HabitosHigieneDTO,
  ExamenEstomatognaticoDTO,
  PlanManejoDTO,
  DEFAULT_ANTECEDENTES_CLINICOS,
  DEFAULT_HABITOS_HIGIENE,
  DEFAULT_EXAMEN_ESTOMATOGNATICO,
  DEFAULT_PLAN_MANEJO,
} from '../../infrastructure/clinical-record.model';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';
import { printClinicalDocument } from '../../../clinical-documents/application/print-clinical-document.service';
import {
  UserIcon,
  CalendarIcon,
  DoctorIcon,
  SaveIcon,
} from '../../../../shared/ui/components/Icons';
import { AnamnesisTab } from './tabs/AnamnesisTab';
import { MedicalBackgroundTab } from './tabs/MedicalBackgroundTab';
import { PhysicalExamTab } from './tabs/PhysicalExamTab';
import { FindingsProcedureTab } from './tabs/FindingsProcedureTab';
import { ManagementPlanTab } from './tabs/ManagementPlanTab';

export type EvolutionTab =
  | 'ENTRADA'
  | 'ANTECEDENTES'
  | 'EXAMEN_FISICO'
  | 'HALLAZGOS_PROCEDIMIENTO'
  | 'PLAN_MANEJO';

export interface EvolutionFormData {
  motivoConsulta: string;
  enfermedadActual: string;
  antecedentesClinicos: AntecedentesClinicosDTO;
  habitosHigiene: HabitosHigieneDTO;
  examenEstomatognatico: ExamenEstomatognaticoDTO;
  examenFisicoObservaciones?: string;
  procedimientoRealizado: string;
  diagnostico: string;
  diagnosticoGenerado?: string;
  accionesARealizar: string;
  observaciones: string;
  hallazgosObservaciones?: string;
  odontograma: OdontogramDataDTO;
  planManejo: PlanManejoDTO;
  antecedentes?: any;
  examenFisico?: any;
}

export interface EvolutionTemplateEditorProps {
  initialData?: Partial<EvolutionFormData>;
  patientName: string;
  patientAge?: number;
  patientSex?: string;
  patientDoc?: string;
  doctorName?: string;
  doctorSignature?: string | null;
  doctorRole?: string;
  displayDate?: string;
  readOnly?: boolean;
  odontogram?: OdontogramDataDTO;
  onOdontogramChange?: (data: OdontogramDataDTO) => void;
  onSaveDraft?: (data: EvolutionFormData) => void;
  onSubmitOfficial?: (data: EvolutionFormData) => void;
  onOpenExpandedOdontogram?: () => void;
  onBackToDetail?: () => void;
}

function countAffectedTeeth(odontogram?: OdontogramDataDTO): number {
  if (!odontogram?.cuadrantes) return 0;
  let count = 0;
  for (const q of Object.values(odontogram.cuadrantes)) {
    if (!q?.piezas) continue;
    for (const t of Object.values(q.piezas)) {
      let hasFinding = false;
      if (t?.caras) {
        for (const c of Object.values(t.caras)) {
          if (c?.caries_activa || c?.restauracion_resina || c?.sellante_fosas || c?.desgaste_faceta) {
            hasFinding = true;
            break;
          }
        }
      }
      if (!hasFinding && t?.simbolos_tecnicos) {
        const s = t.simbolos_tecnicos;
        if (s.diente_extraido || s.extraccion_requerida || s.corona || s.endodoncia || s.implante) {
          hasFinding = true;
        }
      }
      if (hasFinding) count++;
    }
  }
  return count;
}

export const EvolutionTemplateEditor: React.FC<EvolutionTemplateEditorProps> = ({
  initialData,
  patientName,
  patientAge,
  patientSex,
  patientDoc,
  doctorName = 'Profesional Odontológico',
  doctorSignature,
  doctorRole = 'Odontología General',
  displayDate,
  readOnly = false,
  odontogram: propOdontogram,
  onOdontogramChange,
  onSubmitOfficial,
  onOpenExpandedOdontogram,
  onBackToDetail,
}) => {
  const [activeTab, setActiveTab] = useState<EvolutionTab>('ENTRADA');
  const [motivoConsulta, setMotivoConsulta] = useState(initialData?.motivoConsulta || '');
  const [enfermedadActual, setEnfermedadActual] = useState(initialData?.enfermedadActual || '');
  const [antecedentesClinicos, setAntecedentesClinicos] = useState<AntecedentesClinicosDTO>(
    initialData?.antecedentesClinicos || initialData?.antecedentes || DEFAULT_ANTECEDENTES_CLINICOS
  );
  const [habitosHigiene, setHabitosHigiene] = useState<HabitosHigieneDTO>(
    initialData?.habitosHigiene || DEFAULT_HABITOS_HIGIENE
  );
  const [examenEstomatognatico, setExamenEstomatognatico] = useState<ExamenEstomatognaticoDTO>(
    initialData?.examenEstomatognatico || initialData?.examenFisico || DEFAULT_EXAMEN_ESTOMATOGNATICO
  );
  const [examenFisicoObservaciones, setExamenFisicoObservaciones] = useState(
    initialData?.examenFisicoObservaciones || ''
  );
  const [procedimientoRealizado, setProcedimientoRealizado] = useState(
    initialData?.procedimientoRealizado || ''
  );
  const [diagnostico, setDiagnostico] = useState(
    initialData?.diagnostico || initialData?.diagnosticoGenerado || ''
  );
  const [accionesARealizar, setAccionesARealizar] = useState(initialData?.accionesARealizar || '');
  const [observaciones, setObservaciones] = useState(
    initialData?.observaciones || initialData?.hallazgosObservaciones || ''
  );
  const [localOdontogram, setLocalOdontogram] = useState<OdontogramDataDTO>(
    initialData?.odontograma as any
  );
  const activeOdontogram = propOdontogram || localOdontogram || (initialData?.odontograma as any);

  const [planManejo, setPlanManejo] = useState<PlanManejoDTO>(
    initialData?.planManejo || DEFAULT_PLAN_MANEJO
  );
  const [conductaPlanManejo, setConductaPlanManejo] = useState(
    initialData?.planManejo?.conducta || ''
  );

  const { showAlert, showConfirm, AlertModalComponent } = useAlertModal();

  useEffect(() => {
    if (!initialData) return;
    if (initialData.motivoConsulta !== undefined) setMotivoConsulta(initialData.motivoConsulta);
    if (initialData.enfermedadActual !== undefined) setEnfermedadActual(initialData.enfermedadActual);
    if (initialData.antecedentesClinicos !== undefined || initialData.antecedentes !== undefined) {
      setAntecedentesClinicos(
        initialData.antecedentesClinicos || initialData.antecedentes || DEFAULT_ANTECEDENTES_CLINICOS
      );
    }
    if (initialData.habitosHigiene !== undefined) {
      setHabitosHigiene(initialData.habitosHigiene || DEFAULT_HABITOS_HIGIENE);
    }
    if (initialData.examenEstomatognatico !== undefined || initialData.examenFisico !== undefined) {
      setExamenEstomatognatico(
        initialData.examenEstomatognatico || initialData.examenFisico || DEFAULT_EXAMEN_ESTOMATOGNATICO
      );
    }
    if (initialData.examenFisicoObservaciones !== undefined) {
      setExamenFisicoObservaciones(initialData.examenFisicoObservaciones);
    }
    if (initialData.procedimientoRealizado !== undefined) {
      setProcedimientoRealizado(initialData.procedimientoRealizado);
    }
    if (initialData.diagnostico !== undefined || initialData.diagnosticoGenerado !== undefined) {
      setDiagnostico(initialData.diagnostico || initialData.diagnosticoGenerado || '');
    }
    if (initialData.accionesARealizar !== undefined) {
      setAccionesARealizar(initialData.accionesARealizar);
    }
    if (initialData.observaciones !== undefined || initialData.hallazgosObservaciones !== undefined) {
      setObservaciones(initialData.observaciones || initialData.hallazgosObservaciones || '');
    }
    if (initialData.odontograma !== undefined) {
      setLocalOdontogram(initialData.odontograma);
    }
    if (initialData.planManejo !== undefined) {
      setPlanManejo(initialData.planManejo || DEFAULT_PLAN_MANEJO);
      setConductaPlanManejo(initialData.planManejo?.conducta || '');
    }
  }, [initialData]);

  const affectedTeethCount = useMemo(() => countAffectedTeeth(activeOdontogram), [activeOdontogram]);

  const formattedDate = useMemo(() => {
    if (displayDate) return displayDate;
    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date());
  }, [displayDate]);

  const getFullFormData = (): EvolutionFormData => ({
    motivoConsulta,
    enfermedadActual,
    antecedentesClinicos: antecedentesClinicos || DEFAULT_ANTECEDENTES_CLINICOS,
    habitosHigiene: habitosHigiene || DEFAULT_HABITOS_HIGIENE,
    examenEstomatognatico: examenEstomatognatico || DEFAULT_EXAMEN_ESTOMATOGNATICO,
    examenFisicoObservaciones,
    procedimientoRealizado,
    diagnostico,
    diagnosticoGenerado: diagnostico,
    accionesARealizar,
    observaciones,
    hallazgosObservaciones: observaciones,
    odontograma: activeOdontogram,
    planManejo: {
      ...planManejo,
      conducta: conductaPlanManejo,
    },
    antecedentes: antecedentesClinicos || DEFAULT_ANTECEDENTES_CLINICOS,
    examenFisico: examenEstomatognatico || DEFAULT_EXAMEN_ESTOMATOGNATICO,
  });

  const handleSubmit = () => {
    if (!motivoConsulta.trim()) {
      showAlert({
        title: 'Campo Obligatorio Faltante',
        message: 'El Motivo de Consulta es obligatorio conforme a la normativa médica.',
        type: 'warning',
      });
      setActiveTab('ENTRADA');
      return;
    }
    if (!procedimientoRealizado.trim()) {
      showAlert({
        title: 'Campo Obligatorio Faltante',
        message: 'El Procedimiento Realizado es obligatorio para certificar la atención odontológica.',
        type: 'warning',
      });
      setActiveTab('HALLAZGOS_PROCEDIMIENTO');
      return;
    }
    onSubmitOfficial?.(getFullFormData());
  };

  const handleDiscardChanges = () => {
    showConfirm({
      title: '¿Descartar Cambios?',
      message: 'Se perderán las modificaciones no guardadas de la evolución clínica actual.',
      confirmText: 'Sí, descartar',
      cancelText: 'Volver a la edición',
      onConfirm: () => onBackToDetail?.(),
    });
  };

  const handlePrintDocument = (tipo: 'RECETA' | 'INCAPACIDAD' | 'REMISION') => {
    if (tipo === 'RECETA') {
      const meds = planManejo.prescripcion_farmacologica || [];
      if (meds.length === 0) {
        showAlert({
          title: 'Prescripción vacía',
          message: 'Debe agregar al menos un medicamento a la prescripción farmacológica antes de imprimir.',
          type: 'warning',
        });
        return;
      }
      printClinicalDocument({
        tipo: 'RECETA',
        patientName,
        patientDoc,
        patientAge,
        patientSex,
        doctorName,
        doctorSignature,
        doctorRole,
        displayDate: formattedDate,
        diagnostico,
        procedimiento: procedimientoRealizado,
        medications: meds,
      });
      return;
    }

    if (tipo === 'INCAPACIDAD') {
      if (!planManejo.incapacidad_medica?.requiere_incapacidad) {
        showAlert({
          title: 'Incapacidad no requerida',
          message: 'Marque "¿Requiere Incapacidad?" como Sí y diligencie las fechas antes de imprimir.',
          type: 'warning',
        });
        return;
      }
      let dias = 1;
      if (planManejo.incapacidad_medica.fecha_inicio && planManejo.incapacidad_medica.fecha_culminacion) {
        const start = new Date(planManejo.incapacidad_medica.fecha_inicio).getTime();
        const end = new Date(planManejo.incapacidad_medica.fecha_culminacion).getTime();
        const diff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
        if (diff > 0) dias = diff;
      }
      printClinicalDocument({
        tipo: 'INCAPACIDAD',
        patientName,
        patientDoc,
        patientAge,
        patientSex,
        doctorName,
        doctorSignature,
        doctorRole,
        displayDate: formattedDate,
        diagnostico,
        procedimiento: procedimientoRealizado,
        incapacidad: {
          dias_incapacidad: dias,
          fecha_inicio: planManejo.incapacidad_medica.fecha_inicio,
          fecha_fin: planManejo.incapacidad_medica.fecha_culminacion,
          diagnostico_cie10: diagnostico || planManejo.incapacidad_medica.diagnostico_justificacion,
          observaciones: planManejo.incapacidad_medica.diagnostico_justificacion,
        },
      });
      return;
    }

    if (tipo === 'REMISION') {
      if (!planManejo.remision_medica?.requiere_remision) {
        showAlert({
          title: 'Remisión no requerida',
          message: 'Marque "¿Requiere Remisión?" como Sí y seleccione la especialidad destino antes de imprimir.',
          type: 'warning',
        });
        return;
      }
      printClinicalDocument({
        tipo: 'REMISION',
        patientName,
        patientDoc,
        patientAge,
        patientSex,
        doctorName,
        doctorSignature,
        doctorRole,
        displayDate: formattedDate,
        diagnostico,
        procedimiento: procedimientoRealizado,
        remision: {
          especialidad_destino: planManejo.remision_medica.especialidad_destino || 'Especialista Odontológico',
          motivo_remision: planManejo.remision_medica.motivo_resumen_clinico || '',
          resumen_clinico: `Prioridad: ${planManejo.remision_medica.prioridad_atencion || 'Programada / Ordinaria'}. ${procedimientoRealizado ? `Procedimiento: ${procedimientoRealizado}.` : ''}`,
        },
      });
    }
  };

  const tabsConfig: { id: EvolutionTab; label: string }[] = [
    { id: 'ENTRADA', label: '1. Anamnesis' },
    { id: 'ANTECEDENTES', label: '2. Antecedentes' },
    { id: 'EXAMEN_FISICO', label: '3. Examen Físico' },
    { id: 'HALLAZGOS_PROCEDIMIENTO', label: '4. Hallazgos y Procedimiento' },
    { id: 'PLAN_MANEJO', label: '5. Plan de Manejo' },
  ];

  return (
    <div className="space-y-6">
      <AlertModalComponent />

      {/* ENCABEZADO SUPERIOR */}
      <div className="space-y-4">
        {onBackToDetail && (
          <button
            type="button"
            onClick={onBackToDetail}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#687380] hover:text-[#111111] transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a la Agenda
          </button>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h1 className="text-2xl font-black text-[#111111] tracking-tight">Nueva Evolución</h1>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F6F6F4] border border-[#E7E7E3] text-xs font-bold text-[#111111]">
                <UserIcon size={14} className="text-[#687380]" />
                <span>
                  {patientName}
                  {patientAge !== undefined ? ` | ${patientAge} años` : ''}
                  {patientSex ? ` | ${patientSex}` : ''}
                  {patientDoc ? ` (CC: ${patientDoc})` : ''}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#687380]">
              <span className="flex items-center gap-1.5">
                <CalendarIcon size={14} color="#D4AF37" /> {formattedDate}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 font-semibold text-[#111111]">
                <DoctorIcon size={14} color="#D4AF37" /> {doctorName}
              </span>
            </div>
          </div>

          {!readOnly && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-black font-black text-xs shadow-sm hover:shadow transition-all cursor-pointer"
              >
                <SaveIcon size={16} color="#000000" />
                Guardar y finalizar cita
              </button>
            </div>
          )}
        </div>

        {/* BARRA DE PESTAÑAS */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-white border border-[#E7E7E3] shadow-xs">
          {tabsConfig.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'bg-[#111111] text-white shadow-xs'
                  : 'text-[#687380] hover:text-[#111111] hover:bg-[#F6F6F4]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* PESTAÑA 1 */}
      {activeTab === 'ENTRADA' && (
        <AnamnesisTab
          motivoConsulta={motivoConsulta}
          enfermedadActual={enfermedadActual}
          readOnly={readOnly}
          onMotivoConsultaChange={setMotivoConsulta}
          onEnfermedadActualChange={setEnfermedadActual}
          onNextTab={() => setActiveTab('ANTECEDENTES')}
        />
      )}

      {/* PESTAÑA 2 */}
      {activeTab === 'ANTECEDENTES' && (
        <MedicalBackgroundTab
          antecedentesClinicos={antecedentesClinicos}
          habitosHigiene={habitosHigiene}
          readOnly={readOnly}
          onChange={(bgs, hbts) => {
            setAntecedentesClinicos(bgs);
            setHabitosHigiene(hbts);
          }}
          onPrevTab={() => setActiveTab('ENTRADA')}
          onNextTab={() => setActiveTab('EXAMEN_FISICO')}
        />
      )}

      {/* PESTAÑA 3 */}
      {activeTab === 'EXAMEN_FISICO' && (
        <PhysicalExamTab
          examenEstomatognatico={examenEstomatognatico}
          examenFisicoObservaciones={examenFisicoObservaciones}
          readOnly={readOnly}
          onChange={(structs, notes) => {
            setExamenEstomatognatico(structs);
            setExamenFisicoObservaciones(notes);
          }}
          onPrevTab={() => setActiveTab('ANTECEDENTES')}
          onNextTab={() => setActiveTab('HALLAZGOS_PROCEDIMIENTO')}
        />
      )}

      {/* PESTAÑA 4 */}
      {activeTab === 'HALLAZGOS_PROCEDIMIENTO' && (
        <FindingsProcedureTab
          activeOdontogram={activeOdontogram}
          affectedTeethCount={affectedTeethCount}
          readOnly={readOnly}
          procedimientoRealizado={procedimientoRealizado}
          diagnostico={diagnostico}
          accionesARealizar={accionesARealizar}
          observaciones={observaciones}
          onProcedimientoChange={setProcedimientoRealizado}
          onDiagnosticoChange={setDiagnostico}
          onAccionesChange={setAccionesARealizar}
          onObservacionesChange={setObservaciones}
          onOdontogramSave={(data) => {
            setLocalOdontogram(data);
            onOdontogramChange?.(data);
          }}
          onOpenExpandedOdontogram={onOpenExpandedOdontogram}
          onDiscardChanges={handleDiscardChanges}
          onNextTab={() => setActiveTab('PLAN_MANEJO')}
        />
      )}

      {/* PESTAÑA 5 */}
      {activeTab === 'PLAN_MANEJO' && (
        <ManagementPlanTab
          planManejo={planManejo}
          conductaPlanManejo={conductaPlanManejo}
          readOnly={readOnly}
          onPlanManejoChange={setPlanManejo}
          onConductaChange={setConductaPlanManejo}
          onPrintDocument={handlePrintDocument}
          onDiscardChanges={handleDiscardChanges}
          onPrevTab={() => setActiveTab('HALLAZGOS_PROCEDIMIENTO')}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
};
