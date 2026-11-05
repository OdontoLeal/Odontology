// src/modules/clinical-records/ui/components/tabs/ManagementPlanTab.tsx
import React from 'react';
import {
  PlanManejoDTO,
  PrescripcionItemDTO,
  DEFAULT_PLAN_MANEJO,
} from '../../../infrastructure/clinical-record.model';
import {
  PillIcon,
  BedIcon,
  StethoscopeIcon,
  PrinterIcon,
  SaveIcon,
} from '../../../../../shared/ui/components/Icons';

export interface ManagementPlanTabProps {
  planManejo: PlanManejoDTO;
  conductaPlanManejo: string;
  readOnly?: boolean;
  onPlanManejoChange: (updated: PlanManejoDTO) => void;
  onConductaChange: (conducta: string) => void;
  onPrintDocument: (tipo: 'RECETA' | 'INCAPACIDAD' | 'REMISION') => void;
  onDiscardChanges: () => void;
  onPrevTab: () => void;
  onSubmit: () => void;
}

export const ManagementPlanTab: React.FC<ManagementPlanTabProps> = ({
  planManejo,
  conductaPlanManejo,
  readOnly,
  onPlanManejoChange,
  onConductaChange,
  onPrintDocument,
  onDiscardChanges,
  onPrevTab,
  onSubmit,
}) => {
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
    onPlanManejoChange({
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
      onPlanManejoChange({ ...planManejo, prescripcion_farmacologica: currentMeds });
    }
  };

  const handleRemoveMedication = (index: number) => {
    if (readOnly) return;
    const currentMeds = [...(planManejo.prescripcion_farmacologica || [])];
    currentMeds.splice(index, 1);
    onPlanManejoChange({ ...planManejo, prescripcion_farmacologica: currentMeds });
  };

  return (
    <div className="space-y-6">
      {/* CARD 1: PRESCRIPCIÓN FARMACOLÓGICA / MEDICAMENTOS */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-5 sm:px-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F3F4F6]">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-[#111111] flex items-center justify-center [&_svg]:h-[18px] [&_svg]:w-[18px]">
              <PillIcon size={20} color="#D4AF37" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold leading-6 text-[#1E242B]">
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
              onClick={() => onPrintDocument('RECETA')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E7E7E3] bg-white hover:bg-[#F6F6F4] text-xs font-bold text-[#111111] transition-all cursor-pointer"
            >
              <PrinterIcon size={14} className="text-[#687380]" />
              Imprimir Receta
            </button>

            {!readOnly && (
              <button
                type="button"
                onClick={() => handleAddMedication()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#111111] hover:bg-black text-white text-xs font-black shadow-2xs transition-all cursor-pointer"
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
            <span className="text-[13px] font-bold text-[#687380]">Sugerencias frecuentes:</span>
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
              className="px-2 py-0.5 rounded-lg bg-[#F6F6F4] hover:bg-[#E7E7E3] text-[13px] font-semibold text-[#111111] transition-all cursor-pointer"
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
              className="px-2 py-0.5 rounded-lg bg-[#F6F6F4] hover:bg-[#E7E7E3] text-[13px] font-semibold text-[#111111] transition-all cursor-pointer"
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
              className="px-2 py-0.5 rounded-lg bg-[#F6F6F4] hover:bg-[#E7E7E3] text-[13px] font-semibold text-[#111111] transition-all cursor-pointer"
            >
              + Acetaminofén / Codeína
            </button>
          </div>
        )}

        {/* TABLA DE FÁRMACOS */}
        {(planManejo.prescripcion_farmacologica || []).length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-[#E7E7E3]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F6F4] text-[13px] font-black uppercase text-[#687380] border-b border-[#E7E7E3]">
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
                          handleUpdateMedication(idx, 'medicamento_principio_activo', e.target.value)
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
                          className="text-red-500 hover:text-red-700 font-bold p-1 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
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

      {/* CARD 2: INCAPACIDAD MÉDICA / EXCUSA LABORAL */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-5 sm:px-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F3F4F6]">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-[#111111] flex items-center justify-center [&_svg]:h-[18px] [&_svg]:w-[18px]">
              <BedIcon size={20} color="#D4AF37" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold leading-6 text-[#1E242B]">
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
              onClick={() => onPrintDocument('INCAPACIDAD')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E7E7E3] bg-white hover:bg-[#F6F6F4] text-xs font-bold text-[#111111] transition-all cursor-pointer"
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
                    onPlanManejoChange({
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
                    onPlanManejoChange({
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
                    onPlanManejoChange({
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
                    onPlanManejoChange({
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
                  onPlanManejoChange({
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

      {/* CARD 3: REMISIÓN MÉDICA / INTERCONSULTA ESPECIALIZADA */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-5 sm:px-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F3F4F6]">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-[#111111] flex items-center justify-center [&_svg]:h-[18px] [&_svg]:w-[18px]">
              <StethoscopeIcon size={20} color="#D4AF37" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold leading-6 text-[#1E242B]">
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
              onClick={() => onPrintDocument('REMISION')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E7E7E3] bg-white hover:bg-[#F6F6F4] text-xs font-bold text-[#111111] transition-all cursor-pointer"
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
                    onPlanManejoChange({
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
                    onPlanManejoChange({
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
                    onPlanManejoChange({
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
                      onPlanManejoChange({
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
                      onPlanManejoChange({
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
                  onPlanManejoChange({
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
      <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-5 sm:px-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-2">
        <label className="text-xs font-black uppercase tracking-wider text-[#111111] block">
          Conducta, Recomendaciones Dietarias y Posología Adicional
        </label>
        <textarea
          rows={3}
          disabled={readOnly}
          value={conductaPlanManejo}
          onChange={(e) => {
            onConductaChange(e.target.value);
            onPlanManejoChange({ ...planManejo, conducta: e.target.value });
          }}
          placeholder="Indique conducta clínica, recomendaciones dietarias, medidas posoperatorias o consideraciones específicas para el paciente..."
          className="w-full rounded-xl border border-[#E7E7E3] bg-[#F6F6F4] p-3 text-xs text-[#111111] focus:bg-white focus:border-[#D4AF37] focus:outline-none transition-all"
        />
      </div>

      {/* BARRA INFERIOR DE NAVEGACIÓN */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#E7E7E3]">
        <button
          type="button"
          onClick={onDiscardChanges}
          className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors cursor-pointer"
        >
          ✕ Descartar Cambios
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrevTab}
            className="px-4 py-2 rounded-xl border border-[#E7E7E3] text-xs font-bold text-[#687380] hover:text-[#111111] bg-white transition-all cursor-pointer"
          >
            ← Volver a Hallazgos
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={onSubmit}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-black font-black text-xs shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <SaveIcon size={16} color="#000000" />
              Guardar y finalizar cita
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
