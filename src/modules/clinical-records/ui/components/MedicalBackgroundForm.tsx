// src/modules/clinical-records/ui/components/MedicalBackgroundForm.tsx
import React, { useState, useEffect } from 'react';
import {
  AntecedentesClinicosDTO,
  HabitosHigieneDTO,
  DEFAULT_ANTECEDENTES_CLINICOS,
  DEFAULT_HABITOS_HIGIENE,
} from '../../infrastructure/clinical-record.model';
import {
  BandageIcon,
  ScissorsIcon,
  StethoscopeIcon,
  PillIcon,
  ShieldIcon,
  UsersIcon,
  ToothIcon,
  WineIcon,
  CigaretteIcon,
  CandyIcon,
  ToothbrushIcon,
  DentalFlossIcon,
  CalendarIcon,
  SparklesIcon,
} from '../../../../shared/ui/components/Icons';

export interface MedicalBackgroundFormProps {
  initialBackgrounds?: AntecedentesClinicosDTO | any;
  initialHabits?: HabitosHigieneDTO | any;
  readOnly?: boolean;
  onChange?: (
    backgrounds: AntecedentesClinicosDTO,
    habits: HabitosHigieneDTO
  ) => void;
}

interface BackgroundFieldDef {
  key: keyof AntecedentesClinicosDTO;
  label: string;
  icon: React.ReactNode;
  descripcion: string;
  defaultNA: string;
}

const BACKGROUND_FIELDS: BackgroundFieldDef[] = [
  {
    key: 'accidentes_traumas',
    label: 'Accidentes o Traumas',
    icon: <BandageIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Trauma facial, luxación, fractura dental o maxilar.',
    defaultNA: 'N/A - Niega traumas faciales o dentales previos',
  },
  {
    key: 'cirugias',
    label: 'Cirugías',
    icon: <ScissorsIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Quirúrgicas, intervenciones previas, anestesia general.',
    defaultNA: 'N/A - Niega cirugías previas',
  },
  {
    key: 'patologicos',
    label: 'Patológicos',
    icon: <StethoscopeIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Hipertensión, diabetes, cardiopatías, asma, etc.',
    defaultNA: 'N/A - Niega enfermedades crónicas o sistémicas',
  },
  {
    key: 'farmacologicos',
    label: 'Farmacológicos',
    icon: <PillIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Medicamentos actuales, anticoagulantes, bifosfonatos, alergias.',
    defaultNA: 'N/A - Sin medicamentos habituales ni alergias farmacológicas conocidas',
  },
  {
    key: 'inmunologicos',
    label: 'Inmunológicos',
    icon: <ShieldIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Alergias a látex, inmunosupresión, condiciones inmunes.',
    defaultNA: 'N/A - Tolerancia comprobada a látex y resinas',
  },
  {
    key: 'familiares',
    label: 'Familiares',
    icon: <UsersIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Coagulopatías, diabetes familiar, periodontitis precoz.',
    defaultNA: 'N/A - Niega antecedentes familiares de relevancia',
  },
  {
    key: 'otros_habitos_practicas',
    label: 'Otros Hábitos / Prácticas',
    icon: <ToothIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Onicofagia, bruxismo, succión digital, respirador oral u otros.',
    defaultNA: 'Sin registro de hábitos orales parafuncionales o perjudiciales reportados',
  },
];

interface HabitFieldDef {
  key: keyof HabitosHigieneDTO;
  label: string;
  icon: React.ReactNode;
  descripcion: string;
  options: string[];
  defaultFrecuencia: string;
  defaultObservaciones: string;
}

const HABIT_FIELDS: HabitFieldDef[] = [
  {
    key: 'bebe_alcohol',
    label: 'Bebe alcohol',
    icon: <WineIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Consumo de bebidas alcohólicas o fermentadas.',
    options: ['No consume', 'Ocasional (social)', 'Semanal', 'Frecuente / Diario'],
    defaultFrecuencia: 'Ocasional (social)',
    defaultObservaciones: 'Consumo social esporádico',
  },
  {
    key: 'fuma_tabaco_vapeo',
    label: 'Fuma / Tabaco o Vapeo',
    icon: <CigaretteIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Cigarrillo tradicional, pipa o vaporizadores.',
    options: ['No fuma', 'Ocasional', '1 a 5 al día', 'Más de 5 al día'],
    defaultFrecuencia: 'No fuma',
    defaultObservaciones: 'No refiere tabaquismo ni cigarrillo electrónico',
  },
  {
    key: 'mastica_chicle_golosinas',
    label: 'Mastica chicle / Golosinas',
    icon: <CandyIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Consumo recurrente de chicle, caramelos o dulces.',
    options: ['No consume', 'Ocasional', 'Frecuente / Diario'],
    defaultFrecuencia: 'Ocasional',
    defaultObservaciones: 'Goma de mascar sin azúcar (xilitol)',
  },
  {
    key: 'cepillado_dental',
    label: 'Cepillado dental',
    icon: <ToothbrushIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Frecuencia y técnica de cepillado diario.',
    options: ['1 vez al día', '2 veces al día', '3 veces o más al día'],
    defaultFrecuencia: '3 veces o más al día',
    defaultObservaciones: 'Cepillo cerdas suaves manual. Técnica correcta',
  },
  {
    key: 'uso_seda_dental',
    label: 'Uso de seda dental',
    icon: <DentalFlossIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Limpieza interdental con hilo o cinta dental.',
    options: ['No utiliza', 'Ocasional', '1 vez al día (nocturno)', '2 o más veces al día'],
    defaultFrecuencia: '1 vez al día (nocturno)',
    defaultObservaciones: 'Seda encerada en la noche sin sangrado habitual',
  },
  {
    key: 'chequeos_odontologicos_periodicos',
    label: 'Chequeos odontológicos periódicos',
    icon: <CalendarIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Visitas preventivas y profilaxis dental.',
    options: ['Menos de 6 meses', 'Cada 6 meses', 'Cada año', 'Solo por dolor o urgencia'],
    defaultFrecuencia: 'Cada 6 meses',
    defaultObservaciones: 'Última profilaxis hace 7 meses con buena respuesta',
  },
];

function normalizeBackgrounds(raw: any): AntecedentesClinicosDTO {
  const base = { ...DEFAULT_ANTECEDENTES_CLINICOS };
  if (!raw) return base;

  if (Array.isArray(raw)) {
    const idMap: Record<string, keyof AntecedentesClinicosDTO> = {
      '1': 'accidentes_traumas',
      '2': 'cirugias',
      '3': 'patologicos',
      '4': 'farmacologicos',
      '5': 'inmunologicos',
      '6': 'familiares',
      '7': 'otros_habitos_practicas',
    };
    raw.forEach((item: any) => {
      const mappedKey = idMap[String(item.id)];
      if (mappedKey) {
        base[mappedKey] = {
          presenta: Boolean(item.presenta),
          observaciones: item.observaciones ?? '',
        };
      }
    });
    return base;
  }

  BACKGROUND_FIELDS.forEach(({ key, defaultNA }) => {
    if (raw[key]) {
      base[key] = {
        presenta: Boolean(raw[key].presenta),
        observaciones: raw[key].observaciones ?? (raw[key].presenta ? '' : defaultNA),
      };
    }
  });

  return base;
}

function normalizeHabits(raw: any): HabitosHigieneDTO {
  const base = { ...DEFAULT_HABITOS_HIGIENE };
  if (!raw) return base;

  if (Array.isArray(raw)) {
    const idMap: Record<string, keyof HabitosHigieneDTO> = {
      h1: 'bebe_alcohol',
      h2: 'fuma_tabaco_vapeo',
      h3: 'mastica_chicle_golosinas',
      h4: 'cepillado_dental',
      h5: 'uso_seda_dental',
      h6: 'chequeos_odontologicos_periodicos',
    };
    raw.forEach((item: any) => {
      const mappedKey = idMap[String(item.id)];
      if (mappedKey) {
        base[mappedKey] = {
          aplica: Boolean(item.aplica),
          frecuencia_cantidad: item.frecuencia_cantidad ?? item.frecuencia ?? '',
          observaciones: item.observaciones ?? '',
        };
      }
    });
    return base;
  }

  HABIT_FIELDS.forEach(({ key, defaultFrecuencia, defaultObservaciones }) => {
    if (raw[key]) {
      base[key] = {
        aplica: Boolean(raw[key].aplica),
        frecuencia_cantidad:
          raw[key].frecuencia_cantidad ??
          raw[key].frecuencia ??
          defaultFrecuencia,
        observaciones:
          raw[key].observaciones ??
          defaultObservaciones,
      };
    }
  });

  return base;
}

export const MedicalBackgroundForm: React.FC<MedicalBackgroundFormProps> = ({
  initialBackgrounds,
  initialHabits,
  readOnly = false,
  onChange,
}) => {
  const [backgrounds, setBackgrounds] = useState<AntecedentesClinicosDTO>(() =>
    normalizeBackgrounds(initialBackgrounds)
  );
  const [habits, setHabits] = useState<HabitosHigieneDTO>(() =>
    normalizeHabits(initialHabits)
  );

  useEffect(() => {
    if (initialBackgrounds) {
      setBackgrounds(normalizeBackgrounds(initialBackgrounds));
    }
  }, [initialBackgrounds]);

  useEffect(() => {
    if (initialHabits) {
      setHabits(normalizeHabits(initialHabits));
    }
  }, [initialHabits]);

  const handleMarkAllNo = () => {
    if (readOnly) return;
    const updatedBg: AntecedentesClinicosDTO = {
      accidentes_traumas: { presenta: false, observaciones: 'N/A - Niega traumas faciales o dentales previos' },
      cirugias: { presenta: false, observaciones: 'N/A - Niega cirugías previas' },
      patologicos: { presenta: false, observaciones: 'N/A - Niega enfermedades crónicas o sistémicas' },
      farmacologicos: { presenta: false, observaciones: 'N/A - Niega medicamentos o alergias conocidas' },
      inmunologicos: { presenta: false, observaciones: 'N/A - Tolerancia comprobada a látex y resinas' },
      familiares: { presenta: false, observaciones: 'N/A - Niega antecedentes familiares de relevancia' },
      otros_habitos_practicas: { presenta: false, observaciones: 'Sin registro de hábitos orales parafuncionales o perjudiciales reportados' },
    };
    setBackgrounds(updatedBg);
    onChange?.(updatedBg, habits);
  };

  const updateBackground = (
    key: keyof AntecedentesClinicosDTO,
    presenta: boolean,
    observaciones: string
  ) => {
    if (readOnly) return;
    const next: AntecedentesClinicosDTO = {
      ...backgrounds,
      [key]: { presenta, observaciones },
    };
    setBackgrounds(next);
    onChange?.(next, habits);
  };

  const updateHabit = (
    key: keyof HabitosHigieneDTO,
    aplica: boolean,
    frecuencia_cantidad: string,
    observaciones: string
  ) => {
    if (readOnly) return;
    const next: HabitosHigieneDTO = {
      ...habits,
      [key]: { aplica, frecuencia_cantidad, observaciones },
    };
    setHabits(next);
    onChange?.(backgrounds, next);
  };

  return (
    <div className="space-y-6">
      {/* Sección 2: Antecedentes Clínicos del Paciente (Imagen 2) */}
      <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E7E3]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#FBF3D5] flex items-center justify-center text-lg text-[#D4AF37] border border-[#F6E7B0]">
              📋
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold tracking-wider text-[#B8942A] uppercase">
                  MÓDULO CLÍNICO
                </span>
              </div>
              <h3 className="text-base font-extrabold text-[#111111]">
                2. Antecedentes Clínicos del Paciente
              </h3>
              <p className="text-xs text-[#6B7280]">
                Registro sistemático de antecedentes médicos, quirúrgicos y farmacológicos relevantes para la atención odontológica.
              </p>
            </div>
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={handleMarkAllNo}
              className="px-3.5 py-1.5 rounded-xl border border-[#D4AF37] bg-[#FBF3D5]/40 hover:bg-[#FBF3D5] text-[#8F721A] text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <SparklesIcon size={14} color="#D4AF37" /> Marcar todo con &ldquo;NO&rdquo; y &ldquo;N/A&rdquo; en observaciones
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F8F9FA] text-[10px] font-extrabold uppercase text-[#6B7280] border-b border-[#E7E7E3]">
              <tr>
                <th className="p-3 w-1/3">Tipo de Antecedente</th>
                <th className="p-3 text-center w-36">¿Presenta?</th>
                <th className="p-3">Observaciones / Detalle Clínico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E7E3]">
              {BACKGROUND_FIELDS.map(({ key, label, icon, descripcion, defaultNA }) => {
                const item = backgrounds[key] || { presenta: false, observaciones: '' };
                return (
                  <tr key={key} className="hover:bg-[#FBF3D5]/20 transition-colors">
                    <td className="p-3.5 align-top">
                      <div className="flex items-start gap-2.5">
                        {icon}
                        <div>
                          <p className="font-extrabold text-[#111111] text-xs">{label}</p>
                          <p className="text-[11px] text-[#6B7280] mt-0.5 leading-tight">{descripcion}</p>
                        </div>
                      </div>
                    </td>

                    {/* Radio Pill: ( ) Sí   (•) No */}
                    <td className="p-3.5 align-top text-center">
                      <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-[#F6F6F4] border border-[#E7E7E3]">
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => {
                            const newObs = item.observaciones === defaultNA ? '' : item.observaciones;
                            updateBackground(key, true, newObs);
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            item.presenta
                              ? 'bg-[#111111] text-white shadow-2xs'
                              : 'text-[#6B7280] hover:text-[#111111]'
                          }`}
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full border flex items-center justify-center ${
                              item.presenta
                                ? 'border-[#D4AF37] bg-[#D4AF37]'
                                : 'border-[#C4C4BF] bg-white'
                            }`}
                          />
                          <span>Sí</span>
                        </button>

                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => {
                            const newObs = !item.observaciones || item.observaciones.trim() === '' ? defaultNA : item.observaciones;
                            updateBackground(key, false, newObs);
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            !item.presenta
                              ? 'bg-[#111111] text-white shadow-2xs'
                              : 'text-[#6B7280] hover:text-[#111111]'
                          }`}
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full border flex items-center justify-center ${
                              !item.presenta
                                ? 'border-[#D4AF37] bg-[#D4AF37]'
                                : 'border-[#C4C4BF] bg-white'
                            }`}
                          />
                          <span>No</span>
                        </button>
                      </div>
                    </td>

                    <td className="p-3.5 align-top">
                      <input
                        type="text"
                        disabled={readOnly}
                        value={item.observaciones}
                        onChange={(e) => updateBackground(key, item.presenta, e.target.value)}
                        placeholder="Indique detalles clínicos o N/A..."
                        className="w-full rounded-xl border border-[#E7E7E3] px-3.5 py-2 text-xs text-[#1F2430] bg-[#F6F6F4] focus:bg-white focus:border-[#D4AF37] focus:outline-none transition-all"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sección 3: Hábitos y Rutina de Higiene Oral (Imagen 2) */}
      <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-5">
        <div className="pb-3 border-b border-[#E7E7E3] flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[#FBF3D5] flex items-center justify-center text-lg text-[#D4AF37] border border-[#F6E7B0]">
            🪥
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold tracking-wider text-[#B8942A] uppercase">
                ESTILO DE VIDA • Factores de Riesgo
              </span>
            </div>
            <h3 className="text-base font-extrabold text-[#111111]">
              3. Hábitos y Rutina de Higiene Oral
            </h3>
            <p className="text-xs text-[#6B7280]">
              Evaluación de hábitos comportamentales, sustancias y prácticas cotidianas de salud bucodental.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F8F9FA] text-[10px] font-extrabold uppercase text-[#6B7280] border-b border-[#E7E7E3]">
              <tr>
                <th className="p-3 w-1/4">Hábito / Práctica</th>
                <th className="p-3 text-center w-36">¿Aplica?</th>
                <th className="p-3 w-1/4">Frecuencia / Cantidad</th>
                <th className="p-3">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E7E3]">
              {HABIT_FIELDS.map(({ key, label, icon, descripcion, options }) => {
                const habit = habits[key] || { aplica: false, frecuencia_cantidad: '', observaciones: '' };
                return (
                  <tr key={key} className="hover:bg-[#FBF3D5]/20 transition-colors">
                    <td className="p-3.5 align-top">
                      <div className="flex items-start gap-2.5">
                        {icon}
                        <div>
                          <p className="font-extrabold text-[#111111] text-xs">{label}</p>
                          <p className="text-[11px] text-[#6B7280] mt-0.5 leading-tight">{descripcion}</p>
                        </div>
                      </div>
                    </td>

                    {/* Radio Pill: ( ) Sí   (•) No */}
                    <td className="p-3.5 align-top text-center">
                      <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-[#F6F6F4] border border-[#E7E7E3]">
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() =>
                            updateHabit(
                              key,
                              true,
                              habit.frecuencia_cantidad,
                              habit.observaciones
                            )
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            habit.aplica
                              ? 'bg-[#111111] text-white shadow-2xs'
                              : 'text-[#6B7280] hover:text-[#111111]'
                          }`}
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full border flex items-center justify-center ${
                              habit.aplica
                                ? 'border-[#D4AF37] bg-[#D4AF37]'
                                : 'border-[#C4C4BF] bg-white'
                            }`}
                          />
                          <span>Sí</span>
                        </button>

                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() =>
                            updateHabit(
                              key,
                              false,
                              habit.frecuencia_cantidad,
                              habit.observaciones
                            )
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            !habit.aplica
                              ? 'bg-[#111111] text-white shadow-2xs'
                              : 'text-[#6B7280] hover:text-[#111111]'
                          }`}
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full border flex items-center justify-center ${
                              !habit.aplica
                                ? 'border-[#D4AF37] bg-[#D4AF37]'
                                : 'border-[#C4C4BF] bg-white'
                            }`}
                          />
                          <span>No</span>
                        </button>
                      </div>
                    </td>

                    <td className="p-3.5 align-top">
                      <select
                        disabled={readOnly}
                        value={habit.frecuencia_cantidad || options[0]}
                        onChange={(e) =>
                          updateHabit(key, habit.aplica, e.target.value, habit.observaciones)
                        }
                        className="w-full rounded-xl border border-[#E7E7E3] px-3 py-2 text-xs text-[#1F2430] bg-[#F6F6F4] focus:bg-white focus:border-[#D4AF37] focus:outline-none"
                      >
                        {options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="p-3.5 align-top">
                      <input
                        type="text"
                        disabled={readOnly}
                        value={habit.observaciones}
                        onChange={(e) =>
                          updateHabit(key, habit.aplica, habit.frecuencia_cantidad, e.target.value)
                        }
                        placeholder="Observaciones clínicas..."
                        className="w-full rounded-xl border border-[#E7E7E3] px-3.5 py-2 text-xs text-[#1F2430] bg-[#F6F6F4] focus:bg-white focus:border-[#D4AF37] focus:outline-none"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
