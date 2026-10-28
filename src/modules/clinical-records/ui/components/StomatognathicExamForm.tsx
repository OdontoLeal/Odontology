// src/modules/clinical-records/ui/components/StomatognathicExamForm.tsx
import React, { useState, useEffect } from 'react';
import {
  ExamenEstomatognaticoDTO,
  DEFAULT_EXAMEN_ESTOMATOGNATICO,
} from '../../infrastructure/clinical-record.model';
import {
  LipIcon,
  TongueIcon,
  CheeksIcon,
  TonsilsIcon,
  PalateIcon,
  FrenumIcon,
  ShieldIcon,
  ToothIcon,
  SparklesIcon,
} from '../../../../shared/ui/components/Icons';

export interface StomatognathicExamFormProps {
  initialStructures?: ExamenEstomatognaticoDTO | any;
  initialGeneralNotes?: string;
  readOnly?: boolean;
  onChange?: (
    structures: ExamenEstomatognaticoDTO,
    generalNotes: string
  ) => void;
}

interface StructureDef {
  key: keyof ExamenEstomatognaticoDTO;
  nombre: string;
  icon: React.ReactNode;
  descripcion: string;
  defaultNA: string;
}

const STRUCTURE_FIELDS: StructureDef[] = [
  {
    key: 'labios',
    nombre: 'Labios',
    icon: <LipIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Superior, inferior y comisuras labiales.',
    defaultNA: 'N/A - Hidratados, normocoloreados y sin lesiones ni queilitis comisural.',
  },
  {
    key: 'lengua',
    nombre: 'Lengua',
    icon: <TongueIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Dorso, bordes laterales, cara ventral y base.',
    defaultNA: 'N/A - Lengua normoglosa, papilas íntegras, movilidad conservada sin alteraciones.',
  },
  {
    key: 'carrillos_mucosa_yugal',
    nombre: 'Carrillos / Mucosa Yugal',
    icon: <CheeksIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Línea alba, desembocadura conducto Stenon.',
    defaultNA: 'N/A - Mucosa yugal rosada, húmeda y flexible, sin mordeduras ni queratosis.',
  },
  {
    key: 'amigdalas',
    nombre: 'Amígdalas',
    icon: <TonsilsIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Amígdalas y pilares amigdalinos anteriores y posteriores.',
    defaultNA: 'N/A - Grado I simétricas, sin exudado, hiperemia ni compromiso infeccioso.',
  },
  {
    key: 'paladar_duro',
    nombre: 'Paladar Duro',
    icon: <PalateIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Paladar duro, rugas palatinas y rafe medio.',
    defaultNA: 'N/A - Bóveda palatina normal, mucosa queratinizada sana, sin torus ni fisuras.',
  },
  {
    key: 'frenillos',
    nombre: 'Frenillos',
    icon: <FrenumIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Labial superior, labial inferior y lingual.',
    defaultNA: 'N/A - Inserciones normoposicionadas sin tracción gingival ni limitación lingual.',
  },
  {
    key: 'mucosa_masticadora',
    nombre: 'Mucosa Masticadora',
    icon: <ShieldIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Zonas edéntulas, rebordes alveolares y encía insertada.',
    defaultNA: 'N/A - Rebordes íntegros, espesor de queratinización adecuado sin zonas dolorosas.',
  },
  {
    key: 'encia',
    nombre: 'Encía',
    icon: <ToothIcon size={18} color="#D4AF37" className="mt-0.5 shrink-0" />,
    descripcion: 'Marginal, adherida e interdental.',
    defaultNA: 'N/A - Encía rosa coral, consistencia firme, textura en cáscara de naranja, sin sangrado espontáneo.',
  },
];

function normalizeStructures(raw: any): ExamenEstomatognaticoDTO {
  const base = { ...DEFAULT_EXAMEN_ESTOMATOGNATICO };
  if (!raw) return base;

  if (Array.isArray(raw)) {
    const idMap: Record<string, keyof ExamenEstomatognaticoDTO> = {
      '1': 'labios',
      '2': 'lengua',
      '3': 'carrillos_mucosa_yugal',
      '4': 'amigdalas',
      '5': 'paladar_duro',
      '6': 'frenillos',
      '7': 'mucosa_masticadora',
      '8': 'encia',
    };
    raw.forEach((item: any) => {
      const mappedKey = idMap[String(item.id)];
      if (mappedKey) {
        base[mappedKey] = {
          presenta_anormalidades: Boolean(item.presentaAnormalidad ?? item.presenta_anormalidades),
          observaciones: item.observaciones ?? '',
        };
      }
    });
    return base;
  }

  STRUCTURE_FIELDS.forEach(({ key, defaultNA }) => {
    if (raw[key]) {
      base[key] = {
        presenta_anormalidades: Boolean(
          raw[key].presenta_anormalidades ?? raw[key].presentaAnormalidad
        ),
        observaciones:
          raw[key].observaciones ??
          (raw[key].presenta_anormalidades ? '' : defaultNA),
      };
    }
  });

  return base;
}

export const StomatognathicExamForm: React.FC<StomatognathicExamFormProps> = ({
  initialStructures,
  initialGeneralNotes = '',
  readOnly = false,
  onChange,
}) => {
  const [structures, setStructures] = useState<ExamenEstomatognaticoDTO>(() =>
    normalizeStructures(initialStructures)
  );
  const [generalNotes, setGeneralNotes] = useState(initialGeneralNotes);

  useEffect(() => {
    if (initialStructures) {
      setStructures(normalizeStructures(initialStructures));
    }
  }, [initialStructures]);

  useEffect(() => {
    if (initialGeneralNotes !== undefined) {
      setGeneralNotes(initialGeneralNotes);
    }
  }, [initialGeneralNotes]);

  const handleMarkAllNormal = () => {
    if (readOnly) return;
    const next: ExamenEstomatognaticoDTO = {
      labios: { presenta_anormalidades: false, observaciones: 'N/A - Hidratados, normocoloreados y sin lesiones ni queilitis comisural.' },
      lengua: { presenta_anormalidades: false, observaciones: 'N/A - Lengua normoglosa, papilas íntegras, movilidad conservada sin alteraciones.' },
      carrillos_mucosa_yugal: { presenta_anormalidades: false, observaciones: 'N/A - Mucosa yugal rosada, húmeda y flexible, sin mordeduras ni queratosis.' },
      amigdalas: { presenta_anormalidades: false, observaciones: 'N/A - Grado I simétricas, sin exudado, hiperemia ni compromiso infeccioso.' },
      paladar_duro: { presenta_anormalidades: false, observaciones: 'N/A - Bóveda palatina normal, mucosa queratinizada sana, sin torus ni fisuras.' },
      frenillos: { presenta_anormalidades: false, observaciones: 'N/A - Inserciones normoposicionadas sin tracción gingival ni limitación lingual.' },
      mucosa_masticadora: { presenta_anormalidades: false, observaciones: 'N/A - Rebordes íntegros, espesor de queratinización adecuado sin zonas dolorosas.' },
      encia: { presenta_anormalidades: false, observaciones: 'N/A - Encía rosa coral, consistencia firme, textura en cáscara de naranja, sin sangrado espontáneo.' },
    };
    setStructures(next);
    onChange?.(next, generalNotes);
  };

  const updateStructure = (
    key: keyof ExamenEstomatognaticoDTO,
    presenta_anormalidades: boolean,
    observaciones: string
  ) => {
    if (readOnly) return;
    const next: ExamenEstomatognaticoDTO = {
      ...structures,
      [key]: { presenta_anormalidades, observaciones },
    };
    setStructures(next);
    onChange?.(next, generalNotes);
  };

  return (
    <div className="space-y-6">
      {/* Sección 3: Examen Físico Estomatognático (Imagen 3) */}
      <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E7E3]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#FBF3D5] flex items-center justify-center text-lg text-[#D4AF37] border border-[#F6E7B0]">
              📋
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold tracking-wider text-[#B8942A] uppercase">
                  MÓDULO CLÍNICO • Tejidos Blandos y Anexos
                </span>
              </div>
              <h3 className="text-base font-extrabold text-[#111111]">
                3. Examen Físico Estomatognático / Tejidos Blandos y Anexos
              </h3>
              <p className="text-xs text-[#6B7280]">
                Evaluación y exploración sistemática de cavidad oral, estructuras anatómicas y tejidos periodontales.
              </p>
            </div>
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={handleMarkAllNormal}
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
                <th className="p-3 w-1/3">Estructura Anatómica</th>
                <th className="p-3 text-center w-36">¿Presenta Anormalidades?</th>
                <th className="p-3">Observaciones / Hallazgos Clínicos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E7E3]">
              {STRUCTURE_FIELDS.map(({ key, nombre, icon, descripcion, defaultNA }) => {
                const item = structures[key] || { presenta_anormalidades: false, observaciones: '' };
                return (
                  <tr key={key} className="hover:bg-[#FBF3D5]/20 transition-colors">
                    <td className="p-3.5 align-top">
                      <div className="flex items-start gap-2.5">
                        {icon}
                        <div>
                          <p className="font-extrabold text-[#111111] text-xs">{nombre}</p>
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
                            updateStructure(key, true, newObs);
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            item.presenta_anormalidades
                              ? 'bg-[#111111] text-white shadow-2xs'
                              : 'text-[#6B7280] hover:text-[#111111]'
                          }`}
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full border flex items-center justify-center ${
                              item.presenta_anormalidades
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
                            updateStructure(key, false, newObs);
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            !item.presenta_anormalidades
                              ? 'bg-[#111111] text-white shadow-2xs'
                              : 'text-[#6B7280] hover:text-[#111111]'
                          }`}
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full border flex items-center justify-center ${
                              !item.presenta_anormalidades
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
                        onChange={(e) => updateStructure(key, item.presenta_anormalidades, e.target.value)}
                        placeholder="Indique detalles o N/A..."
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

      {/* Card Inferior: Observaciones Adicionales / Notas Clínicas Generales (Imagen 3) */}
      <div className="rounded-3xl border border-[#E7E7E3] bg-white p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#E7E7E3]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#FBF3D5] flex items-center justify-center text-base text-[#D4AF37] border border-[#F6E7B0]">
              📝
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-[#111111]">
                Observaciones Adicionales / Notas Clínicas Generales
              </h4>
              <p className="text-[11px] text-[#6B7280]">
                Anotaciones complementarias, hallazgos extraorales o precisiones diagnósticas de la exploración física.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-[#F6F6F4] text-[#8F99A3] text-[10px] font-bold border border-[#E7E7E3]">
            Opcional
          </span>
        </div>

        <textarea
          rows={3}
          disabled={readOnly}
          value={generalNotes}
          onChange={(e) => {
            setGeneralNotes(e.target.value);
            onChange?.(structures, e.target.value);
          }}
          placeholder="Describa aquí observaciones adicionales relevantes del examen físico, hallazgos no contemplados previamente o notas diagnósticas generales..."
          className="w-full rounded-xl border border-[#E7E7E3] p-3 text-xs text-[#1F2430] bg-white focus:border-[#D4AF37] focus:outline-none transition-all"
        />
      </div>
    </div>
  );
};
