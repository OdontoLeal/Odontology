// src/modules/clinical-records/ui/components/OdontogramCanvas.tsx
import React, { useState, useEffect } from 'react';
import { OdontogramDataDTO } from '../../infrastructure/clinical-record.model';
import { OdontogramEntity } from '../../domain/odontogram.entity';
import { Badge } from '../../../../shared/ui/components/Badge';
import { Button } from '../../../../shared/ui/components/Button';

export interface OdontogramCanvasProps {
  initialData?: OdontogramDataDTO;
  readOnly?: boolean;
  onSave?: (data: OdontogramDataDTO) => void;
  onOpenExpandedMode?: () => void;
}

type FindingType =
  | 'none'
  | 'caries_activa'
  | 'restauracion_resina'
  | 'sellante_fosas'
  | 'desgaste_faceta';

type TechnicalSymbolType =
  | 'none'
  | 'diente_extraido'
  | 'extraccion_requerida'
  | 'corona'
  | 'implante'
  | 'protesis_fija'
  | 'endodoncia'
  | 'puente';

export const OdontogramCanvas: React.FC<OdontogramCanvasProps> = ({
  initialData,
  readOnly = false,
  onSave,
  onOpenExpandedMode,
}) => {
  const [odontogramData, setOdontogramData] = useState<OdontogramDataDTO>(() => {
    if (initialData) return initialData;
    return OdontogramEntity.createBlankOdontogramJSON();
  });

  useEffect(() => {
    if (initialData) {
      setOdontogramData(initialData);
    }
  }, [initialData]);

  const [activeTool, setActiveTool] = useState<FindingType>('caries_activa');
  const [activeSymbol, setActiveSymbol] = useState<TechnicalSymbolType>('none');
  const [selectedToothForNote, setSelectedToothForNote] = useState<number | null>(null);
  const [toothNoteInput, setToothNoteInput] = useState('');

  // Cuadrantes estándar
  const q1Keys = ['18', '17', '16', '15', '14', '13', '12', '11'];
  const q2Keys = ['21', '22', '23', '24', '25', '26', '27', '28'];
  const q4Keys = ['48', '47', '46', '45', '44', '43', '42', '41'];
  const q3Keys = ['31', '32', '33', '34', '35', '36', '37', '38'];

  // Obtener color para una superficie
  const getSurfaceColor = (surfaceFlags: any): string => {
    if (!surfaceFlags) return '#FFFFFF';
    if (surfaceFlags.caries_activa) return '#EF4444'; // Rojo
    if (surfaceFlags.restauracion_resina) return '#3B82F6'; // Azul
    if (surfaceFlags.sellante_fosas) return '#10B981'; // Verde
    if (surfaceFlags.desgaste_faceta) return '#F59E0B'; // Naranja
    return '#FFFFFF';
  };

  // Manejar clic en cara dental (pentafacial)
  const handleSurfaceClick = (
    quadrantKey: 'cuadrante_1' | 'cuadrante_2' | 'cuadrante_3' | 'cuadrante_4',
    toothCode: string,
    surface: 'vestibular' | 'palatina' | 'lingual' | 'mesial' | 'distal' | 'oclusal_incisal'
  ) => {
    if (readOnly) return;

    setOdontogramData((prev) => {
      const next = structuredClone(prev);
      const tooth = next.cuadrantes[quadrantKey]?.piezas[toothCode];
      if (!tooth) return prev;

      const surfaceObj = (tooth.caras as any)[surface];
      if (!surfaceObj) return prev;

      // Resetea todas las banderas de esta superficie (invariante: un solo hallazgo por cara)
      surfaceObj.caries_activa = false;
      surfaceObj.restauracion_resina = false;
      surfaceObj.sellante_fosas = false;
      surfaceObj.desgaste_faceta = false;

      // Aplica la herramienta seleccionada si no es borrador
      if (activeTool !== 'none') {
        surfaceObj[activeTool] = true;
      }

      return next;
    });
  };

  // Manejar clic en la pieza completa para símbolos técnicos
  const handleToothSymbolClick = (
    quadrantKey: 'cuadrante_1' | 'cuadrante_2' | 'cuadrante_3' | 'cuadrante_4',
    toothCode: string
  ) => {
    if (readOnly || activeSymbol === 'none') return;

    setOdontogramData((prev) => {
      const next = structuredClone(prev);
      const tooth = next.cuadrantes[quadrantKey]?.piezas[toothCode];
      if (!tooth) return prev;

      // Reset símbolos
      tooth.simbolos_tecnicos.diente_extraido = false;
      tooth.simbolos_tecnicos.extraccion_requerida = false;
      tooth.simbolos_tecnicos.corona = false;
      tooth.simbolos_tecnicos.implante = false;
      tooth.simbolos_tecnicos.protesis_fija = false;
      tooth.simbolos_tecnicos.endodoncia = false;
      tooth.simbolos_tecnicos.puente = false;

      (tooth.simbolos_tecnicos as any)[activeSymbol] = true;

      return next;
    });
  };

  // Renderizador SVG de una pieza pentafacial
  const renderToothSVG = (
    quadrantKey: 'cuadrante_1' | 'cuadrante_2' | 'cuadrante_3' | 'cuadrante_4',
    toothKey: string,
    isUpper: boolean
  ) => {
    const quadrant = odontogramData.cuadrantes[quadrantKey];
    const tooth = quadrant?.piezas[toothKey];
    if (!tooth) return null;

    const caras = tooth.caras as any;
    const innerSurfaceKey = isUpper ? 'palatina' : 'lingual';

    const colorVestibular = getSurfaceColor(caras.vestibular);
    const colorInner = getSurfaceColor(caras[innerSurfaceKey]);
    const colorMesial = getSurfaceColor(caras.mesial);
    const colorDistal = getSurfaceColor(caras.distal);
    const colorOclusal = getSurfaceColor(caras.oclusal_incisal);

    const st = tooth.simbolos_tecnicos;
    const hasSymbol =
      st.diente_extraido ||
      st.extraccion_requerida ||
      st.corona ||
      st.implante ||
      st.endodoncia ||
      st.puente;

    return (
      <div key={toothKey} className="flex flex-col items-center p-1 select-none">
        {/* Código FDI */}
        <span className="text-[10px] font-extrabold text-[#687380] mb-0.5">
          {toothKey}
        </span>

        {/* Polígono Pentafacial Interactivo */}
        <div className="relative">
          <svg
            width="36"
            height="36"
            viewBox="0 0 100 100"
            className="border border-[#CBD2D9] rounded-md bg-white shadow-2xs hover:border-[#D4AF37] transition-all cursor-pointer"
            onClick={() => handleToothSymbolClick(quadrantKey, toothKey)}
          >
            {/* Cara Superior (Vestibular en superior / Lingual en inferior) */}
            <polygon
              points="0,0 100,0 75,25 25,25"
              fill={isUpper ? colorVestibular : colorInner}
              stroke="#687380"
              strokeWidth="2"
              onClick={(e) => {
                e.stopPropagation();
                handleSurfaceClick(quadrantKey, toothKey, isUpper ? 'vestibular' : 'lingual');
              }}
            />

            {/* Cara Derecha (Distal en Q1/Q4, Mesial en Q2/Q3) */}
            <polygon
              points="100,0 100,100 75,75 75,25"
              fill={colorDistal}
              stroke="#687380"
              strokeWidth="2"
              onClick={(e) => {
                e.stopPropagation();
                handleSurfaceClick(quadrantKey, toothKey, 'distal');
              }}
            />

            {/* Cara Inferior (Palatina en superior / Vestibular en inferior) */}
            <polygon
              points="0,100 100,100 75,75 25,75"
              fill={isUpper ? colorInner : colorVestibular}
              stroke="#687380"
              strokeWidth="2"
              onClick={(e) => {
                e.stopPropagation();
                handleSurfaceClick(quadrantKey, toothKey, isUpper ? 'palatina' : 'vestibular');
              }}
            />

            {/* Cara Izquierda (Mesial) */}
            <polygon
              points="0,0 0,100 25,75 25,25"
              fill={colorMesial}
              stroke="#687380"
              strokeWidth="2"
              onClick={(e) => {
                e.stopPropagation();
                handleSurfaceClick(quadrantKey, toothKey, 'mesial');
              }}
            />

            {/* Cara Central (Oclusal / Incisal) */}
            <polygon
              points="25,25 75,25 75,75 25,75"
              fill={colorOclusal}
              stroke="#687380"
              strokeWidth="2"
              onClick={(e) => {
                e.stopPropagation();
                handleSurfaceClick(quadrantKey, toothKey, 'oclusal_incisal');
              }}
            />

            {/* Superposiciones de Símbolos Técnicos */}
            {st.diente_extraido && (
              <line x1="10" y1="10" x2="90" y2="90" stroke="#1E242B" strokeWidth="6" />
            )}
            {st.extraccion_requerida && (
              <>
                <line x1="10" y1="10" x2="90" y2="90" stroke="#EF4444" strokeWidth="6" />
                <line x1="90" y1="10" x2="10" y2="90" stroke="#EF4444" strokeWidth="6" />
              </>
            )}
            {st.corona && (
              <circle cx="50" cy="50" r="38" fill="none" stroke="#D4AF37" strokeWidth="6" />
            )}
            {st.endodoncia && (
              <line x1="50" y1="5" x2="50" y2="95" stroke="#3B82F6" strokeWidth="6" />
            )}
            {st.implante && (
              <rect x="35" y="25" width="30" height="50" rx="4" fill="#687380" opacity="0.8" />
            )}
          </svg>
        </div>

        {/* Indicador de Nota Clínica */}
        {tooth.nota_clinica?.descripcion && (
          <span
            title={tooth.nota_clinica.descripcion}
            className="text-[9px] text-[#D4AF37] font-extrabold cursor-pointer mt-0.5"
            onClick={() => {
              setSelectedToothForNote(Number(toothKey));
              setToothNoteInput(tooth.nota_clinica?.descripcion || '');
            }}
          >
            💬 Nota
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Barra de Herramientas y Paleta de Colores (Página 21) */}
      {!readOnly && (
        <div className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-3 space-y-3">
          {/* Fila 1: Patologías y Colores */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase text-[#687380] mr-1">
              Patología / Color:
            </span>
            <button
              type="button"
              onClick={() => {
                setActiveTool('none');
                setActiveSymbol('none');
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                activeTool === 'none' && activeSymbol === 'none'
                  ? 'border-black bg-white shadow-xs'
                  : 'border-[#CBD2D9] text-[#687380]'
              }`}
            >
              🧹 Borrador
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTool('caries_activa');
                setActiveSymbol('none');
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all ${
                activeTool === 'caries_activa'
                  ? 'border-[#EF4444] bg-[#FEE2E2] text-[#991B1B] shadow-xs'
                  : 'border-[#CBD2D9] text-[#687380]'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
              Caries Activa (Rojo)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTool('restauracion_resina');
                setActiveSymbol('none');
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all ${
                activeTool === 'restauracion_resina'
                  ? 'border-[#3B82F6] bg-[#DBEAFE] text-[#1E40AF] shadow-xs'
                  : 'border-[#CBD2D9] text-[#687380]'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />
              Restauración / Resina (Azul)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTool('sellante_fosas');
                setActiveSymbol('none');
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all ${
                activeTool === 'sellante_fosas'
                  ? 'border-[#10B981] bg-[#D1FAE5] text-[#065F46] shadow-xs'
                  : 'border-[#CBD2D9] text-[#687380]'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
              Sellante en Fosas (Verde)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTool('desgaste_faceta');
                setActiveSymbol('none');
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all ${
                activeTool === 'desgaste_faceta'
                  ? 'border-[#F59E0B] bg-[#FEF3C7] text-[#92400E] shadow-xs'
                  : 'border-[#CBD2D9] text-[#687380]'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
              Desgaste / Faceta (Naranja)
            </button>
          </div>

          {/* Fila 2: Símbolos Técnicos */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E2E6EA]">
            <span className="text-[11px] font-extrabold uppercase text-[#687380] mr-1">
              Símbolos Técnicos:
            </span>
            <button
              type="button"
              onClick={() => setActiveSymbol('diente_extraido')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                activeSymbol === 'diente_extraido'
                  ? 'border-black bg-white shadow-xs'
                  : 'border-[#CBD2D9] text-[#687380]'
              }`}
            >
              ✕ Diente Extraído
            </button>
            <button
              type="button"
              onClick={() => setActiveSymbol('extraccion_requerida')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                activeSymbol === 'extraccion_requerida'
                  ? 'border-[#EF4444] bg-[#FEE2E2] text-[#991B1B] shadow-xs'
                  : 'border-[#CBD2D9] text-[#687380]'
              }`}
            >
              ✚ Extracción Requerida
            </button>
            <button
              type="button"
              onClick={() => setActiveSymbol('corona')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                activeSymbol === 'corona'
                  ? 'border-[#D4AF37] bg-[#FBF6E6] text-[#8F721A] shadow-xs'
                  : 'border-[#CBD2D9] text-[#687380]'
              }`}
            >
              ◯ Corona
            </button>
            <button
              type="button"
              onClick={() => setActiveSymbol('implante')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                activeSymbol === 'implante'
                  ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-xs'
                  : 'border-[#CBD2D9] text-[#687380]'
              }`}
            >
              🔩 Implante
            </button>
            <button
              type="button"
              onClick={() => setActiveSymbol('endodoncia')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                activeSymbol === 'endodoncia'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-800 shadow-xs'
                  : 'border-[#CBD2D9] text-[#687380]'
              }`}
            >
              ┃ Endodoncia
            </button>

            {onOpenExpandedMode && (
              <Button
                size="sm"
                variant="outline"
                type="button"
                className="ml-auto"
                onClick={onOpenExpandedMode}
                leftIcon={<span>🔍</span>}
              >
                Modo Edición Ampliada
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Matriz Oclusal FDI Universal (4 Cuadrantes según Page 19 y Page 21) */}
      <div className="rounded-3xl border border-[#CBD2D9] bg-white p-4 overflow-x-auto shadow-inner space-y-4">
        {/* Maxilar Superior (Cuadrante 1 y Cuadrante 2) */}
        <div>
          <div className="flex justify-between text-[11px] font-extrabold text-[#8F99A3] pb-1 px-4">
            <span>CUADRANTE 1 — MAXILAR SUPERIOR DERECHO</span>
            <span>CUADRANTE 2 — MAXILAR SUPERIOR IZQUIERDO</span>
          </div>

          <div className="flex items-center justify-center gap-6 pb-2 border-b border-[#CBD2D9]">
            {/* Cuadrante 1: 18 a 11 */}
            <div className="flex gap-1">
              {q1Keys.map((k) => renderToothSVG('cuadrante_1', k, true))}
            </div>

            {/* Línea media vertical */}
            <div className="w-0.5 h-14 bg-[#CBD2D9]" />

            {/* Cuadrante 2: 21 a 28 */}
            <div className="flex gap-1">
              {q2Keys.map((k) => renderToothSVG('cuadrante_2', k, true))}
            </div>
          </div>
        </div>

        {/* Línea Oclusal Media */}
        <div className="text-center text-[10px] font-extrabold text-[#D4AF37] uppercase tracking-widest">
          • LÍNEA OCLUSAL MEDIA FDI •
        </div>

        {/* Mandíbula Inferior (Cuadrante 4 y Cuadrante 3) */}
        <div>
          <div className="flex items-center justify-center gap-6 pt-2">
            {/* Cuadrante 4: 48 a 41 */}
            <div className="flex gap-1">
              {q4Keys.map((k) => renderToothSVG('cuadrante_4', k, false))}
            </div>

            {/* Línea media vertical */}
            <div className="w-0.5 h-14 bg-[#CBD2D9]" />

            {/* Cuadrante 3: 31 a 38 */}
            <div className="flex gap-1">
              {q3Keys.map((k) => renderToothSVG('cuadrante_3', k, false))}
            </div>
          </div>

          <div className="flex justify-between text-[11px] font-extrabold text-[#8F99A3] pt-2 px-4 border-t border-[#CBD2D9]">
            <span>CUADRANTE 4 — MANDÍBULA INFERIOR DERECHA</span>
            <span>CUADRANTE 3 — MANDÍBULA INFERIOR IZQUIERDA</span>
          </div>
        </div>
      </div>

      {/* Botón de Guardar Cambios */}
      {onSave && !readOnly && (
        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => onSave(odontogramData)}
            leftIcon={<span>💾</span>}
          >
            Guardar Odontograma Clínico
          </Button>
        </div>
      )}
    </div>
  );
};
