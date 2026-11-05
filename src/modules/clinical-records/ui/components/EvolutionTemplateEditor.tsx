// src/modules/clinical-records/ui/components/EvolutionTemplateEditor.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  DetailAction,
  DetailPageHeader,
  StatusBadge,
  UserAvatar,
} from '../../../../shared/ui/components/DetailPage';
import { formatLongDateCO } from '../../../../shared/ui/format';
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
import { downloadClinicalDocument } from '../../../clinical-documents/ui/hooks/useClinicalDocuments';
import {
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
  /** Cita y paciente de la consulta: el PDF lo genera el servidor (RF-DOC-001 a 004). */
  idPaciente?: number;
  idCita?: number;
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
  idPaciente,
  idCita,
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
    return formatLongDateCO(new Date());
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

  /**
   * RF-DOC-001 a RF-DOC-004: el documento lo genera el servidor en memoria, con la firma
   * del profesional fusionada (flatten), y se abre para imprimir o descargar al momento.
   * El servidor no conserva el archivo. Requiere la apertura guardada (motivo de consulta).
   */
  const handlePrintDocument = async (tipo: 'RECETA' | 'INCAPACIDAD' | 'REMISION') => {
    if (!idPaciente || !idCita) {
      showAlert({ title: 'Consulta no identificada', message: 'Abra el documento desde la consulta en curso.', type: 'warning' });
      return;
    }

    let tipoDocumento: 'ORDEN_MEDICAMENTOS' | 'INCAPACIDAD' | 'REMISION';
    let detalles: Record<string, unknown>;

    if (tipo === 'RECETA') {
      const meds = planManejo.prescripcion_farmacologica || [];
      if (meds.length === 0) {
        showAlert({
          title: 'Prescripción vacía',
          message: 'Debe agregar al menos un medicamento a la prescripción farmacológica.',
          type: 'warning',
        });
        return;
      }
      tipoDocumento = 'ORDEN_MEDICAMENTOS';
      detalles = {
        medicamentos: meds.map((m: any) => ({
          nombrePresentacion: m.medicamento_principio_activo,
          dosis: m.dosis_concentracion,
          frecuencia: m.frecuencia_via,
          duracion: m.duracion_tratamiento,
        })),
        indicacionesAdicionales: meds.map((m: any) => m.indicaciones_adicionales).filter(Boolean).join(' · ') || undefined,
      };
    } else if (tipo === 'INCAPACIDAD') {
      if (!planManejo.incapacidad_medica?.requiere_incapacidad) {
        showAlert({
          title: 'Incapacidad no requerida',
          message: 'Marque "¿Requiere Incapacidad?" como Sí y diligencie las fechas.',
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
      tipoDocumento = 'INCAPACIDAD';
      detalles = {
        diasIncapacidad: dias,
        motivoIncapacidad: planManejo.incapacidad_medica.diagnostico_justificacion || diagnostico,
      };
    } else {
      if (!planManejo.remision_medica?.requiere_remision) {
        showAlert({
          title: 'Remisión no requerida',
          message: 'Marque "¿Requiere Remisión?" como Sí y seleccione la especialidad destino.',
          type: 'warning',
        });
        return;
      }
      tipoDocumento = 'REMISION';
      detalles = {
        especialidadDestino: planManejo.remision_medica.especialidad_destino,
        otraEspecialidad: planManejo.remision_medica.otra_especialidad_nombre ?? undefined,
        motivoRemision: planManejo.remision_medica.motivo_resumen_clinico || '',
      };
    }

    try {
      const warning = await downloadClinicalDocument({ idPaciente, idCita, tipoDocumento, detalles });
      if (warning) {
        showAlert({ title: 'Documento generado', message: warning, type: 'warning' });
      }
    } catch (err: any) {
      showAlert({ title: 'No se generó el documento', message: err.message, type: 'error' });
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
      <div>
        <DetailPageHeader
          backLabel={onBackToDetail ? 'Volver a la Agenda' : undefined}
          onBack={onBackToDetail}
          title="Nueva Evolución"
          badge={<StatusBadge tone={readOnly ? 'neutral' : 'dark'}>{readOnly ? 'Solo lectura' : 'Consulta en curso'}</StatusBadge>}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <CalendarIcon size={14} color="#D4AF37" /> {formattedDate}
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#1E242B]">
                <DoctorIcon size={14} color="#D4AF37" /> {doctorName}
              </span>
            </span>
          }
          meta={
            <div className="inline-flex max-w-full items-center gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-[#E2E8F0]">
              <UserAvatar name={patientName} size="sm" />
              <span className="text-break min-w-0 text-[14px] text-[#1E242B]">
                <strong className="font-semibold">{patientName}</strong>
                <span className="text-[#64748B]">
                  {patientAge !== undefined ? ` · ${patientAge} años` : ''}
                  {patientSex ? ` · ${patientSex}` : ''}
                  {patientDoc ? ` · C.C. ${patientDoc}` : ''}
                </span>
              </span>
            </div>
          }
          actions={
            !readOnly ? (
              <DetailAction
                variant="primary"
                onClick={handleSubmit}
                leftIcon={<SaveIcon size={16} color="#111111" />}
              >
                Guardar y finalizar cita
              </DetailAction>
            ) : undefined
          }
        />

        {/* BARRA DE PESTAÑAS */}
        <div role="tablist" aria-label="Secciones de la evolución" className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white p-1.5">
          {tabsConfig.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              role="tab"
              aria-selected={activeTab === t.id}
              className={`min-h-[44px] flex-[1_1_auto] rounded-lg px-4 py-2 text-[14px] font-semibold transition-all cursor-pointer md:min-h-[40px] md:flex-none ${
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
