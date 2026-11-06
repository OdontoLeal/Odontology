// src/modules/consents/application/consent-pdf-generator.service.ts
import { PDFDocument, StandardFonts, rgb, grayscale } from 'pdf-lib';
import { PatientSignedConsentDetail } from '../domain/consent.entity';
import { interpolateConsentTemplate } from '../domain/consent-template-interpolator';

export class ConsentPdfGeneratorService {
  /**
   * Genera en memoria un documento PDF binario 100% estándar (PDF-1.7) con la firma
   * digitalizada incrustada y fusionada (flatten) según RF-CON-003 y RQNF-SEG-004.
   * Retorna el archivo codificado en Base64.
   */
  public static async generate(record: PatientSignedConsentDetail): Promise<string> {
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const pageWidth = 612; // Carta (Letter)
    const pageHeight = 792;
    const marginX = 45;
    const marginY = 45;
    const contentWidth = pageWidth - 2 * marginX;

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - marginY;

    // Colores corporativos OdontoLeal
    const navyColor = rgb(0.07, 0.1, 0.15); // #111827
    const goldColor = rgb(0.83, 0.69, 0.22); // #D4AF37
    const darkTextColor = rgb(0.12, 0.14, 0.17); // #1E242B
    const grayTextColor = rgb(0.41, 0.45, 0.5); // #687380
    const lightBgColor = rgb(0.97, 0.98, 0.98); // #F8F9FA
    const borderColor = rgb(0.89, 0.9, 0.92); // #E2E6EA

    // Helper: Dibujar encabezado en cada página
    const drawPageHeader = (isFirstPage: boolean) => {
      // Barra dorada superior
      currentPage.drawRectangle({
        x: marginX,
        y: pageHeight - marginY + 10,
        width: contentWidth,
        height: 3,
        color: goldColor,
      });

      if (isFirstPage) {
        // Encabezado institucional
        currentPage.drawText('CONSULTORIO ODONTOLÓGICO DR. EDUAR LEAL ÁLVAREZ', {
          x: marginX,
          y: currentY - 5,
          size: 11,
          font: fontBold,
          color: navyColor,
        });

        currentPage.drawText('ODONTOLEAL • NIT: XX.XXX.XXX', {
          x: marginX,
          y: currentY - 18,
          size: 7.5,
          font: fontRegular,
          color: grayTextColor,
        });

        // Título del consentimiento
        const tituloDoc = (record.nombrePlantilla || 'CONSENTIMIENTO INFORMADO').toUpperCase();
        currentPage.drawText(tituloDoc, {
          x: marginX,
          y: currentY - 38,
          size: 12,
          font: fontBold,
          color: navyColor,
        });

        currentPage.drawText(
          `Versión v${record.versionPlantilla}.0 • Ley 23 de 1981 • Resolución 1995 de 1999 • Ley 1581 de 2012`,
          {
            x: marginX,
            y: currentY - 50,
            size: 7.5,
            font: fontItalic,
            color: grayTextColor,
          }
        );

        // Separador
        currentPage.drawLine({
          start: { x: marginX, y: currentY - 58 },
          end: { x: marginX + contentWidth, y: currentY - 58 },
          thickness: 1,
          color: borderColor,
        });

        currentY -= 68;

        // Ficha de metadatos del consentimiento
        const metaBoxHeight = 52;
        currentPage.drawRectangle({
          x: marginX,
          y: currentY - metaBoxHeight,
          width: contentWidth,
          height: metaBoxHeight,
          color: lightBgColor,
          borderColor: borderColor,
          borderWidth: 1,
        });

        const pacienteNombre = record.pacienteNombre || `Paciente #${record.idPaciente}`;
        const pacienteDoc = record.pacienteDocumento ? `Doc: ${record.pacienteDocumento}` : '';
        const fechaSuscripcion = record.fecha instanceof Date
          ? record.fecha.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })
          : String(record.fecha);

        currentPage.drawText('PACIENTE TITULAR:', {
          x: marginX + 10,
          y: currentY - 15,
          size: 7.5,
          font: fontBold,
          color: grayTextColor,
        });
        currentPage.drawText(`${pacienteNombre} ${pacienteDoc ? `(${pacienteDoc})` : ''}`, {
          x: marginX + 90,
          y: currentY - 15,
          size: 8.5,
          font: fontBold,
          color: darkTextColor,
        });

        currentPage.drawText('FECHA Y HORA:', {
          x: marginX + 320,
          y: currentY - 15,
          size: 7.5,
          font: fontBold,
          color: grayTextColor,
        });
        currentPage.drawText(fechaSuscripcion, {
          x: marginX + 385,
          y: currentY - 15,
          size: 8,
          font: fontRegular,
          color: darkTextColor,
        });

        currentPage.drawText('DILIGENCIADO POR:', {
          x: marginX + 10,
          y: currentY - 30,
          size: 7.5,
          font: fontBold,
          color: grayTextColor,
        });
        currentPage.drawText(record.usuarioDiligencioNombre || 'Personal asistencial OdontoLeal', {
          x: marginX + 90,
          y: currentY - 30,
          size: 8,
          font: fontRegular,
          color: darkTextColor,
        });

        currentPage.drawText('MODALIDAD FIRMA:', {
          x: marginX + 320,
          y: currentY - 30,
          size: 7.5,
          font: fontBold,
          color: grayTextColor,
        });
        currentPage.drawText(
          record.firmaPorAcudiente
            ? 'Por acudiente / rep. legal'
            : 'Directa por titular',
          {
            x: marginX + 400,
            y: currentY - 30,
            size: 8,
            font: fontRegular,
            color: darkTextColor,
          }
        );

        if (record.firmaPorAcudiente && record.nombreDocumentoAcudiente) {
          currentPage.drawText('ACUDIENTE:', {
            x: marginX + 10,
            y: currentY - 44,
            size: 7.5,
            font: fontBold,
            color: grayTextColor,
          });
          currentPage.drawText(record.nombreDocumentoAcudiente, {
            x: marginX + 90,
            y: currentY - 44,
            size: 8,
            font: fontRegular,
            color: darkTextColor,
          });
        }

        currentY -= metaBoxHeight + 15;
      } else {
        // Encabezado reducido para páginas 2 en adelante
        currentPage.drawText(
          `ODONTOLEAL • ${record.nombrePlantilla.toUpperCase()} (v${record.versionPlantilla}.0)`,
          {
            x: marginX,
            y: currentY - 10,
            size: 8,
            font: fontBold,
            color: grayTextColor,
          }
        );
        currentPage.drawLine({
          start: { x: marginX, y: currentY - 16 },
          end: { x: marginX + contentWidth, y: currentY - 16 },
          thickness: 0.5,
          color: borderColor,
        });
        currentY -= 28;
      }
    };

    // Dibujar encabezado en página inicial
    drawPageHeader(true);

    // Renderizar cuerpo del texto firmado con ajuste de líneas y paginación
    const bodyFontSize = 8.5;
    const bodyLineHeight = 12.5;

    // Interpolar de forma defensiva si el texto firmado aún conserva marcadores {{...}} (retrocompatibilidad)
    const rawText = record.textoFirmado || '';
    const pacienteNombre = record.pacienteNombre || `Paciente #${record.idPaciente}`;
    const pacienteDoc = record.pacienteDocumento || '';

    const textoConsolidado = rawText.includes('{{') || rawText.includes('[nombre')
      ? interpolateConsentTemplate(rawText, {
          nombrePaciente: pacienteNombre,
          documentoPaciente: pacienteDoc,
          firmaPorAcudiente: Boolean(record.firmaPorAcudiente),
          nombreDocumentoAcudiente: record.nombreDocumentoAcudiente,
          fecha: record.fecha,
        })
      : rawText;

    const paragraphs = textoConsolidado.split('\n');

    for (const rawParagraph of paragraphs) {
      const paragraph = rawParagraph.trim();
      if (!paragraph) {
        currentY -= bodyLineHeight * 0.8;
        continue;
      }

      const words = paragraph.split(/\s+/);
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const textWidth = fontRegular.widthOfTextAtSize(testLine, bodyFontSize);

        if (textWidth <= contentWidth) {
          currentLine = testLine;
        } else {
          // Si no cabe más en la página actual, abrir nueva página
          if (currentY - bodyLineHeight < 170) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            currentY = pageHeight - marginY;
            drawPageHeader(false);
          }

          currentPage.drawText(currentLine, {
            x: marginX,
            y: currentY,
            size: bodyFontSize,
            font: fontRegular,
            color: darkTextColor,
          });

          currentY -= bodyLineHeight;
          currentLine = word;
        }
      }

      if (currentLine) {
        if (currentY - bodyLineHeight < 170) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          currentY = pageHeight - marginY;
          drawPageHeader(false);
        }

        currentPage.drawText(currentLine, {
          x: marginX,
          y: currentY,
          size: bodyFontSize,
          font: fontRegular,
          color: darkTextColor,
        });

        currentY -= bodyLineHeight * 1.2;
      }
    }

    // Sección de firmas: si el espacio restante es menor a 150 pt, crear página final
    if (currentY < 160) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      currentY = pageHeight - marginY;
      drawPageHeader(false);
    }

    currentY -= 15;

    // Intentar incrustar la imagen de firma Base64 si es válida
    let embeddedSignatureImage: any = null;
    if (record.firmaBase64 && record.firmaBase64.includes('base64,')) {
      try {
        const base64Data = record.firmaBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBytes = Buffer.from(base64Data, 'base64');
        if (record.firmaBase64.includes('image/png')) {
          embeddedSignatureImage = await pdfDoc.embedPng(imageBytes);
        } else {
          embeddedSignatureImage = await pdfDoc.embedJpg(imageBytes);
        }
      } catch (err) {
        console.warn('No fue posible incrustar imagen directa de firma en el PDF:', err);
      }
    }

    const sigBoxWidth = 260;
    const sigBoxY = currentY - 90;

    // Firma del Paciente / Acudiente (única requerida en el consentimiento informado)
    if (embeddedSignatureImage) {
      currentPage.drawImage(embeddedSignatureImage, {
        x: marginX + 10,
        y: sigBoxY + 32,
        width: 150,
        height: 52,
      });
    }

    currentPage.drawLine({
      start: { x: marginX, y: sigBoxY + 28 },
      end: { x: marginX + sigBoxWidth, y: sigBoxY + 28 },
      thickness: 1,
      color: darkTextColor,
    });

    const nombreFirmante = record.firmaPorAcudiente
      ? (record.nombreDocumentoAcudiente || 'Acudiente / Representante Legal')
      : (record.pacienteNombre || `Paciente #${record.idPaciente}`);

    currentPage.drawText(nombreFirmante, {
      x: marginX,
      y: sigBoxY + 16,
      size: 8.5,
      font: fontBold,
      color: darkTextColor,
    });

    currentPage.drawText(
      record.firmaPorAcudiente
        ? 'Acudiente / Representante Legal Autorizado'
        : `Paciente Titular ${record.pacienteDocumento ? `• Doc: ${record.pacienteDocumento}` : ''}`,
      {
        x: marginX,
        y: sigBoxY + 5,
        size: 7.5,
        font: fontRegular,
        color: grayTextColor,
      }
    );

    currentPage.drawText(
      `Firmado digitalmente en tablet: ${
        record.fecha instanceof Date
          ? record.fecha.toLocaleDateString('es-CO')
          : String(record.fecha)
      }`,
      {
        x: marginX,
        y: sigBoxY - 5,
        size: 7,
        font: fontItalic,
        color: grayTextColor,
      }
    );

    // Pie de página con numeración en todas las páginas
    const totalPages = pdfDoc.getPageCount();
    for (let i = 0; i < totalPages; i++) {
      const page = pdfDoc.getPage(i);
      page.drawLine({
        start: { x: marginX, y: marginY + 15 },
        end: { x: marginX + contentWidth, y: marginY + 15 },
        thickness: 0.5,
        color: borderColor,
      });

      page.drawText(
        `Página ${i + 1} de ${totalPages} • Documento médico-legal inmutable generado electrónicamente por OdontoLeal`,
        {
          x: marginX,
          y: marginY + 4,
          size: 7,
          font: fontRegular,
          color: grayTextColor,
        }
      );

      page.drawText('Validez probatoria Ley 527 de 1999', {
        x: marginX + contentWidth - 130,
        y: marginY + 4,
        size: 7,
        font: fontItalic,
        color: grayTextColor,
      });
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes).toString('base64');
  }
}
