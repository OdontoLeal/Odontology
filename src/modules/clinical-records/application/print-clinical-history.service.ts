// src/modules/clinical-records/application/print-clinical-history.service.ts
import { ClinicalEvolutionEntry } from '../ui/hooks/useClinicalRecord';
import { PatientListItem } from '../../patients/ui/hooks/usePatients';

export interface PrintClinicalHistoryParams {
  patient: PatientListItem;
  history: ClinicalEvolutionEntry[];
}

interface DentalFindingRow {
  fdi: number;
  nombre: string;
  superficie: string;
  hallazgo: string;
  tipo: 'caries' | 'restauracion' | 'sellante' | 'desgaste' | 'simbolo' | 'nota';
}

function getSurfaceColor(surfaceFlags: any): string {
  if (!surfaceFlags) return '#FFFFFF';
  if (surfaceFlags.caries_activa) return '#EF4444'; // Rojo
  if (surfaceFlags.restauracion_resina) return '#3B82F6'; // Azul
  if (surfaceFlags.sellante_fosas) return '#10B981'; // Verde
  if (surfaceFlags.desgaste_faceta) return '#F59E0B'; // Naranja
  return '#FFFFFF';
}

function renderToothSvg(tooth: any, toothKey: string, isUpper: boolean): string {
  if (!tooth) {
    return `
      <div style="display:inline-flex; flex-direction:column; align-items:center; margin:1px;">
        <span style="font-size:7.5pt; font-weight:800; color:#6B7280; margin-bottom:1px;">${toothKey}</span>
        <div style="width:28px; height:28px; border:1px dashed #CBD2D9; border-radius:3px;"></div>
      </div>
    `;
  }

  const caras = tooth.caras || {};
  const innerSurfaceKey = isUpper ? 'palatina' : 'lingual';

  const colorVestibular = getSurfaceColor(caras.vestibular);
  const colorInner = getSurfaceColor(caras[innerSurfaceKey]);
  const colorMesial = getSurfaceColor(caras.mesial);
  const colorDistal = getSurfaceColor(caras.distal);
  const colorOclusal = getSurfaceColor(caras.oclusal_incisal);

  const st = tooth.simbolos_tecnicos || {};

  return `
    <div style="display:inline-flex; flex-direction:column; align-items:center; margin:1px;">
      <span style="font-size:7.5pt; font-weight:800; color:#374151; margin-bottom:1px;">${toothKey}</span>
      <div style="position:relative; width:28px; height:28px;">
        <svg width="28" height="28" viewBox="0 0 100 100" style="background:#ffffff; border:1px solid #9CA3AF; border-radius:3px; display:block;">
          <!-- Cara Superior -->
          <polygon points="0,0 100,0 75,25 25,25" fill="${isUpper ? colorVestibular : colorInner}" stroke="#4B5563" stroke-width="2"/>
          <!-- Cara Derecha -->
          <polygon points="100,0 100,100 75,75 75,25" fill="${colorDistal}" stroke="#4B5563" stroke-width="2"/>
          <!-- Cara Inferior -->
          <polygon points="0,100 100,100 75,75 25,75" fill="${isUpper ? colorInner : colorVestibular}" stroke="#4B5563" stroke-width="2"/>
          <!-- Cara Izquierda -->
          <polygon points="0,0 0,100 25,75 25,25" fill="${colorMesial}" stroke="#4B5563" stroke-width="2"/>
          <!-- Cara Central (Oclusal / Incisal) -->
          <polygon points="25,25 75,25 75,75 25,75" fill="${colorOclusal}" stroke="#4B5563" stroke-width="2"/>

          <!-- Símbolos Técnicos Inalterables -->
          ${st.diente_extraido ? `
            <line x1="8" y1="8" x2="92" y2="92" stroke="#111827" stroke-width="10" stroke-linecap="round"/>
            <line x1="92" y1="8" x2="8" y2="92" stroke="#111827" stroke-width="10" stroke-linecap="round"/>
          ` : ''}
          ${st.extraccion_requerida ? `
            <line x1="50" y1="8" x2="50" y2="92" stroke="#EF4444" stroke-width="10" stroke-linecap="round"/>
            <line x1="8" y1="50" x2="92" y2="50" stroke="#EF4444" stroke-width="10" stroke-linecap="round"/>
          ` : ''}
          ${st.corona ? `
            <circle cx="50" cy="50" r="42" fill="none" stroke="#D4AF37" stroke-width="7"/>
          ` : ''}
          ${st.endodoncia ? `
            <line x1="50" y1="6" x2="50" y2="94" stroke="#2563EB" stroke-width="8" stroke-linecap="round"/>
          ` : ''}
          ${st.implante ? `
            <rect x="33" y="20" width="34" height="60" rx="4" fill="#4B5563" opacity="0.9"/>
          ` : ''}
        </svg>
      </div>
    </div>
  `;
}

/**
 * Dispara directamente el cuadro de diálogo nativo de impresión del navegador (Ctrl + P)
 * con la Historia Clínica Odontológica Integral formateada según Resolución 1995 de 1999
 * y Resolución 839 de 2017 del MinSalud de Colombia, adaptada a cualquier tamaño de hoja
 * (Carta, A4, Oficio/Legal).
 */
export function printCompleteClinicalHistory({ patient, history }: PrintClinicalHistoryParams): void {
  const printDate = new Date().toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Orden cronológico para la historia oficial (antiguo a reciente)
  const chronologicalHistory = [...history].reverse();

  // Obtener el odontograma más reciente
  let latestOdontogram: any = null;
  for (const entry of history) {
    if (entry.odontograma) {
      latestOdontogram = entry.odontograma;
      break;
    }
  }

  // Extraer hallazgos técnicos del odontograma
  const dentalFindings: DentalFindingRow[] = [];
  if (latestOdontogram?.cuadrantes) {
    Object.values(latestOdontogram.cuadrantes).forEach((quadrant: any) => {
      if (!quadrant?.piezas) return;
      Object.values(quadrant.piezas).forEach((tooth: any) => {
        const fdi = tooth.codigo_fdi;
        const nombre = tooth.nombre_anatomico;

        // 1. Símbolos técnicos
        const sym = tooth.simbolos_tecnicos;
        if (sym) {
          if (sym.diente_extraido) {
            dentalFindings.push({ fdi, nombre, superficie: 'Pieza completa', hallazgo: 'Diente Ausente / Extraído', tipo: 'simbolo' });
          }
          if (sym.extraccion_requerida) {
            dentalFindings.push({ fdi, nombre, superficie: 'Pieza completa', hallazgo: 'Indicación de Exodoncia', tipo: 'simbolo' });
          }
          if (sym.corona) {
            dentalFindings.push({ fdi, nombre, superficie: 'Corona protésica', hallazgo: 'Corona Protésica Adaptada', tipo: 'simbolo' });
          }
          if (sym.implante) {
            dentalFindings.push({ fdi, nombre, superficie: 'Implante óseo', hallazgo: 'Implante Osteointegrado', tipo: 'simbolo' });
          }
          if (sym.endodoncia) {
            dentalFindings.push({ fdi, nombre, superficie: 'Conductos radiculares', hallazgo: 'Endodoncia / Tto. Conducto', tipo: 'simbolo' });
          }
          if (sym.protesis_fija) {
            dentalFindings.push({ fdi, nombre, superficie: 'Estructura protésica', hallazgo: 'Prótesis Fija Plural', tipo: 'simbolo' });
          }
          if (sym.puente) {
            dentalFindings.push({ fdi, nombre, superficie: 'Póntico / Tramo', hallazgo: 'Póntico de Puente', tipo: 'simbolo' });
          }
        }

        // 2. Caras y superficies dentales
        const caras = tooth.caras;
        if (caras) {
          Object.entries(caras).forEach(([caraName, flags]: [string, any]) => {
            if (!flags) return;
            const superficieLabel =
              caraName === 'oclusal_incisal'
                ? 'Oclusal / Incisal'
                : caraName.charAt(0).toUpperCase() + caraName.slice(1);

            if (flags.caries_activa) {
              dentalFindings.push({ fdi, nombre, superficie: superficieLabel, hallazgo: 'Caries Dental Activa', tipo: 'caries' });
            }
            if (flags.restauracion_resina) {
              dentalFindings.push({ fdi, nombre, superficie: superficieLabel, hallazgo: 'Restauración en Resina', tipo: 'restauracion' });
            }
            if (flags.sellante_fosas) {
              dentalFindings.push({ fdi, nombre, superficie: superficieLabel, hallazgo: 'Sellante de Fosas y Fisuras', tipo: 'sellante' });
            }
            if (flags.desgaste_faceta) {
              dentalFindings.push({ fdi, nombre, superficie: superficieLabel, hallazgo: 'Faceta de Desgaste / Abrasión', tipo: 'desgaste' });
            }
          });
        }

        // 3. Nota clínica
        if (tooth.nota_clinica?.descripcion) {
          dentalFindings.push({
            fdi,
            nombre,
            superficie: tooth.nota_clinica.zona_afectada || 'Zona Periapical',
            hallazgo: tooth.nota_clinica.descripcion,
            tipo: 'nota',
          });
        }
      });
    });

    dentalFindings.sort((a, b) => a.fdi - b.fdi);
  }

  // Cálculo del Índice C.O.P. Odontológico (OMS)
  const cariadosSet = new Set<number>();
  const obturadosSet = new Set<number>();
  const perdidosSet = new Set<number>();

  dentalFindings.forEach((f) => {
    if (f.tipo === 'caries') cariadosSet.add(f.fdi);
    else if (f.tipo === 'restauracion' && !cariadosSet.has(f.fdi)) obturadosSet.add(f.fdi);
    else if (f.hallazgo.includes('Ausente') || f.hallazgo.includes('Extraído')) perdidosSet.add(f.fdi);
  });

  const c = cariadosSet.size;
  const o = obturadosSet.size;
  const p = perdidosSet.size;
  const totalCOP = c + o + p;
  const sanos = Math.max(0, 32 - totalCOP);

  // Consolidación de Antecedentes Médicos (Línea Base Sin Redundancia)
  const antecedentesPositivos: { condicion: string; detalle?: string }[] = [];
  const habitosMap: Record<string, string> = {};

  history.forEach((entry) => {
    if (entry.antecedentesClinicos) {
      Object.entries(entry.antecedentesClinicos).forEach(([k, val]: [string, any]) => {
        if (val?.presenta) {
          const formattedKey = k.replace(/_/g, ' ');
          const existing = antecedentesPositivos.find(
            (a) => a.condicion.toLowerCase() === formattedKey.toLowerCase()
          );
          if (!existing) {
            antecedentesPositivos.push({
              condicion: formattedKey,
              detalle: val.observaciones || undefined,
            });
          }
        }
      });
    }

    if (entry.habitosHigiene) {
      Object.entries(entry.habitosHigiene).forEach(([k, val]: [string, any]) => {
        if (val?.aplica || val?.frecuencia_cantidad) {
          habitosMap[k.replace(/_/g, ' ')] = `${val?.frecuencia_cantidad || 'Aplica'}${
            val?.observaciones ? ` (${val.observaciones})` : ''
          }`;
        }
      });
    }
  });

  // Claves de dientes FDI
  const q1Keys = ['18', '17', '16', '15', '14', '13', '12', '11'];
  const q2Keys = ['21', '22', '23', '24', '25', '26', '27', '28'];
  const q4Keys = ['48', '47', '46', '45', '44', '43', '42', '41'];
  const q3Keys = ['31', '32', '33', '34', '35', '36', '37', '38'];

  // Odontograma SVG interactivo en HTML puro
  const odontogramHtml = latestOdontogram
    ? `
      <div style="border:1px solid #D1D5DB; border-radius:6px; padding:10px 12px; background:#fff; margin-bottom:12px;">
        <!-- Maxilar Superior -->
        <div style="display:flex; justify-content:space-between; font-size:7pt; font-weight:800; color:#4B5563; margin-bottom:4px; text-transform:uppercase;">
          <span>Cuadrante 1 — Maxilar Sup. Derecho</span>
          <span>Cuadrante 2 — Maxilar Sup. Izquierdo</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:6px; border-bottom:1px solid #CBD2D9;">
          <div style="display:flex; gap:2px;">
            ${q1Keys.map((k) => renderToothSvg(latestOdontogram.cuadrantes?.cuadrante_1?.piezas?.[k], k, true)).join('')}
          </div>
          <div style="width:2px; height:36px; background:#4B5563; margin:0 4px;"></div>
          <div style="display:flex; gap:2px;">
            ${q2Keys.map((k) => renderToothSvg(latestOdontogram.cuadrantes?.cuadrante_2?.piezas?.[k], k, true)).join('')}
          </div>
        </div>

        <!-- Línea Oclusal Media -->
        <div style="text-align:center; font-size:6.5pt; font-weight:800; color:#B45309; letter-spacing:1px; margin:4px 0;">
          • LÍNEA OCLUSAL MEDIA FDI •
        </div>

        <!-- Mandíbula Inferior -->
        <div style="display:flex; justify-content:space-between; align-items:center; padding-top:4px;">
          <div style="display:flex; gap:2px;">
            ${q4Keys.map((k) => renderToothSvg(latestOdontogram.cuadrantes?.cuadrante_4?.piezas?.[k], k, false)).join('')}
          </div>
          <div style="width:2px; height:36px; background:#4B5563; margin:0 4px;"></div>
          <div style="display:flex; gap:2px;">
            ${q3Keys.map((k) => renderToothSvg(latestOdontogram.cuadrantes?.cuadrante_3?.piezas?.[k], k, false)).join('')}
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:7pt; font-weight:800; color:#4B5563; margin-top:4px; text-transform:uppercase;">
          <span>Cuadrante 4 — Mandíbula Inf. Derecha</span>
          <span>Cuadrante 3 — Mandíbula Inf. Izquierda</span>
        </div>

        <!-- Convención y Leyenda Gráfica -->
        <div style="margin-top:8px; padding-top:6px; border-top:1px solid #E5E7EB; display:flex; flex-wrap:wrap; justify-content:space-between; font-size:7pt; color:#4B5563;">
          <span><strong style="color:#EF4444;">■</strong> Caries Activa</span>
          <span><strong style="color:#3B82F6;">■</strong> Restauración Resina</span>
          <span><strong style="color:#10B981;">■</strong> Sellante Fosas</span>
          <span><strong style="color:#F59E0B;">■</strong> Faceta Desgaste</span>
          <span><strong style="color:#111827;">✕</strong> Extraído</span>
          <span><strong style="color:#EF4444;">✚</strong> Indicación Exodoncia</span>
          <span><strong style="color:#D4AF37;">◯</strong> Corona</span>
          <span><strong style="color:#2563EB;">┃</strong> Endodoncia</span>
          <span><strong style="color:#4B5563;">■</strong> Implante</span>
        </div>
      </div>
    `
    : `
      <div style="padding:12px; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:6px; text-align:center; font-size:8.5pt; color:#6B7280; margin-bottom:12px;">
        Sin registro de odontograma previo almacenado en la base de datos para este paciente.
      </div>
    `;

  // Construir folios cronológicos de evolución
  const evolutionsHtml =
    chronologicalHistory.length > 0
      ? chronologicalHistory
          .map(
            (ev, idx) => `
        <div class="evolution-card" style="border:1px solid #D1D5DB; border-radius:6px; padding:10px 12px; margin-bottom:12px; background:#fff; page-break-inside:avoid; break-inside:avoid;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #E5E7EB; padding-bottom:6px; margin-bottom:8px;">
            <div>
              <span style="font-size:9.5pt; font-weight:800; color:#111827;">
                FOLIO #${idx + 1} — Fecha: ${ev.fechaRegistro}
              </span>
              <div style="font-size:8pt; color:#4B5563; margin-top:2px;">
                Profesional Responsable: <strong>${ev.profesional.nombreCompleto}</strong> (${ev.profesional.rol})
                ${ev.profesional.tarjetaProfesional ? ` • TP: ${ev.profesional.tarjetaProfesional}` : ''}
              </div>
            </div>
            <span style="font-size:7pt; font-weight:700; background:#F3F4F6; color:#374151; padding:2px 6px; border-radius:4px; border:1px solid #D1D5DB;">
              Inmutable • Firmado
            </span>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:8.5pt; margin-bottom:8px;">
            <div>
              <span style="font-size:7.5pt; font-weight:700; color:#6B7280; text-transform:uppercase; display:block;">Motivo de Consulta:</span>
              <span style="font-weight:600; color:#111827;">${ev.motivoConsulta || 'Consulta programada'}</span>
            </div>
            <div>
              <span style="font-size:7.5pt; font-weight:700; color:#6B7280; text-transform:uppercase; display:block;">Diagnóstico (CIE-10):</span>
              <span style="font-weight:600; color:#111827;">${ev.diagnostico || 'Evaluación odontológica general'}</span>
            </div>
          </div>

          ${
            ev.enfermedadActual && ev.enfermedadActual !== 'N/A'
              ? `
            <div style="font-size:8.5pt; margin-bottom:8px;">
              <span style="font-size:7.5pt; font-weight:700; color:#6B7280; text-transform:uppercase; display:block;">Enfermedad Actual:</span>
              <p style="color:#374151; margin-top:2px;">${ev.enfermedadActual}</p>
            </div>
          `
              : ''
          }

          <div style="background:#F9FAFB; border:1px solid #E5E7EB; border-radius:4px; padding:8px 10px; font-size:8.5pt; margin-bottom:8px;">
            <span style="font-size:7.5pt; font-weight:800; color:#111827; text-transform:uppercase; display:block; margin-bottom:3px;">
              Acto Operatorio / Procedimiento Realizado:
            </span>
            <p style="color:#111827; line-height:1.45; white-space:pre-line;">
              ${ev.procedimientoRealizado || 'Sin detalle de procedimiento registrado.'}
            </p>
          </div>

          ${
            ev.observaciones || ev.examenFisicoObservaciones
              ? `
            <div style="font-size:8pt; color:#4B5563; margin-bottom:6px;">
              <strong>Hallazgos y Observaciones Clínicas:</strong> ${ev.observaciones || ev.examenFisicoObservaciones}
            </div>
          `
              : ''
          }

          ${
            ev.planManejo
              ? `
            <div style="background:#F9FAFB; border:1px solid #E5E7EB; border-radius:4px; padding:8px 10px; font-size:8pt; margin-top:6px;">
              <strong style="color:#111827; display:block; margin-bottom:3px;">Plan de Manejo y Conducta:</strong>
              ${ev.planManejo.conducta ? `<p style="color:#374151; margin-bottom:4px;">${ev.planManejo.conducta}</p>` : ''}

              ${
                Array.isArray(ev.planManejo.prescripcion_farmacologica) &&
                ev.planManejo.prescripcion_farmacologica.length > 0
                  ? `
                <div style="margin-top:4px; border-top:1px solid #E5E7EB; padding-top:4px;">
                  <span style="font-weight:700; color:#1F2937;">Prescripción Farmacológica:</span>
                  ${ev.planManejo.prescripcion_farmacologica
                    .map(
                      (rx: any) => `
                    <div style="margin-top:2px;">
                      • <strong>${rx.medicamento_principio_activo} ${rx.dosis_concentracion}</strong> — ${rx.frecuencia_via} (${rx.duracion_tratamiento})
                    </div>
                  `
                    )
                    .join('')}
                </div>
              `
                  : ''
              }

              ${
                ev.planManejo.incapacidad_medica?.requiere_incapacidad
                  ? `
                <div style="margin-top:4px; color:#1F2937;">
                  🛌 <strong>Incapacidad Médica:</strong> Del ${ev.planManejo.incapacidad_medica.fecha_inicio} al ${ev.planManejo.incapacidad_medica.fecha_culminacion}.
                </div>
              `
                  : ''
              }

              ${
                ev.planManejo.remision_medica?.requiere_remision
                  ? `
                <div style="margin-top:4px; color:#1F2937;">
                  ↗️ <strong>Remisión:</strong> ${ev.planManejo.remision_medica.especialidad_destino} (Prioridad: ${ev.planManejo.remision_medica.prioridad_atencion}).
                </div>
              `
                  : ''
              }
            </div>
          `
              : ''
          }

          <div style="text-align:right; margin-top:8px; border-top:1px dashed #E5E7EB; padding-top:4px;">
            <span style="font-size:7.5pt; font-weight:800; color:#111827;">Dr(a). ${ev.profesional.nombreCompleto}</span>
            <span style="font-size:7pt; color:#6B7280; margin-left:6px;">Odontólogo(a) Tratante</span>
          </div>
        </div>
      `
          )
          .join('')
      : `
        <div style="padding:16px; background:#F9FAFB; border:1px dashed #D1D5DB; border-radius:6px; text-align:center; font-size:9pt; color:#6B7280;">
          No existen registros de evolución asistencial para este paciente.
        </div>
      `;

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Historia Clínica - ${patient.nombreCompleto}</title>
      <style>
        @page {
          size: portrait;
          margin: 10mm 12mm 10mm 12mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }
        html, body {
          width: 100%;
          background: #ffffff;
          color: #111827;
          font-size: 8.5pt;
          line-height: 1.4;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .sheet {
          width: 100%;
          max-width: 100%;
          margin: 0;
          box-sizing: border-box;
        }
        .header {
          border-top: 4px solid #D4AF37;
          padding-top: 8px;
          padding-bottom: 8px;
          border-bottom: 2px solid #111827;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .clinic-name {
          font-size: 13pt;
          font-weight: 900;
          color: #111827;
          letter-spacing: 0.5px;
        }
        .clinic-sub {
          font-size: 7.5pt;
          color: #4B5563;
          margin-top: 1px;
          font-weight: 600;
        }
        .doc-title {
          font-size: 10pt;
          font-weight: 800;
          color: #111827;
          text-align: right;
        }
        .doc-meta {
          font-size: 7pt;
          color: #6B7280;
          text-align: right;
          margin-top: 2px;
        }
        .patient-box {
          background: #F9FAFB;
          border: 1px solid #D1D5DB;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 10px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          font-size: 8pt;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .patient-box div {
          word-break: break-word;
        }
        .section-title {
          font-size: 8.5pt;
          font-weight: 800;
          color: #111827;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
          padding-bottom: 3px;
          border-bottom: 1.5px solid #111827;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .baseline-box {
          border: 1px solid #D1D5DB;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 10px;
          font-size: 8pt;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .findings-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8pt;
          margin-top: 6px;
          margin-bottom: 8px;
        }
        .findings-table th {
          background: #F3F4F6;
          border: 1px solid #D1D5DB;
          padding: 4px 6px;
          text-align: left;
          font-size: 7.5pt;
          font-weight: 800;
          color: #374151;
        }
        .findings-table td {
          border: 1px solid #E5E7EB;
          padding: 3px 6px;
          color: #1F2937;
        }
        .signatures {
          margin-top: 20px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          page-break-inside: avoid;
          break-inside: avoid;
          text-align: center;
        }
        .sig-line {
          border-top: 1.5px solid #111827;
          margin: 0 auto 4px auto;
          width: 80%;
        }
        .legal-notice {
          font-size: 6.5pt;
          color: #6B7280;
          line-height: 1.35;
          margin-top: 14px;
          padding: 6px 10px;
          background: #F9FAFB;
          border: 1px solid #E5E7EB;
          border-radius: 4px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        @media print {
          html, body {
            width: 100%;
            height: auto;
            margin: 0;
            padding: 0;
          }
          .sheet {
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <!-- Encabezado Institucional -->
        <div class="header">
          <div>
            <div class="clinic-name">ODONTOLEAL CLÍNICA ODONTOLÓGICA S.A.S.</div>
            <div class="clinic-sub">NIT: XX.XXX.XX • Código Habilitación REPS MinSalud: XXXXXXXX</div>
            <div class="clinic-sub">Calle 21A # 10-57, Tunja, Boyacá. • PBX: (XXX) XXX-XXXX • correo@odontoleal.com</div>
          </div>
          <div>
            <div class="doc-title">HISTORIA CLÍNICA INTEGRAL</div>
            <div class="doc-meta">Resolución 1995 de 1999 • Res. 839 de 2017</div>
            <div class="doc-meta">Expedición: ${printDate}</div>
          </div>
        </div>

        <!-- Identificación del Paciente -->
        <div class="patient-box">
          <div><strong style="color:#6B7280; display:block; font-size:7pt;">PACIENTE:</strong><strong>${patient.nombreCompleto}</strong></div>
          <div><strong style="color:#6B7280; display:block; font-size:7pt;">DOCUMENTO:</strong>CC/TI ${patient.documentoIdentidad}</div>
          <div><strong style="color:#6B7280; display:block; font-size:7pt;">FECHA NACIMIENTO / EDAD:</strong>${patient.fechaNacimiento || 'N/R'} ${patient.edad !== undefined ? `(${patient.edad} años)` : ''}</div>
          <div><strong style="color:#6B7280; display:block; font-size:7pt;">SEXO:</strong>${patient.sexo || 'Sin registrar (datos incompletos)'}</div>
          <div><strong style="color:#6B7280; display:block; font-size:7pt;">TELÉFONO:</strong>${patient.telefono || 'Sin teléfono'}</div>
          <div style="grid-column: span 2;"><strong style="color:#6B7280; display:block; font-size:7pt;">CORREO:</strong>${patient.correo || 'Sin correo'}</div>
          <div><strong style="color:#6B7280; display:block; font-size:7pt;">ID EXPEDIENTE:</strong>#${patient.idPaciente}</div>
        </div>

        <!-- Línea Base de Antecedentes y Factores de Riesgo (Sin redundancia) -->
        <div class="baseline-box">
          <div style="font-weight:800; font-size:8pt; color:#111827; margin-bottom:4px; text-transform:uppercase;">
            Línea Base de Antecedentes y Factores de Riesgo Clínico:
          </div>
          ${
            antecedentesPositivos.length > 0
              ? `
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:4px;">
              ${antecedentesPositivos
                .map(
                  (a) => `
                <div style="background:#FEE2E2; border:1px solid #FCA5A5; color:#991B1B; padding:2px 6px; border-radius:4px; font-size:7.5pt;">
                  <strong>⚠️ ${a.condicion}:</strong> ${a.detalle || 'Reportado positivo'}
                </div>
              `
                )
                .join('')}
            </div>
          `
              : `
            <div style="color:#166534; font-size:7.5pt; margin-bottom:4px;">
              ✓ Sin antecedentes patológicos ni alergias sistémicas de relevancia clínica reportados por el paciente.
            </div>
          `
          }
          ${
            Object.keys(habitosMap).length > 0
              ? `
            <div style="border-top:1px dashed #E5E7EB; padding-top:4px; font-size:7.5pt; color:#4B5563; display:flex; flex-wrap:wrap; gap:10px;">
              ${Object.entries(habitosMap)
                .map(([h, val]) => `<span><strong>${h}:</strong> ${val}</span>`)
                .join('')}
            </div>
          `
              : ''
          }
        </div>

        <!-- Odontograma Clínico Integral y Hallazgos Técnicos -->
        <div style="page-break-inside:avoid; break-inside:avoid; margin-bottom:12px;">
          <div class="section-title">
            <span>Estado Odontológico Actual y Odontograma FDI</span>
            <span style="font-size:7.5pt; font-weight:700; color:#374151;">
              Índice C.O.P.: ${totalCOP} (C:${c} • O:${o} • P:${p} • Sanos:${sanos})
            </span>
          </div>

          ${odontogramHtml}

          ${
            dentalFindings.length > 0
              ? `
            <table class="findings-table">
              <thead>
                <tr>
                  <th style="width:12%;">Pieza FDI</th>
                  <th style="width:38%;">Nombre Anatómico</th>
                  <th style="width:20%;">Superficie / Cara</th>
                  <th style="width:30%;">Diagnóstico / Hallazgo</th>
                </tr>
              </thead>
              <tbody>
                ${dentalFindings
                  .map(
                    (f) => `
                  <tr>
                    <td style="font-weight:800;">#${f.fdi}</td>
                    <td style="color:#4B5563;">${f.nombre}</td>
                    <td>${f.superficie}</td>
                    <td><strong style="color:${
                      f.tipo === 'caries'
                        ? '#DC2626'
                        : f.tipo === 'restauracion'
                        ? '#2563EB'
                        : f.tipo === 'simbolo'
                        ? '#B45309'
                        : '#111827'
                    };">${f.hallazgo}</strong></td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          `
              : ''
          }
        </div>

        <!-- Notas Cronológicas de Evolución Clínica -->
        <div class="section-title">
          <span>Registro Cronológico de Notas de Evolución (${chronologicalHistory.length})</span>
          <span style="font-size:7pt; color:#6B7280;">Orden Cronológico Directo</span>
        </div>

        ${evolutionsHtml}

        <!-- Firmas y Cierre Legal de Custodia -->
        <div class="signatures">
          <div>
            <div class="sig-line"></div>
            <div style="font-weight:800; font-size:8pt; color:#111827;">DIRECCIÓN MÉDICA Y AUDITORÍA</div>
            <div style="font-size:7pt; color:#6B7280;">OdontoLeal Clínica Odontológica S.A.S.</div>
          </div>
          <div>
            <div class="sig-line"></div>
            <div style="font-weight:800; font-size:8pt; color:#111827;">${patient.nombreCompleto}</div>
            <div style="font-size:7pt; color:#6B7280;">Firma del Paciente / Titular (CC ${patient.documentoIdentidad})</div>
          </div>
        </div>

        <div class="legal-notice">
          <strong>CUSTODIA Y RESERVA MÉDICO-LEGAL:</strong> Conforme a la Ley 23 de 1981, Ley 527 de 1999, Resolución 1995 de 1999 y Resolución 839 de 2017 del Ministerio de Salud y Protección Social, este documento clínico es copia auténtica y confidencial del expediente clínico integral del paciente. Queda prohibida su reproducción, uso indebido o alteración sin autorización expresa.
        </div>
      </div>
    </body>
    </html>
  `;

  // Disparar directamente el diálogo nativo de impresión del navegador mediante un iframe invisible
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    if (iframe.parentNode) document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const handlePrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Error invoking native print dialog for clinical history:', err);
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }
  };

  setTimeout(handlePrint, 150);
}
