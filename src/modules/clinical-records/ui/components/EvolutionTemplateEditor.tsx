// src/modules/clinical-records/ui/components/EvolutionTemplateEditor.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { OdontogramCanvas } from './OdontogramCanvas';
import { MedicalBackgroundForm } from './MedicalBackgroundForm';
import { StomatognathicExamForm } from './StomatognathicExamForm';
import { Badge } from '../../../../shared/ui/components/Badge';
import {
  OdontogramDataDTO,
  AntecedentesClinicosDTO,
  HabitosHigieneDTO,
  ExamenEstomatognaticoDTO,
  PlanManejoDTO,
  PrescripcionItemDTO,
  DEFAULT_ANTECEDENTES_CLINICOS,
  DEFAULT_HABITOS_HIGIENE,
  DEFAULT_EXAMEN_ESTOMATOGNATICO,
  DEFAULT_PLAN_MANEJO,
} from '../../infrastructure/clinical-record.model';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';
import {
  UserIcon,
  CalendarIcon,
  DoctorIcon,
  ToothIcon,
  PillIcon,
  BedIcon,
  StethoscopeIcon,
  PrinterIcon,
  SparklesIcon,
  SaveIcon,
} from '../../../../shared/ui/components/Icons';

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
  displayDate?: string;
  readOnly?: boolean;
  odontogram?: OdontogramDataDTO;
  onOdontogramChange?: (data: OdontogramDataDTO) => void;
  onSaveDraft?: (data: EvolutionFormData) => void;
  onSubmitOfficial?: (data: EvolutionFormData) => void;
  onOpenExpandedOdontogram?: () => void;
  onBackToDetail?: () => void;
}

// Utilidad para contar piezas dentales que tengan hallazgos clínicos
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
        if (
          s.diente_extraido ||
          s.extraccion_requerida ||
          s.corona ||
          s.implante ||
          s.protesis_fija ||
          s.endodoncia ||
          s.puente
        ) {
          hasFinding = true;
        }
      }
      if (!hasFinding && t?.nota_clinica?.descripcion) {
        hasFinding = true;
      }
      if (hasFinding) {
        count++;
      }
    }
  }
  return count;
}

export const EvolutionTemplateEditor: React.FC<EvolutionTemplateEditorProps> = ({
  initialData,
  patientName,
  patientAge,
  patientSex,
  patientDoc = '',
  doctorName = 'Dr. Eduar Leal Álvarez',
  displayDate,
  readOnly = false,
  odontogram: propOdontogram,
  onOdontogramChange,
  onSaveDraft,
  onSubmitOfficial,
  onOpenExpandedOdontogram,
  onBackToDetail,
}) => {
  const { showAlert, showConfirm, AlertModalComponent } = useAlertModal();
  const [activeTab, setActiveTab] = useState<EvolutionTab>('ENTRADA');

  // Tab 1: Entrada / Anamnesis
  const [motivoConsulta, setMotivoConsulta] = useState(initialData?.motivoConsulta || '');
  const [enfermedadActual, setEnfermedadActual] = useState(initialData?.enfermedadActual || '');

  // Tab 2: Antecedentes Clínicos y Hábitos
  const [antecedentesClinicos, setAntecedentesClinicos] = useState<AntecedentesClinicosDTO>(
    initialData?.antecedentesClinicos || initialData?.antecedentes || DEFAULT_ANTECEDENTES_CLINICOS
  );
  const [habitosHigiene, setHabitosHigiene] = useState<HabitosHigieneDTO>(
    initialData?.habitosHigiene || DEFAULT_HABITOS_HIGIENE
  );

  // Tab 3: Examen Físico Estomatognático
  const [examenEstomatognatico, setExamenEstomatognatico] = useState<ExamenEstomatognaticoDTO>(
    initialData?.examenEstomatognatico || initialData?.examenFisico || DEFAULT_EXAMEN_ESTOMATOGNATICO
  );
  const [examenFisicoObservaciones, setExamenFisicoObservaciones] = useState(
    initialData?.examenFisicoObservaciones || ''
  );

  // Tab 4: Hallazgos y Procedimiento
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

  // Odontograma local si no viene controlado por prop
  const [localOdontogram, setLocalOdontogram] = useState<OdontogramDataDTO>(
    initialData?.odontograma as any
  );

  const activeOdontogram = propOdontogram || localOdontogram || (initialData?.odontograma as any);

  // Tab 5: Plan de Manejo y Conducta
  const [planManejo, setPlanManejo] = useState<PlanManejoDTO>(
    initialData?.planManejo || DEFAULT_PLAN_MANEJO
  );
  const [conductaPlanManejo, setConductaPlanManejo] = useState(
    initialData?.planManejo?.conducta || ''
  );

  // Sincronizar datos si initialData se actualiza asíncronamente
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

  // Conteo reactivo de piezas con hallazgos
  const affectedTeethCount = useMemo(() => {
    return countAffectedTeeth(activeOdontogram);
  }, [activeOdontogram]);

  // Opciones rápidas de autocompletado (Pestaña 1)
  const quickReasons = [
    'Tengo un dolor de muela muy fuerte',
    'Se me cayó una calza',
    'Vengo para una limpieza dental de rutina',
    'Se me partió un diente',
    'Me sangran las encías al cepillarme',
    'Siento los dientes destemplados con el frío o el calor',
    'Vengo a revisión general',
    'Se me despegó un bracket',
    'Me chuzan los alambres',
    'Vengo a ponerme una calza',
    'La prótesis no me queda bien',
    'Quiero hacerme un blanqueamiento dental',
  ];

  const handleAutofillNA = () => {
    setEnfermedadActual(
      'N/A - Consulta preventiva o de rutina sin patología dolorosa activa referida por el paciente.'
    );
  };

  // Manejo de medicamentos en Tab 5
  const handleAddMedication = (preset?: Partial<PrescripcionItemDTO>) => {
    if (readOnly) return;
    const newMed: PrescripcionItemDTO = {
      medicamento_principio_activo: preset?.medicamento_principio_activo || '',
      dosis_concentracion: preset?.dosis_concentracion || '',
      frecuencia_via: preset?.frecuencia_via || 'Cada 8 horas (Vía Oral)',
      duracion_tratamiento: preset?.duracion_tratamiento || '5 a 7 días',
    };
    const currentMeds = Array.isArray(planManejo.prescripcion_farmacologica)
      ? [...planManejo.prescripcion_farmacologica]
      : [];
    setPlanManejo({
      ...planManejo,
      prescripcion_farmacologica: [...currentMeds, newMed],
    });
  };

  const handleUpdateMedication = (
    index: number,
    field: keyof PrescripcionItemDTO,
    val: string
  ) => {
    if (readOnly) return;
    const currentMeds = [...(planManejo.prescripcion_farmacologica || [])];
    if (currentMeds[index]) {
      currentMeds[index] = { ...currentMeds[index], [field]: val };
      setPlanManejo({ ...planManejo, prescripcion_farmacologica: currentMeds });
    }
  };

  const handleRemoveMedication = (index: number) => {
    if (readOnly) return;
    const currentMeds = [...(planManejo.prescripcion_farmacologica || [])];
    currentMeds.splice(index, 1);
    setPlanManejo({ ...planManejo, prescripcion_farmacologica: currentMeds });
  };

  // Generador de estructura completa
  const getFullFormData = (): EvolutionFormData => {
    const finalPlanManejo: PlanManejoDTO = {
      conducta: conductaPlanManejo,
      prescripcion_farmacologica: Array.isArray(planManejo?.prescripcion_farmacologica)
        ? planManejo.prescripcion_farmacologica
        : [],
      incapacidad_medica: planManejo?.incapacidad_medica ?? {
        requiere_incapacidad: false,
        fecha_inicio: '',
        fecha_culminacion: '',
        diagnostico_justificacion: '',
      },
      remision_medica: planManejo?.remision_medica ?? {
        requiere_remision: false,
        especialidad_destino: '',
        prioridad_atencion: 'Ordinaria / Consulta Externa',
        motivo_resumen_clinico: '',
      },
      documentos: Array.isArray(planManejo?.documentos) ? planManejo.documentos : [],
    };

    return {
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
      planManejo: finalPlanManejo,
      antecedentes: antecedentesClinicos || DEFAULT_ANTECEDENTES_CLINICOS,
      examenFisico: examenEstomatognatico || DEFAULT_EXAMEN_ESTOMATOGNATICO,
    };
  };

  const handleSaveDraft = () => {
    onSaveDraft?.(getFullFormData());
    showAlert({
      title: 'Borrador Guardado',
      message: 'Los datos del borrador de evolución se han guardado localmente de forma segura.',
      type: 'success',
    });
  };

  const handleSubmit = () => {
    if (!motivoConsulta.trim()) {
      showAlert({
        title: 'Campo Obligatorio Faltante',
        message:
          'El Motivo de Consulta es obligatorio conforme a la normativa médica. Por favor complételo en la pestaña "1. Anamnesis".',
        type: 'warning',
      });
      setActiveTab('ENTRADA');
      return;
    }
    if (!procedimientoRealizado.trim()) {
      showAlert({
        title: 'Campo Obligatorio Faltante',
        message:
          'El Procedimiento Realizado es obligatorio para certificar la atención odontológica. Por favor descríbalo en la pestaña "4. Hallazgos y Procedimiento".',
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
      onConfirm: () => {
        onBackToDetail?.();
      },
    });
  };

  // Helper para simular o disparar impresión de documentos
  const handlePrintDocument = (tipo: 'RECETA' | 'INCAPACIDAD' | 'REMISION') => {
    const titles = {
      RECETA: 'Fórmula Médica / Recetario Oficial',
      INCAPACIDAD: 'Certificado de Incapacidad Médica',
      REMISION: 'Orden de Remisión / Interconsulta',
    };
    showAlert({
      title: titles[tipo],
      message: `Generando documento oficial en PDF con firma médica digital para el paciente ${patientName}. Enviando al servicio de impresión local.`,
      type: 'info',
    });
  };

  const formattedDate = useMemo(() => {
    if (displayDate) return displayDate;
    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date());
  }, [displayDate]);

  return (
    <div className="space-y-6">
      <AlertModalComponent />

      {/* ENCABEZADO SUPERIOR FIDELIDAD AL DISEÑO (Imágenes 1, 2, 3, 4) */}
      <div className="space-y-4">
        {onBackToDetail && (
          <button
            type="button"
            onClick={onBackToDetail}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#687380] hover:text-[#111111] transition-colors"
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

        {/* BARRA DE PESTAÑAS (PILLS BLANCOS / NEGRO ACTIVO SEGÚN DISEÑO) */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-white border border-[#E7E7E3] shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('ENTRADA')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
              activeTab === 'ENTRADA'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#687380] hover:text-[#111111] hover:bg-[#F6F6F4]'
            }`}
          >
            1. Anamnesis
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ANTECEDENTES')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
              activeTab === 'ANTECEDENTES'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#687380] hover:text-[#111111] hover:bg-[#F6F6F4]'
            }`}
          >
            2. Antecedentes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('EXAMEN_FISICO')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
              activeTab === 'EXAMEN_FISICO'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#687380] hover:text-[#111111] hover:bg-[#F6F6F4]'
            }`}
          >
            3. Examen Físico
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('HALLAZGOS_PROCEDIMIENTO')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
              activeTab === 'HALLAZGOS_PROCEDIMIENTO'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#687380] hover:text-[#111111] hover:bg-[#F6F6F4]'
            }`}
          >
            4. Hallazgos y Procedimiento
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PLAN_MANEJO')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
              activeTab === 'PLAN_MANEJO'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#687380] hover:text-[#111111] hover:bg-[#F6F6F4]'
            }`}
          >
            5. Plan de Manejo
          </button>
        </div>
      </div>

      {/* PESTAÑA 1: ANAMNESIS */}
      {activeTab === 'ENTRADA' && (
        <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-6">
          <div className="pb-3 border-b border-[#E7E7E3]">
            <h3 className="text-base font-black text-[#111111]">1. Anamnesis (Interrogatorio)</h3>
            <p className="text-xs text-[#687380]">
              Registro de la información aportada directamente por el paciente al inicio de la valoración o tratamiento odontológico.
            </p>
          </div>

          {/* Motivo de Consulta */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-[#111111] flex items-center gap-2">
                <span>Motivo de Consulta</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700">
                  REQUERIDO
                </span>
              </label>
              <span className="text-[11px] text-[#8F99A3]">Palabras textuales del paciente</span>
            </div>

            <input
              type="text"
              disabled={readOnly}
              value={motivoConsulta}
              onChange={(e) => setMotivoConsulta(e.target.value)}
              placeholder="Ej: Vengo a revisión general o describe el motivo del paciente..."
              className="w-full min-h-[44px] rounded-xl border border-[#E7E7E3] px-3.5 py-2 text-xs text-[#111111] bg-[#F6F6F4] focus:bg-white focus:border-[#D4AF37] focus:outline-none transition-all"
            />

            {!readOnly && (
              <div className="rounded-2xl border border-[#E7E7E3] bg-[#FBF6E6]/40 p-4 space-y-2">
                <span className="text-[11px] font-black uppercase text-[#926C15] flex items-center gap-1.5">
                  <SparklesIcon size={13} color="#D4AF37" />
                  Opciones Rápidas de Autocompletado (Casos Generales)
                </span>
                <div className="flex flex-wrap gap-2">
                  {quickReasons.map((reason, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setMotivoConsulta(reason)}
                      className="px-2.5 py-1 rounded-lg border border-[#E7E7E3] bg-white text-[11px] font-semibold text-[#4B5563] hover:border-[#D4AF37] hover:text-[#111111] transition-all"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Enfermedad Actual */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-[#111111]">
                Enfermedad Actual (Cronología y detalles)
              </label>
              {!readOnly && (
                <button
                  type="button"
                  onClick={handleAutofillNA}
                  className="text-xs font-bold text-[#D4AF37] hover:underline"
                >
                  Autorellenar con N/A (No Aplica)
                </button>
              )}
            </div>

            <textarea
              rows={4}
              disabled={readOnly}
              value={enfermedadActual}
              onChange={(e) => setEnfermedadActual(e.target.value)}
              placeholder="Describe inicio, localización, características del dolor y síntomas, intensidad y factores agravantes/atenuantes, o seleccione N/A si no aplica patología..."
              className="w-full rounded-xl border border-[#E7E7E3] p-3 text-xs text-[#111111] bg-[#F6F6F4] focus:bg-white focus:border-[#D4AF37] focus:outline-none transition-all"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('ANTECEDENTES')}
              className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-black font-black text-xs shadow-sm hover:shadow transition-all cursor-pointer"
            >
              Continuar a Antecedentes →
            </button>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: ANTECEDENTES CLÍNICOS Y HÁBITOS (Imagen 2) */}
      {activeTab === 'ANTECEDENTES' && (
        <div className="space-y-4">
          <MedicalBackgroundForm
            readOnly={readOnly}
            initialBackgrounds={antecedentesClinicos}
            initialHabits={habitosHigiene}
            onChange={(bgs, hbts) => {
              setAntecedentesClinicos(bgs);
              setHabitosHigiene(hbts);
            }}
          />
          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('ENTRADA')}
              className="px-4 py-2 rounded-xl border border-[#E7E7E3] text-xs font-bold text-[#687380] hover:text-[#111111] bg-white transition-all cursor-pointer"
            >
              ← Volver a Entrada
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('EXAMEN_FISICO')}
              className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-black font-black text-xs shadow-sm hover:shadow transition-all cursor-pointer"
            >
              Continuar a Examen Físico →
            </button>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: EXAMEN FÍSICO ESTOMATOGNÁTICO (Imagen 3) */}
      {activeTab === 'EXAMEN_FISICO' && (
        <div className="space-y-4">
          <StomatognathicExamForm
            readOnly={readOnly}
            initialStructures={examenEstomatognatico}
            initialGeneralNotes={examenFisicoObservaciones}
            onChange={(structs, notes) => {
              setExamenEstomatognatico(structs);
              setExamenFisicoObservaciones(notes);
            }}
          />
          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('ANTECEDENTES')}
              className="px-4 py-2 rounded-xl border border-[#E7E7E3] text-xs font-bold text-[#687380] hover:text-[#111111] bg-white transition-all cursor-pointer"
            >
              ← Volver a Antecedentes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('HALLAZGOS_PROCEDIMIENTO')}
              className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-black font-black text-xs shadow-sm hover:shadow transition-all cursor-pointer"
            >
              Continuar a Hallazgos y Procedimiento →
            </button>
          </div>
        </div>
      )}

      {/* PESTAÑA 4: HALLAZGOS Y PROCEDIMIENTO (Imagen 4) */}
      {activeTab === 'HALLAZGOS_PROCEDIMIENTO' && (
        <div className="space-y-6">
          {/* CARD PRINCIPAL: ODONTOGRAMA CLÍNICO REGISTRADO (FDI UNIVERSAL) */}
          <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#E7E7E3]">
              <div className="flex items-center gap-3">
                {/* Icono de Diente en cuadrado negro */}
                <div className="w-10 h-10 rounded-xl bg-[#111111] flex items-center justify-center">
                  <ToothIcon size={20} color="#D4AF37" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-[#111111]">
                      Odontograma Clínico Registrado (FDI Universal)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FBF6E6] text-[#926C15] border border-[#E9C765]">
                      Esquema Activo
                    </span>
                  </div>
                  <p className="text-xs text-[#687380] mt-0.5">
                    {affectedTeethCount > 0
                      ? `${affectedTeethCount} piezas con hallazgos • ✓ Esquema validado en sesión clínica actual · Vista de matriz pentafacial`
                      : '0 piezas con hallazgos • Odontograma sano sin patologías registradas • Vista de matriz pentafacial'}
                  </p>
                </div>
              </div>

              {onOpenExpandedOdontogram && (
                <button
                  type="button"
                  onClick={onOpenExpandedOdontogram}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-black font-black text-xs shadow-sm hover:shadow transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  Ver y Editar Odontograma
                </button>
              )}
            </div>

            {/* Canvas de Odontograma FDI interactivo y renderizado */}
            <div className="bg-[#FAFAFA] rounded-2xl p-3 border border-[#E7E7E3]">
              <OdontogramCanvas
                initialData={activeOdontogram}
                readOnly={readOnly}
                onSave={(data) => {
                  setLocalOdontogram(data);
                  onOdontogramChange?.(data);
                }}
                onOpenExpandedMode={onOpenExpandedOdontogram}
              />
            </div>
          </div>

          {/* CARD: PROCEDIMIENTO REALIZADO (OBLIGATORIO) */}
          <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-[#111111] flex items-center gap-2">
                <span>Procedimiento Realizado</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700">
                  OBLIGATORIO
                </span>
              </label>
              <span className="text-[11px] text-[#8F99A3]">
                Descripción minuciosa del acto operatorio, técnica, instrumental y materiales empleados
              </span>
            </div>
            <textarea
              rows={4}
              disabled={readOnly}
              value={procedimientoRealizado}
              onChange={(e) => setProcedimientoRealizado(e.target.value)}
              placeholder="Describa el procedimiento operatorio, materiales, técnica, aislamiento..."
              className="w-full rounded-xl border border-[#E7E7E3] p-3 text-xs text-[#111111] bg-[#F6F6F4] focus:bg-white focus:border-[#D4AF37] focus:outline-none transition-all"
            />
          </div>

          {/* CARD: DIAGNÓSTICO CLÍNICO (DEFINITIVO / PRESUNTIVO) */}
          <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-[#111111] block">
              Diagnóstico Clínico (Definitivo / Presuntivo)
            </label>
            <textarea
              rows={2}
              disabled={readOnly}
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
              placeholder="Indique diagnóstico odontológico principal y secundarios..."
              className="w-full rounded-xl border border-[#E7E7E3] p-3 text-xs text-[#111111] bg-[#F6F6F4] focus:bg-white focus:border-[#D4AF37] focus:outline-none transition-all"
            />
          </div>

          {/* GRID 2 COLUMNAS: ACCIONES A REALIZAR Y OBSERVACIONES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-2">
              <label className="block text-xs font-black uppercase tracking-wider text-[#111111]">
                Acciones a Realizar (Plan Próxima Cita)
              </label>
              <textarea
                rows={3}
                disabled={readOnly}
                value={accionesARealizar}
                onChange={(e) => setAccionesARealizar(e.target.value)}
                placeholder="Próximos pasos terapéuticos o controles..."
                className="w-full rounded-xl border border-[#E7E7E3] p-3 text-xs text-[#111111] bg-[#F6F6F4] focus:bg-white focus:border-[#D4AF37] focus:outline-none transition-all"
              />
            </div>

            <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-[#111111]">
                  Observaciones Generales de la Atención
                </label>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F6F6F4] text-[#687380]">
                  Opcional
                </span>
              </div>
              <textarea
                rows={3}
                disabled={readOnly}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Observaciones clínicas adicionales..."
                className="w-full rounded-xl border border-[#E7E7E3] p-3 text-xs text-[#111111] bg-[#F6F6F4] focus:bg-white focus:border-[#D4AF37] focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* BARRA INFERIOR DE NAVEGACIÓN */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#E7E7E3]">
            <button
              type="button"
              onClick={handleDiscardChanges}
              className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
            >
              ✕ Descartar Cambios
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('PLAN_MANEJO')}
              className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-black font-black text-xs shadow-sm hover:shadow transition-all cursor-pointer"
            >
              Continuar a Plan de Manejo →
            </button>
          </div>
        </div>
      )}

      {/* PESTAÑA 5: PLAN DE MANEJO Y CONDUCTA (Imagen 1) */}
      {activeTab === 'PLAN_MANEJO' && (
        <div className="space-y-6">
          {/* CARD 1: PRESCRIPCIÓN FARMACOLÓGICA / MEDICAMENTOS */}
          <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E7E3]">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#111111] flex items-center justify-center shrink-0">
                  <PillIcon size={20} color="#D4AF37" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#111111]">
                    Prescripción Farmacológica / Medicamentos
                  </h3>
                  <p className="text-xs text-[#687380] mt-0.5">
                    Formulación médica oficial para el paciente. Se generará automáticamente el volante de prescripción médica con firma digital.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintDocument('RECETA')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E7E7E3] bg-white hover:bg-[#F6F6F4] text-xs font-bold text-[#111111] transition-all"
                >
                  <PrinterIcon size={14} className="text-[#687380]" />
                  Imprimir Receta
                </button>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleAddMedication()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#111111] hover:bg-black text-white text-xs font-black shadow-2xs transition-all"
                  >
                    <span>+</span>
                    Agregar Fármaco
                  </button>
                )}
              </div>
            </div>

            {/* Presets Rápidos */}
            {!readOnly && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-bold text-[#687380]">Sugerencias frecuentes:</span>
                <button
                  type="button"
                  onClick={() =>
                    handleAddMedication({
                      medicamento_principio_activo: 'Amoxicilina + Ácido Clavulánico',
                      dosis_concentracion: '875/125 mg',
                      frecuencia_via: 'Cada 8 horas (Vía Oral)',
                      duracion_tratamiento: '7 días consecutivos',
                    })
                  }
                  className="px-2 py-0.5 rounded-lg bg-[#F6F6F4] hover:bg-[#E7E7E3] text-[11px] font-semibold text-[#111111] transition-all"
                >
                  + Amoxicilina 875/125
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAddMedication({
                      medicamento_principio_activo: 'Ibuprofeno',
                      dosis_concentracion: '600 mg',
                      frecuencia_via: 'Cada 8 horas con alimentos',
                      duracion_tratamiento: '3 a 5 días según dolor',
                    })
                  }
                  className="px-2 py-0.5 rounded-lg bg-[#F6F6F4] hover:bg-[#E7E7E3] text-[11px] font-semibold text-[#111111] transition-all"
                >
                  + Ibuprofeno 600mg
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAddMedication({
                      medicamento_principio_activo: 'Acetaminofén + Codeína',
                      dosis_concentracion: '500/30 mg',
                      frecuencia_via: 'Cada 8 horas en dolor intenso',
                      duracion_tratamiento: '3 días',
                    })
                  }
                  className="px-2 py-0.5 rounded-lg bg-[#F6F6F4] hover:bg-[#E7E7E3] text-[11px] font-semibold text-[#111111] transition-all"
                >
                  + Acetaminofén / Codeína
                </button>
              </div>
            )}

            {/* TABLA DE FÁRMACOS */}
            {(planManejo.prescripcion_farmacologica || []).length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-[#E7E7E3]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F6F6F4] text-[10px] font-black uppercase text-[#687380] border-b border-[#E7E7E3]">
                    <tr>
                      <th className="p-3">MEDICAMENTO / PRINCIPIO ACTIVO</th>
                      <th className="p-3">CONCENTRACIÓN / DOSIS</th>
                      <th className="p-3">VÍA / FRECUENCIA</th>
                      <th className="p-3">DURACIÓN</th>
                      {!readOnly && <th className="p-3 text-center w-16">ACCIONES</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E7E3] bg-white">
                    {planManejo.prescripcion_farmacologica.map((med, idx) => (
                      <tr key={idx} className="hover:bg-[#FBF6E6]/30">
                        <td className="p-2.5">
                          <input
                            type="text"
                            disabled={readOnly}
                            value={med.medicamento_principio_activo}
                            onChange={(e) =>
                              handleUpdateMedication(
                                idx,
                                'medicamento_principio_activo',
                                e.target.value
                              )
                            }
                            placeholder="Ej: Amoxicilina 500mg"
                            className="w-full rounded-xl border border-[#E7E7E3] bg-[#F6F6F4] px-3 py-1.5 text-xs focus:bg-white focus:border-[#D4AF37] focus:outline-none"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            disabled={readOnly}
                            value={med.dosis_concentracion}
                            onChange={(e) =>
                              handleUpdateMedication(idx, 'dosis_concentracion', e.target.value)
                            }
                            placeholder="Ej: 500 mg"
                            className="w-full rounded-xl border border-[#E7E7E3] bg-[#F6F6F4] px-3 py-1.5 text-xs focus:bg-white focus:border-[#D4AF37] focus:outline-none"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            disabled={readOnly}
                            value={med.frecuencia_via}
                            onChange={(e) =>
                              handleUpdateMedication(idx, 'frecuencia_via', e.target.value)
                            }
                            placeholder="Ej: Cada 8 horas VO"
                            className="w-full rounded-xl border border-[#E7E7E3] bg-[#F6F6F4] px-3 py-1.5 text-xs focus:bg-white focus:border-[#D4AF37] focus:outline-none"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            disabled={readOnly}
                            value={med.duracion_tratamiento}
                            onChange={(e) =>
                              handleUpdateMedication(idx, 'duracion_tratamiento', e.target.value)
                            }
                            placeholder="Ej: 7 días"
                            className="w-full rounded-xl border border-[#E7E7E3] bg-[#F6F6F4] px-3 py-1.5 text-xs focus:bg-white focus:border-[#D4AF37] focus:outline-none"
                          />
                        </td>
                        {!readOnly && (
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveMedication(idx)}
                              className="text-red-500 hover:text-red-700 font-bold p-1 rounded-lg hover:bg-red-50 transition-all"
                              title="Eliminar medicamento"
                            >
                              <svg
                                className="w-4 h-4 mx-auto"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-[#8F99A3] italic py-2">
                No se han formulado medicamentos en este plan de manejo. Puede agregar fármacos usando el botón superior.
              </p>
            )}
          </div>

          {/* CARD 2: INCAPACIDAD MÉDICA / EXCUSA LABORAL (Imagen 1) */}
          <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E7E3]">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#111111] flex items-center justify-center shrink-0">
                  <BedIcon size={20} color="#D4AF37" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#111111]">
                    Incapacidad Médica / Excusa Laboral
                  </h3>
                  <p className="text-xs text-[#687380] mt-0.5">
                    Expedición de orden de reposo laboral o académico según la complejidad del procedimiento realizado.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handlePrintDocument('INCAPACIDAD')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E7E7E3] bg-white hover:bg-[#F6F6F4] text-xs font-bold text-[#111111] transition-all"
                >
                  <PrinterIcon size={14} className="text-[#687380]" />
                  Imprimir Excusa
                </button>

                <div className="flex items-center gap-2 pl-2">
                  <span className="text-xs font-bold text-[#111111]">¿Requiere Incapacidad?</span>
                  <div className="inline-flex rounded-xl p-0.5 bg-[#F6F6F4] border border-[#E7E7E3]">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() =>
                        setPlanManejo({
                          ...planManejo,
                          incapacidad_medica: {
                            ...(planManejo.incapacidad_medica || DEFAULT_PLAN_MANEJO.incapacidad_medica),
                            requiere_incapacidad: true,
                          },
                        })
                      }
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                        planManejo.incapacidad_medica?.requiere_incapacidad
                          ? 'bg-[#D4AF37] text-white shadow-2xs'
                          : 'text-[#687380] hover:text-[#111111]'
                      }`}
                    >
                      Sí
                    </button>
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() =>
                        setPlanManejo({
                          ...planManejo,
                          incapacidad_medica: {
                            ...(planManejo.incapacidad_medica || DEFAULT_PLAN_MANEJO.incapacidad_medica),
                            requiere_incapacidad: false,
                          },
                        })
                      }
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                        !planManejo.incapacidad_medica?.requiere_incapacidad
                          ? 'bg-[#111111] text-white shadow-2xs'
                          : 'text-[#687380] hover:text-[#111111]'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {planManejo.incapacidad_medica?.requiere_incapacidad && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-[#111111] mb-1">
                      Fecha Inicio
                    </label>
                    <input
                      type="date"
                      disabled={readOnly}
                      value={planManejo.incapacidad_medica?.fecha_inicio || ''}
                      onChange={(e) =>
                        setPlanManejo({
                          ...planManejo,
                          incapacidad_medica: {
                            ...planManejo.incapacidad_medica,
                            fecha_inicio: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-xl border border-[#E7E7E3] bg-[#F6F6F4] px-3.5 py-2 text-xs text-[#111111] focus:bg-white focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase text-[#111111] mb-1">
                      Fecha Culminación
                    </label>
                    <input
                      type="date"
                      disabled={readOnly}
                      value={planManejo.incapacidad_medica?.fecha_culminacion || ''}
                      onChange={(e) =>
                        setPlanManejo({
                          ...planManejo,
                          incapacidad_medica: {
                            ...planManejo.incapacidad_medica,
                            fecha_culminacion: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-xl border border-[#E7E7E3] bg-[#F6F6F4] px-3.5 py-2 text-xs text-[#111111] focus:bg-white focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-[#111111] mb-1">
                    Diagnóstico y Justificación Clínica
                  </label>
                  <textarea
                    rows={3}
                    disabled={readOnly}
                    value={planManejo.incapacidad_medica?.diagnostico_justificacion || ''}
                    onChange={(e) =>
                      setPlanManejo({
                        ...planManejo,
                        incapacidad_medica: {
                          ...planManejo.incapacidad_medica,
                          diagnostico_justificacion: e.target.value,
                        },
                      })
                    }
                    placeholder="Justificación del reposo, limitaciones físicas o recomendaciones posquirúrgicas..."
                    className="w-full rounded-xl border border-[#E7E7E3] bg-[#F6F6F4] p-3 text-xs text-[#111111] focus:bg-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* CARD 3: REMISIÓN MÉDICA / INTERCONSULTA ESPECIALIZADA (Imagen 1) */}
          <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E7E3]">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#111111] flex items-center justify-center shrink-0">
                  <StethoscopeIcon size={20} color="#D4AF37" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#111111]">
                    Remisión Médica / Interconsulta Especializada
                  </h3>
                  <p className="text-xs text-[#687380] mt-0.5">
                    Traslado o valoración por especialidad médica u odontológica externa o de segundo nivel.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handlePrintDocument('REMISION')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E7E7E3] bg-white hover:bg-[#F6F6F4] text-xs font-bold text-[#111111] transition-all"
                >
                  <PrinterIcon size={14} className="text-[#687380]" />
                  Imprimir Remisión
                </button>

                <div className="flex items-center gap-2 pl-2">
                  <span className="text-xs font-bold text-[#111111]">¿Requiere Remisión a Especialista?</span>
                  <div className="inline-flex rounded-xl p-0.5 bg-[#F6F6F4] border border-[#E7E7E3]">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() =>
                        setPlanManejo({
                          ...planManejo,
                          remision_medica: {
                            ...(planManejo.remision_medica || DEFAULT_PLAN_MANEJO.remision_medica),
                            requiere_remision: true,
                          },
                        })
                      }
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                        planManejo.remision_medica?.requiere_remision
                          ? 'bg-[#D4AF37] text-white shadow-2xs'
                          : 'text-[#687380] hover:text-[#111111]'
                      }`}
                    >
                      Sí
                    </button>
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() =>
                        setPlanManejo({
                          ...planManejo,
                          remision_medica: {
                            ...(planManejo.remision_medica || DEFAULT_PLAN_MANEJO.remision_medica),
                            requiere_remision: false,
                          },
                        })
                      }
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                        !planManejo.remision_medica?.requiere_remision
                          ? 'bg-[#111111] text-white shadow-2xs'
                          : 'text-[#687380] hover:text-[#111111]'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {planManejo.remision_medica?.requiere_remision && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-[#111111] mb-1">
                      Especialidad Destino
                    </label>
                    <select
                      disabled={readOnly}
                      value={planManejo.remision_medica?.especialidad_destino || ''}
                      onChange={(e) =>
                        setPlanManejo({
                          ...planManejo,
                          remision_medica: {
                            ...planManejo.remision_medica,
                            especialidad_destino: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-xl border border-[#E7E7E3] bg-[#F6F6F4] px-3.5 py-2 text-xs text-[#111111] focus:bg-white focus:border-[#D4AF37] focus:outline-none"
                    >
                      <option value="">Seleccione especialidad médica u odontológica...</option>
                      <option value="Endodoncia Microscópica">Endodoncia Microscópica</option>
                      <option value="Periodoncia e Implantología">Periodoncia e Implantología</option>
                      <option value="Ortodoncia y Ortopedia Maxilar">Ortodoncia y Ortopedia Maxilar</option>
                      <option value="Cirugía Oral y Maxilofacial">Cirugía Oral y Maxilofacial</option>
                      <option value="Rehabilitación Oral y Prótesis">Rehabilitación Oral y Prótesis</option>
                      <option value="Odontopediatría">Odontopediatría</option>
                      <option value="Medicina General / Interna">Medicina General / Interna</option>
                      <option value="Otorrinolaringología">Otorrinolaringología</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-[#111111] mb-1">
                      Prioridad de Atención
                    </label>
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() =>
                          setPlanManejo({
                            ...planManejo,
                            remision_medica: {
                              ...planManejo.remision_medica,
                              prioridad_atencion: 'Prioritaria / Urgencia',
                            },
                          })
                        }
                        className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${
                          planManejo.remision_medica?.prioridad_atencion === 'Prioritaria / Urgencia'
                            ? 'bg-[#FBF6E6] border-[#D4AF37] text-[#926C15]'
                            : 'bg-[#F6F6F4] border-[#E7E7E3] text-[#687380] hover:text-[#111111]'
                        }`}
                      >
                        Prioritaria / Urgencia
                      </button>
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() =>
                          setPlanManejo({
                            ...planManejo,
                            remision_medica: {
                              ...planManejo.remision_medica,
                              prioridad_atencion: 'Programada / Ordinaria',
                            },
                          })
                        }
                        className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${
                          planManejo.remision_medica?.prioridad_atencion !== 'Prioritaria / Urgencia'
                            ? 'bg-[#111111] border-[#111111] text-white'
                            : 'bg-[#F6F6F4] border-[#E7E7E3] text-[#687380] hover:text-[#111111]'
                        }`}
                      >
                        Programada / Ordinaria
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-[#111111] mb-1">
                    Motivo y Resumen Clínico de la Interconsulta
                  </label>
                  <textarea
                    rows={3}
                    disabled={readOnly}
                    value={planManejo.remision_medica?.motivo_resumen_clinico || ''}
                    onChange={(e) =>
                      setPlanManejo({
                        ...planManejo,
                        remision_medica: {
                          ...planManejo.remision_medica,
                          motivo_resumen_clinico: e.target.value,
                        },
                      })
                    }
                    placeholder="Indique el motivo detallado de la remisión y resumen del cuadro clínico estomatológico..."
                    className="w-full rounded-xl border border-[#E7E7E3] bg-[#F6F6F4] p-3 text-xs text-[#111111] focus:bg-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* CARD 4: CONDUCTA Y RECOMENDACIONES TERAPÉUTICAS */}
          <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-[#111111] block">
              Conducta, Recomendaciones Dietarias y Posología Adicional
            </label>
            <textarea
              rows={3}
              disabled={readOnly}
              value={conductaPlanManejo}
              onChange={(e) => {
                setConductaPlanManejo(e.target.value);
                setPlanManejo((prev) => ({ ...prev, conducta: e.target.value }));
              }}
              placeholder="Indique conducta clínica, recomendaciones dietarias, medidas posoperatorias o consideraciones específicas para el paciente..."
              className="w-full rounded-xl border border-[#E7E7E3] bg-[#F6F6F4] p-3 text-xs text-[#111111] focus:bg-white focus:border-[#D4AF37] focus:outline-none transition-all"
            />
          </div>

          {/* BARRA INFERIOR DE NAVEGACIÓN */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#E7E7E3]">
            <button
              type="button"
              onClick={handleDiscardChanges}
              className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
            >
              ✕ Descartar Cambios
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('HALLAZGOS_PROCEDIMIENTO')}
                className="px-4 py-2 rounded-xl border border-[#E7E7E3] text-xs font-bold text-[#687380] hover:text-[#111111] bg-white transition-all cursor-pointer"
              >
                ← Volver a Hallazgos
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-black font-black text-xs shadow-sm hover:shadow transition-all cursor-pointer"
                >
                  <SaveIcon size={16} color="#000000" />
                  Guardar y finalizar cita
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
