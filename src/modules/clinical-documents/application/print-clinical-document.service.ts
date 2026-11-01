// src/modules/clinical-documents/application/print-clinical-document.service.ts

export interface PrintClinicalDocumentParams {
  tipo: 'RECETA' | 'INCAPACIDAD' | 'REMISION';
  patientName: string;
  patientDoc?: string;
  patientAge?: number;
  patientSex?: string;
  doctorName?: string;
  doctorSignature?: string | null;
  doctorRole?: string;
  displayDate?: string;
  diagnostico?: string;
  procedimiento?: string;
  medications?: Array<{
    medicamento_principio_activo: string;
    dosis_concentracion: string;
    frecuencia_via: string;
    duracion_tratamiento: string;
  }>;
  incapacidad?: {
    dias_incapacidad?: number;
    fecha_inicio?: string;
    fecha_fin?: string;
    diagnostico_cie10?: string;
    observaciones?: string;
  };
  remision?: {
    especialidad_destino?: string;
    motivo_remision?: string;
    resumen_clinico?: string;
  };
}

/**
 * Dispara directamente el cuadro nativo de impresión del navegador (Ctrl + P)
 * sin abrir vistas previas personalizadas, asociando el documento al doctor
 * que atendió la cita y estampando su firma digital registrada (RF-DOC-001 a RF-DOC-004).
 */
export function printClinicalDocument(params: PrintClinicalDocumentParams): void {
  const docTitle =
    params.tipo === 'RECETA'
      ? 'FÓRMULA MÉDICA / RECETARIO OFICIAL'
      : params.tipo === 'INCAPACIDAD'
      ? 'CERTIFICADO DE INCAPACIDAD MÉDICA'
      : 'ORDEN DE REMISIÓN ESPECIALIZADA';

  const fechaHoy =
    params.displayDate ||
    new Date().toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const doctor = params.doctorName || 'Dr. Eduar Leal Álvarez';
  const doctorRole = params.doctorRole || 'Odontólogo Tratante • Consultorio OdontoLeal';

  // Formatear firma Base64 si existe
  const doctorSig = params.doctorSignature
    ? params.doctorSignature.startsWith('data:')
      ? params.doctorSignature
      : `data:image/png;base64,${params.doctorSignature}`
    : null;

  let bodyHtml = '';
  if (params.tipo === 'RECETA') {
    const meds = params.medications || [];
    bodyHtml = `
      <div class="section-title">PRESCRIPCIÓN FARMACOLÓGICA / MEDICAMENTOS</div>
      <table class="med-table">
        <thead>
          <tr>
            <th style="width: 35%">MEDICAMENTO / PRINCIPIO ACTIVO</th>
            <th style="width: 20%">CONCENTRACIÓN / DOSIS</th>
            <th style="width: 25%">VÍA / FRECUENCIA</th>
            <th style="width: 20%">DURACIÓN</th>
          </tr>
        </thead>
        <tbody>
          ${meds
            .map(
              (m, idx) => `
            <tr>
              <td><strong>${idx + 1}. ${m.medicamento_principio_activo || 'Sin especificar'}</strong></td>
              <td>${m.dosis_concentracion || 'Según indicación'}</td>
              <td>${m.frecuencia_via || 'Vía oral'}</td>
              <td>${m.duracion_tratamiento || 'Según evolución'}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      <div class="recommendations">
        <strong>RECOMENDACIONES GENERALES:</strong>
        <ul>
          <li>Consumir los medicamentos en las dosis y horarios estrictamente prescritos.</li>
          <li>Tomar los analgésicos y antibióticos con abundante agua, preferiblemente después de las comidas.</li>
          <li>En caso de reacciones alérgicas o erupciones cutáneas, suspender el medicamento y comunicarse de inmediato con el consultorio.</li>
        </ul>
      </div>
    `;
  } else if (params.tipo === 'INCAPACIDAD') {
    const inc = params.incapacidad || {};
    bodyHtml = `
      <div class="section-title">CONSTANCIA DE INCAPACIDAD MÉDICA LABORAL / ACADÉMICA</div>
      <div class="incapacidad-box">
        <p style="margin-bottom: 12px; font-size: 11px; line-height: 1.6;">
          Por medio de la presente, se certifica que el(la) paciente <strong>${params.patientName}</strong>, 
          identificado(a) con documento N.° <strong>${params.patientDoc || 'Sin registrar'}</strong>, 
          requiere reposo médico debido a atención odontológica realizada en nuestras instalaciones.
        </p>
        <table class="inc-details">
          <tr>
            <td style="width: 35%"><strong>Días de reposo concedidos:</strong></td>
            <td><span class="days-badge">${inc.dias_incapacidad || 1} día(s)</span></td>
          </tr>
          <tr>
            <td><strong>Período de incapacidad:</strong></td>
            <td>Desde <strong>${inc.fecha_inicio || fechaHoy}</strong> hasta <strong>${inc.fecha_fin || fechaHoy}</strong></td>
          </tr>
          <tr>
            <td><strong>Diagnóstico / Procedimiento:</strong></td>
            <td>${inc.diagnostico_cie10 || params.diagnostico || params.procedimiento || 'Procedimiento quirúrgico / terapéutico odontológico'}</td>
          </tr>
          <tr>
            <td><strong>Observaciones / Cuidados:</strong></td>
            <td>${inc.observaciones || 'Reposo relativo, evitar esfuerzo físico o exposición al calor y cumplir con las recomendaciones postoperatorias.'}</td>
          </tr>
        </table>
      </div>
    `;
  } else {
    const rem = params.remision || {};
    bodyHtml = `
      <div class="section-title">ORDEN DE REMISIÓN / VALORACIÓN ESPECIALIZADA</div>
      <div class="remision-box">
        <p style="font-size: 11px;">Se remite al(a la) paciente <strong>${params.patientName}</strong> para valoración y manejo por:</p>
        <div class="specialty-badge" style="margin: 10px 0;">${rem.especialidad_destino || 'Especialidad Odontológica'}</div>
        <p style="margin-top: 15px; font-size: 11px;"><strong>Motivo de la remisión:</strong></p>
        <div class="reason-box">${rem.motivo_remision || 'Valoración y tratamiento especializado de acuerdo con hallazgos clínicos.'}</div>
        <p style="margin-top: 15px; font-size: 11px;"><strong>Resumen de historia clínica / Hallazgos:</strong></p>
        <div class="summary-box">${rem.resumen_clinico || params.diagnostico || 'Paciente en consulta con necesidad de atención especializada.'}</div>
      </div>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>${docTitle} - ${params.patientName}</title>
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
          margin: 0;
          padding: 0;
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
          border-bottom: 2px solid #E2E6EA;
          margin-bottom: 10px;
        }
        .clinic-name {
          font-size: 13pt;
          font-weight: 900;
          color: #111827;
          letter-spacing: 0.5px;
        }
        .clinic-sub {
          font-size: 8pt;
          color: #687380;
          margin-top: 2px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .doc-title {
          font-size: 11pt;
          font-weight: 800;
          color: #111827;
          margin-top: 8px;
          letter-spacing: 0.3px;
        }
        .legal-ref {
          font-size: 7.5pt;
          color: #687380;
          font-style: italic;
          margin-top: 2px;
        }
        .patient-box {
          background: #F8F9FA;
          border: 1px solid #E2E6EA;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 12px;
          font-size: 9pt;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .patient-box strong {
          color: #111827;
        }
        .section-title {
          font-size: 9.5pt;
          font-weight: 800;
          color: #111827;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
          padding-bottom: 3px;
          border-bottom: 1px solid #D4AF37;
        }
        .med-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
          font-size: 9pt;
          margin-bottom: 12px;
        }
        .med-table th {
          background: #F8F9FA;
          border: 1px solid #E2E6EA;
          padding: 6px 8px;
          text-align: left;
          font-size: 8.5pt;
          color: #4B5563;
        }
        .med-table td {
          border: 1px solid #E2E6EA;
          padding: 6px 8px;
          color: #1F2937;
          word-break: break-word;
        }
        .recommendations {
          background: #FFFDF5;
          border: 1px solid #F5E6B3;
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 8.5pt;
          color: #4B5563;
          line-height: 1.4;
          margin-bottom: 14px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .recommendations ul {
          margin-left: 18px;
          margin-top: 3px;
        }
        .signature-section {
          margin-top: 16px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .sig-box {
          font-size: 9pt;
        }
        .sig-img-container {
          height: 48px;
          display: flex;
          align-items: flex-end;
          justify-content: flex-start;
          margin-bottom: 4px;
        }
        .sig-img {
          max-height: 46px;
          max-width: 160px;
          object-fit: contain;
        }
        .sig-line {
          border-top: 1.5px solid #111827;
          margin-bottom: 4px;
        }
        .sig-box .name {
          font-weight: 800;
          color: #111827;
        }
        .sig-box .role {
          color: #4B5563;
          font-size: 8pt;
          margin-top: 1px;
        }
        .sig-box .reg {
          color: #6B7280;
          font-size: 7.5pt;
          font-style: italic;
          margin-top: 1px;
        }
        .footer {
          margin-top: 14px;
          padding-top: 8px;
          border-top: 1px solid #E2E6EA;
          font-size: 7pt;
          color: #9CA3AF;
          display: flex;
          justify-content: space-between;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .days-badge, .specialty-badge {
          display: inline-block;
          background: #111827;
          color: #D4AF37;
          padding: 3px 8px;
          border-radius: 4px;
          font-weight: 800;
          font-size: 9.5pt;
        }
        .inc-details {
          width: 100%;
          border-collapse: collapse;
        }
        .inc-details td {
          padding: 4px 6px;
          font-size: 9pt;
          vertical-align: top;
        }
        .reason-box, .summary-box {
          background: #F8F9FA;
          border: 1px solid #E2E6EA;
          border-radius: 6px;
          padding: 6px 8px;
          font-size: 8.5pt;
          margin-top: 3px;
          color: #1F2937;
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
          .signature-section, .patient-box, .recommendations, .footer {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="header">
          <div class="clinic-name">CONSULTORIO ODONTOLÓGICO DR. EDUAR LEAL ÁLVAREZ</div>
          <div class="clinic-sub">OdontoLeal • NIT: 91.245.678-9 • Registro Seccional de Salud Santander</div>
          <div class="doc-title">${docTitle}</div>
          <div class="legal-ref">Conforme a la Ley 23 de 1981, Ley 527 de 1999 y Resolución 1995 de 1999</div>
        </div>

        <div class="patient-box">
          <div><strong>Paciente:</strong> ${params.patientName}</div>
          <div><strong>Fecha de Emisión:</strong> ${fechaHoy}</div>
          <div><strong>Documento:</strong> ${params.patientDoc || 'Sin registrar'}</div>
          <div><strong>Profesional Tratante:</strong> ${doctor}</div>
          ${params.patientAge ? `<div><strong>Edad / Sexo:</strong> ${params.patientAge} años • ${params.patientSex || 'No especificado'}</div>` : ''}
          ${params.diagnostico ? `<div><strong>Diagnóstico:</strong> ${params.diagnostico}</div>` : ''}
        </div>

        ${bodyHtml}

        <div class="signature-section">
          <div class="sig-box">
            ${
              doctorSig
                ? `
              <div class="sig-img-container">
                <img src="${doctorSig}" alt="Firma del Profesional" class="sig-img" />
              </div>
            `
                : `
              <div style="height: 55px;"></div>
            `
            }
            <div class="sig-line"></div>
            <div class="name">${doctor}</div>
            <div class="role">${doctorRole}</div>
            <div class="reg">Registro Profesional Odontológico Santander • Colombia</div>
          </div>
          <div class="sig-box">
            <div style="height: 55px;"></div>
            <div class="sig-line"></div>
            <div class="name">${params.patientName}</div>
            <div class="role">Recibido Conforme (Paciente / Acudiente)</div>
            <div class="reg">Doc: ${params.patientDoc || 'Firma de conformidad'}</div>
          </div>
        </div>

        <div class="footer">
          <span>OdontoLeal • Sistema de Gestión Clínica Odontológica</span>
          <span>Validez probatoria conforme a la Ley 527 de 1999 • Inmutable</span>
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
      console.error('Error invoking native print dialog:', err);
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }
  };

  // Si hay imagen de firma, asegurar que cargue antes de invocar el diálogo nativo
  const img = doc.querySelector('img');
  if (img && !img.complete) {
    img.onload = () => setTimeout(handlePrint, 100);
    img.onerror = () => setTimeout(handlePrint, 100);
  } else {
    setTimeout(handlePrint, 120);
  }
}
