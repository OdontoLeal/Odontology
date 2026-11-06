// src/modules/clinical-documents/application/clinical-document-pdf-generator.service.ts
import { PDFDocument, StandardFonts, rgb, degrees, PDFPage, PDFFont, Color } from 'pdf-lib';
import { PdfGenerationPayload } from './embed-professional-signature.service';

/**
 * Dibuja texto dividiéndolo en renglones que respeten el ancho máximo disponible
 * y los saltos de línea explícitos, evitando desbordamientos fuera del margen.
 * Retorna la coordenada Y resultante para el siguiente elemento.
 */
function drawWrappedText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    maxWidth: number;
    size: number;
    font: PDFFont;
    color?: Color;
    lineHeight?: number;
  }
): number {
  if (!text || !text.trim()) return options.y;

  const lineHeight = options.lineHeight ?? options.size * 1.35;
  const paragraphs = text.trim().split(/\r?\n/);
  let y = options.y;

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/);
    if (words.length === 0 || (words.length === 1 && words[0] === '')) {
      y -= lineHeight * 0.5;
      continue;
    }

    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = options.font.widthOfTextAtSize(testLine, options.size);
      if (testWidth > options.maxWidth && currentLine) {
        page.drawText(currentLine, {
          x: options.x,
          y,
          size: options.size,
          font: options.font,
          color: options.color,
        });
        y -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      page.drawText(currentLine, {
        x: options.x,
        y,
        size: options.size,
        font: options.font,
        color: options.color,
      });
      y -= lineHeight;
    }
  }

  return y;
}

export class ClinicalDocumentPdfGeneratorService {
  /**
   * RF-DOC-001 a RF-DOC-004: genera el PDF en memoria para descargarlo o imprimirlo
   * al momento. El servidor no guarda el archivo (D-27).
   */
  public static async generate(payload: PdfGenerationPayload & { idPaciente: number; idCita: number }): Promise<{
    nombreArchivo: string;
    pdfBytes: Uint8Array;
  }> {
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const pageWidth = 612; // Carta (Letter)
    const pageHeight = 792;
    const marginX = 50;
    const marginY = 50;
    const contentWidth = pageWidth - 2 * marginX;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - marginY;

    const navyColor = rgb(0.07, 0.1, 0.15); // #111827
    const goldColor = rgb(0.83, 0.69, 0.22); // #D4AF37
    const darkTextColor = rgb(0.12, 0.14, 0.17); // #1E242B
    const grayTextColor = rgb(0.41, 0.45, 0.5); // #687380
    const lightBgColor = rgb(0.97, 0.98, 0.98); // #F8F9FA
    const borderColor = rgb(0.89, 0.9, 0.92); // #E2E6EA

    // 1. Marca de agua suave en diagonal
    page.drawText('ODONTOLEAL - DOCUMENTO OFICIAL', {
      x: 80,
      y: 350,
      size: 32,
      font: fontBold,
      color: rgb(0.92, 0.93, 0.94),
      rotate: degrees(45),
    });

    // 2. Encabezado institucional
    page.drawRectangle({
      x: marginX,
      y: currentY + 10,
      width: contentWidth,
      height: 3,
      color: goldColor,
    });

    page.drawText('CONSULTORIO ODONTOLÓGICO DR. EDUAR LEAL ÁLVAREZ', {
      x: marginX,
      y: currentY - 5,
      size: 11,
      font: fontBold,
      color: navyColor,
    });

    page.drawText('ODONTOLEAL • NIT: XX.XXXX.XX', {
      x: marginX,
      y: currentY - 18,
      size: 7.5,
      font: fontRegular,
      color: grayTextColor,
    });

    currentY -= 40;

    // 3. Título del Documento
    let tituloDocumento = 'DOCUMENTO CLÍNICO OFICIAL';
    if (payload.tipoDocumento === 'ORDEN_MEDICAMENTOS') {
      tituloDocumento = 'FÓRMULA MÉDICA / ORDEN DE MEDICAMENTOS';
    } else if (payload.tipoDocumento === 'INCAPACIDAD') {
      tituloDocumento = 'CERTIFICADO DE INCAPACIDAD MÉDICA';
    } else if (payload.tipoDocumento === 'REMISION') {
      tituloDocumento = 'ORDEN DE REMISIÓN INTERCONSULTA';
    }

    page.drawRectangle({
      x: marginX,
      y: currentY - 24,
      width: contentWidth,
      height: 28,
      color: lightBgColor,
      borderColor,
      borderWidth: 1,
    });

    page.drawText(tituloDocumento, {
      x: marginX + 15,
      y: currentY - 16,
      size: 10,
      font: fontBold,
      color: navyColor,
    });

    currentY -= 45;

    // 4. Datos del Paciente
    page.drawRectangle({
      x: marginX,
      y: currentY - 45,
      width: contentWidth,
      height: 45,
      color: lightBgColor,
      borderColor,
      borderWidth: 0.8,
    });

    page.drawText(`Paciente: ${payload.paciente.nombreCompleto}`, {
      x: marginX + 10,
      y: currentY - 16,
      size: 8.5,
      font: fontBold,
      color: darkTextColor,
    });

    page.drawText(`Documento: CC ${payload.paciente.documentoIdentidad}`, {
      x: marginX + 280,
      y: currentY - 16,
      size: 8.5,
      font: fontRegular,
      color: darkTextColor,
    });

    page.drawText(`Edad: ${payload.paciente.edad} años`, {
      x: marginX + 10,
      y: currentY - 32,
      size: 8.5,
      font: fontRegular,
      color: darkTextColor,
    });

    page.drawText(`Fecha de Expedición: ${payload.fechaExpedicionColombia}`, {
      x: marginX + 280,
      y: currentY - 32,
      size: 8.5,
      font: fontRegular,
      color: darkTextColor,
    });

    currentY -= 65;

    // 5. Contenido Específico según tipo de documento
    if (payload.tipoDocumento === 'ORDEN_MEDICAMENTOS') {
      const medicamentos = (payload.detalles as any)?.medicamentos || [];
      page.drawText('PRESCRIPCIÓN FARMACOLÓGICA:', {
        x: marginX,
        y: currentY,
        size: 9.5,
        font: fontBold,
        color: navyColor,
      });
      currentY -= 18;

      if (medicamentos.length === 0) {
        page.drawText('Sin medicamentos formulados.', {
          x: marginX + 10,
          y: currentY,
          size: 8.5,
          font: fontItalic,
          color: grayTextColor,
        });
        currentY -= 20;
      } else {
        medicamentos.forEach((med: any, index: number) => {
          // 1. Nombre y presentación del medicamento
          const nombre = (
            med.nombrePresentacion ||
            med.nombreMedicamento ||
            med.medicamento_principio_activo ||
            'Medicamento'
          ).trim();
          const extraPresentacion = med.presentacionConcentracion
            ? ` (${String(med.presentacionConcentracion).trim()})`
            : '';
          const tituloMed = `${index + 1}. ${nombre}${extraPresentacion}`;

          currentY = drawWrappedText(page, tituloMed, {
            x: marginX + 10,
            y: currentY,
            maxWidth: contentWidth - 20,
            size: 9,
            font: fontBold,
            color: darkTextColor,
            lineHeight: 13,
          });

          // 2. Línea de especificación posológica (sin campos undefined)
          const partes: string[] = [];

          const cantidadVal = med.cantidad ? String(med.cantidad).trim() : '';
          if (cantidadVal && cantidadVal !== 'undefined') {
            partes.push(`Cantidad: ${cantidadVal}`);
          }

          const dosisVal = (med.dosis ?? med.dosis_concentracion) ? String(med.dosis ?? med.dosis_concentracion).trim() : '';
          if (dosisVal && dosisVal !== 'undefined') {
            partes.push(`Dosis: ${dosisVal}`);
          }

          const viaVal = (med.viaAdministracion ?? med.via) ? String(med.viaAdministracion ?? med.via).trim() : '';
          if (viaVal && viaVal !== 'undefined') {
            partes.push(`Vía: ${viaVal}`);
          }

          const frecVal = (med.frecuencia ?? med.frecuencia_via) ? String(med.frecuencia ?? med.frecuencia_via).trim() : '';
          if (frecVal && frecVal !== 'undefined') {
            partes.push(`Frecuencia: ${frecVal}`);
          }

          const rawDur = med.duracion ?? med.duracion_tratamiento ?? (med.duracionDias ? `${med.duracionDias} días` : '');
          const durVal = rawDur ? String(rawDur).trim() : '';
          if (durVal && durVal !== 'undefined') {
            const durTexto = /d[ií]a/i.test(durVal) ? durVal : `${durVal} días`;
            partes.push(`Duración: ${durTexto}`);
          }

          if (partes.length > 0) {
            currentY = drawWrappedText(page, partes.join(' | '), {
              x: marginX + 20,
              y: currentY,
              maxWidth: contentWidth - 30,
              size: 8,
              font: fontRegular,
              color: grayTextColor,
              lineHeight: 12,
            });
          }

          // 3. Indicaciones específicas del fármaco
          const indicacionMed = med.indicacionesUso ?? med.indicaciones_adicionales ?? med.indicaciones;
          if (indicacionMed && String(indicacionMed).trim() && String(indicacionMed).trim() !== 'undefined') {
            currentY = drawWrappedText(page, `Indicaciones: ${String(indicacionMed).trim()}`, {
              x: marginX + 20,
              y: currentY,
              maxWidth: contentWidth - 30,
              size: 8,
              font: fontItalic,
              color: darkTextColor,
              lineHeight: 12,
            });
          }

          currentY -= 6;
        });
      }

      const indicacionesGenerales = (payload.detalles as any)?.indicacionesAdicionales;
      if (indicacionesGenerales && String(indicacionesGenerales).trim() && String(indicacionesGenerales).trim() !== 'undefined') {
        page.drawText('Indicaciones Adicionales / Cuidados:', {
          x: marginX,
          y: currentY,
          size: 9,
          font: fontBold,
          color: navyColor,
        });
        currentY -= 14;
        currentY = drawWrappedText(page, String(indicacionesGenerales).trim(), {
          x: marginX + 10,
          y: currentY,
          maxWidth: contentWidth - 20,
          size: 8.5,
          font: fontRegular,
          color: darkTextColor,
          lineHeight: 12,
        });
        currentY -= 15;
      }
    } else if (payload.tipoDocumento === 'INCAPACIDAD') {
      const dias = (payload.detalles as any)?.diasIncapacidad || 1;
      const motivo = (payload.detalles as any)?.motivoIncapacidad || 'Procedimiento odontológico';

      page.drawText('CERTIFICACIÓN CLÍNICA:', {
        x: marginX,
        y: currentY,
        size: 9.5,
        font: fontBold,
        color: navyColor,
      });
      currentY -= 18;

      const certText = `Se certifica que el/la paciente ${payload.paciente.nombreCompleto}, identificado(a) con cédula ${payload.paciente.documentoIdentidad}, requiere un periodo de reposo e incapacidad médica por un término de ${dias} día(s).`;
      currentY = drawWrappedText(page, certText, {
        x: marginX + 10,
        y: currentY,
        maxWidth: contentWidth - 20,
        size: 8.5,
        font: fontRegular,
        color: darkTextColor,
        lineHeight: 13,
      });
      currentY -= 8;

      currentY = drawWrappedText(page, `Motivo / Diagnóstico: ${motivo}`, {
        x: marginX + 10,
        y: currentY,
        maxWidth: contentWidth - 20,
        size: 8.5,
        font: fontBold,
        color: darkTextColor,
        lineHeight: 13,
      });
      currentY -= 10;

      // RF-DOC-002: fechas de inicio y fin (la incapacidad inicia el día de expedición)
      const inicio = (payload.detalles as any)?.fechaInicioIncapacidad;
      const fin = (payload.detalles as any)?.fechaFinIncapacidad;
      if (inicio && fin) {
        page.drawText(`Desde: ${inicio}    Hasta: ${fin}`, {
          x: marginX + 10,
          y: currentY,
          size: 8.5,
          font: fontRegular,
          color: darkTextColor,
        });
        currentY -= 18;
      }

      // RF-DOC-002: si es menor, campos en blanco para el acudiente (se diligencian a mano)
      if ((payload.detalles as any)?.requiereFirmaAcudiente) {
        for (const label of ['Nombre del acudiente:', 'Documento del acudiente:', 'Firma del acudiente:']) {
          page.drawText(label, { x: marginX + 10, y: currentY, size: 8.5, font: fontRegular, color: darkTextColor });
          page.drawLine({
            start: { x: marginX + 150, y: currentY - 2 },
            end: { x: marginX + 420, y: currentY - 2 },
            thickness: 0.6,
            color: grayTextColor,
          });
          currentY -= 20;
        }
      }
      currentY -= 12;
    } else if (payload.tipoDocumento === 'REMISION') {
      const esp = (payload.detalles as any)?.especialidadDestino || 'Especialidad Odontológica';
      const mot = (payload.detalles as any)?.motivoRemision || 'Valoración especializada';

      page.drawText('INTERCONSULTA Y REMISIÓN:', {
        x: marginX,
        y: currentY,
        size: 9.5,
        font: fontBold,
        color: navyColor,
      });
      currentY -= 18;

      currentY = drawWrappedText(page, `Especialidad Solicitada: ${esp}`, {
        x: marginX + 10,
        y: currentY,
        maxWidth: contentWidth - 20,
        size: 9,
        font: fontBold,
        color: darkTextColor,
        lineHeight: 13,
      });
      currentY -= 6;

      currentY = drawWrappedText(page, `Motivo de Remisión: ${mot}`, {
        x: marginX + 10,
        y: currentY,
        maxWidth: contentWidth - 20,
        size: 8.5,
        font: fontRegular,
        color: darkTextColor,
        lineHeight: 13,
      });
      currentY -= 20;
    }

    // 6. Sección de Firma del Profesional
    currentY = Math.min(currentY, 180);

    const docName = payload.firmaProfesional?.nombreProfesional || 'Dr. Eduar Leal Álvarez';
    const firmaUrl = payload.firmaProfesional?.imagenFirmaUrl;

    if (firmaUrl && firmaUrl.startsWith('data:image/')) {
      try {
        const base64Data = firmaUrl.split(',')[1];
        const imgBytes = Buffer.from(base64Data, 'base64');
        const img = firmaUrl.includes('image/png')
          ? await pdfDoc.embedPng(imgBytes)
          : await pdfDoc.embedJpg(imgBytes);

        page.drawImage(img, {
          x: marginX + 130,
          y: currentY + 10,
          width: 140,
          height: 45,
        });
      } catch {
        // Fallback si la imagen Base64 no es válida
      }
    }

    // Línea de firma
    page.drawLine({
      start: { x: marginX + 100, y: currentY + 5 },
      end: { x: marginX + 350, y: currentY + 5 },
      thickness: 1,
      color: darkTextColor,
    });

    page.drawText(docName, {
      x: marginX + 140,
      y: currentY - 8,
      size: 9,
      font: fontBold,
      color: navyColor,
    });

    page.drawText('Profesional Tratante • OdontoLeal', {
      x: marginX + 145,
      y: currentY - 20,
      size: 7.5,
      font: fontRegular,
      color: grayTextColor,
    });

    const pdfBytes = await pdfDoc.save();
    const slugTipo = payload.tipoDocumento.toLowerCase().replace(/_/g, '-');

    return {
      nombreArchivo: `cita-${payload.idCita}-${slugTipo}.pdf`,
      pdfBytes,
    };
  }
}
