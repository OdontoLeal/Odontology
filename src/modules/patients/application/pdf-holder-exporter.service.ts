import { PDFDocument, StandardFonts, rgb, RGB } from 'pdf-lib';
import { HolderDataRecord } from '../domain/patient.repository.interface';
import { IPdfHolderExporterPort } from './export-holder-data.use-case';

export class PdfHolderExporterService implements IPdfHolderExporterPort {
  private clean(text: string | null | undefined): string {
    if (!text) return '';
    return text
      .normalize('NFC')
      .replace(/[•●■]/g, '-')
      .replace(/[✔✓]/g, '*')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public async generateHolderDataPdf(data: HolderDataRecord): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle('Certificado Oficial de Habeas Data - OdontoLeal');
    pdfDoc.setAuthor('Consultorio Odontologico OdontoLeal');
    pdfDoc.setSubject('Certificacion de Tratamiento de Datos Personales (Ley 1581 de 2012)');

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const goldColor: RGB = rgb(0.83, 0.69, 0.22); // #D4AF37
    const darkColor: RGB = rgb(0.07, 0.09, 0.13); // #111827
    const grayColor: RGB = rgb(0.41, 0.45, 0.5); // #687380
    const lightBg: RGB = rgb(0.97, 0.98, 0.99); // #F8F9FA
    const borderGray: RGB = rgb(0.88, 0.9, 0.92); // #E2E6EA

    let page = pdfDoc.addPage([612, 792]); // Carta (Letter)
    let y = 750;

    const drawHeader = () => {
      page.drawText(this.clean('CONSULTORIO ODONTOLÓGICO ODONTOLEAL'), {
        x: 50,
        y: y,
        size: 13,
        font: fontBold,
        color: darkColor,
      });

      page.drawText(
        this.clean('NIT: 901.458.723-1  |  Código REPS / Habilitación en Salud: 110010923401'),
        {
          x: 50,
          y: y - 14,
          size: 8,
          font: fontRegular,
          color: grayColor,
        }
      );

      page.drawText(
        this.clean(
          'Calle 127 # 19A - 28, Cons. 504, Bogotá D.C.  |  PBX: (601) 745-8920  |  habeasdata@odontoleal.com.co'
        ),
        {
          x: 50,
          y: y - 26,
          size: 7.5,
          font: fontRegular,
          color: grayColor,
        }
      );

      page.drawLine({
        start: { x: 50, y: y - 34 },
        end: { x: 562, y: y - 34 },
        thickness: 1.5,
        color: goldColor,
      });

      y -= 50;
    };

    const drawFooter = () => {
      page.drawLine({
        start: { x: 50, y: 45 },
        end: { x: 562, y: 45 },
        thickness: 0.5,
        color: borderGray,
      });

      page.drawText(
        this.clean(
          'Documento confidencial expedido en virtud de la Ley Estatutaria 1581 de 2012 y el Decreto 1377 de 2013.'
        ),
        {
          x: 50,
          y: 34,
          size: 6.5,
          font: fontOblique,
          color: grayColor,
        }
      );

      page.drawText(
        this.clean('OdontoLeal S.A.S. - Sistema Oficial de Gestión Odontológica'),
        {
          x: 50,
          y: 24,
          size: 6.5,
          font: fontRegular,
          color: grayColor,
        }
      );
    };

    const checkPageBreak = (neededHeight: number) => {
      if (y - neededHeight < 60) {
        drawFooter();
        page = pdfDoc.addPage([612, 792]);
        y = 750;
        drawHeader();
      }
    };

    // Draw initial header
    drawHeader();

    // Document Title Banner
    page.drawRectangle({
      x: 50,
      y: y - 48,
      width: 512,
      height: 48,
      color: lightBg,
      borderColor: borderGray,
      borderWidth: 1,
    });

    page.drawText(
      this.clean('CERTIFICACIÓN OFICIAL DE REGISTRO Y TRATAMIENTO DE DATOS PERSONALES'),
      {
        x: 62,
        y: y - 18,
        size: 9.5,
        font: fontBold,
        color: darkColor,
      }
    );

    page.drawText(
      this.clean('HABEAS DATA Y AUTODETERMINACIÓN INFORMATIVA (LEY 1581 DE 2012 / DTO. 1377 DE 2013)'),
      {
        x: 62,
        y: y - 30,
        size: 7.5,
        font: fontBold,
        color: goldColor,
      }
    );

    const cuvCode = `CUV-HD-${data.documentoConsultado}-${new Date().getFullYear()}`;
    const fechaHora = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date());

    page.drawText(this.clean(`Radicado / CUV: ${cuvCode}   |   Fecha de Emisión: ${fechaHora}`), {
      x: 62,
      y: y - 42,
      size: 7,
      font: fontRegular,
      color: grayColor,
    });

    y -= 64;

    // SECTION 1: IDENTIFICACIÓN DEL TITULAR
    const paciente = data.calidades.comoPaciente;
    const acudientes = data.calidades.comoAcudiente || [];
    const solicitantes = data.calidades.comoSolicitante || [];

    const titularNombre =
      paciente?.nombreCompleto ||
      acudientes[0]?.nombreAcudiente ||
      solicitantes[0]?.nombreSolicitante ||
      `Titular Documento ${data.documentoConsultado}`;

    page.drawText(this.clean('1. IDENTIFICACIÓN DEL TITULAR DE LA INFORMACIÓN'), {
      x: 50,
      y: y,
      size: 8.5,
      font: fontBold,
      color: darkColor,
    });
    y -= 12;

    const idBoxHeight = 52;
    page.drawRectangle({
      x: 50,
      y: y - idBoxHeight,
      width: 512,
      height: idBoxHeight,
      color: rgb(1, 1, 1),
      borderColor: borderGray,
      borderWidth: 0.8,
    });

    page.drawText(this.clean(`Nombre Completo: ${titularNombre}`), {
      x: 62,
      y: y - 16,
      size: 8,
      font: fontBold,
      color: darkColor,
    });

    page.drawText(this.clean(`Documento Consultado: ${data.documentoConsultado}`), {
      x: 320,
      y: y - 16,
      size: 8,
      font: fontRegular,
      color: darkColor,
    });

    page.drawText(
      this.clean(`Teléfono: ${paciente?.telefono || acudientes[0]?.telefonoAcudiente || 'No registrado'}`),
      {
        x: 62,
        y: y - 30,
        size: 7.5,
        font: fontRegular,
        color: darkColor,
      }
    );

    page.drawText(
      this.clean(`Correo: ${paciente?.correo || solicitantes[0]?.correoSolicitante || 'No registrado'}`),
      {
        x: 320,
        y: y - 30,
        size: 7.5,
        font: fontRegular,
        color: darkColor,
      }
    );

    page.drawText(this.clean(`Fecha Nacimiento: ${paciente?.fechaNacimiento || 'N/A'}`), {
      x: 62,
      y: y - 44,
      size: 7.5,
      font: fontRegular,
      color: darkColor,
    });

    page.drawText(this.clean(`Sexo Biológico: ${paciente?.sexo || 'N/A'}`), {
      x: 320,
      y: y - 44,
      size: 7.5,
      font: fontRegular,
      color: darkColor,
    });

    y -= idBoxHeight + 16;

    // SECTION 2: CALIDADES REGISTRADAS
    checkPageBreak(70);
    page.drawText(this.clean('2. CALIDADES Y VÍNCULOS REGISTRADOS EN LA ENTIDAD'), {
      x: 50,
      y: y,
      size: 8.5,
      font: fontBold,
      color: darkColor,
    });
    y -= 14;

    const calidadesLines: string[] = [];
    if (paciente) {
      calidadesLines.push(`- Como Paciente: Registrado en la base clínica del consultorio bajo ID #${paciente.idPaciente}.`);
    }
    if (acudientes.length > 0) {
      acudientes.forEach((ac) => {
        calidadesLines.push(
          `- Como Acudiente/Representante Legal: Del menor ${ac.nombreMenorRepresentado} (Parentesco: ${ac.parentescoConMenor}).`
        );
      });
    }
    if (solicitantes.length > 0) {
      calidadesLines.push(
        `- Como Solicitante Web: Cuenta con ${solicitantes.length} solicitud(es) pública(s) de cita registradas.`
      );
    }
    if (calidadesLines.length === 0) {
      calidadesLines.push('- Sin calidades adicionales registradas en la plataforma.');
    }

    calidadesLines.forEach((line) => {
      checkPageBreak(14);
      page.drawText(this.clean(line), {
        x: 62,
        y: y,
        size: 7.5,
        font: fontRegular,
        color: darkColor,
      });
      y -= 13;
    });
    y -= 6;

    // SECTION 3: AUTORIZACIONES (LEY 1581 DE 2012)
    checkPageBreak(80);
    page.drawText(this.clean('3. PRUEBA DE AUTORIZACIÓN PARA EL TRATAMIENTO DE DATOS PERSONALES'), {
      x: 50,
      y: y,
      size: 8.5,
      font: fontBold,
      color: darkColor,
    });
    y -= 14;

    page.drawText(
      this.clean('En observancia del Artículo 9 de la Ley 1581 de 2012, reposa constancia de autorización:'),
      {
        x: 62,
        y: y,
        size: 7.5,
        font: fontOblique,
        color: grayColor,
      }
    );
    y -= 14;

    const autorizaciones = data.autorizaciones || [];
    if (autorizaciones.length > 0) {
      autorizaciones.forEach((aut) => {
        checkPageBreak(14);
        const fStr = aut.fechaHora ? String(aut.fechaHora).split('T')[0] : 'Vigente';
        page.drawText(
          this.clean(
            `* Calidad: ${aut.calidad}  |  Aviso: ${aut.versionAvisoPrivacidad}  |  Medio: ${aut.medio}  |  Fecha: ${fStr}`
          ),
          {
            x: 62,
            y: y,
            size: 7.5,
            font: fontRegular,
            color: darkColor,
          }
        );
        y -= 13;
      });
    } else {
      page.drawText(
        this.clean('* Autorización otorgada conforme a los términos y políticas generales del consultorio.'),
        {
          x: 62,
          y: y,
          size: 7.5,
          font: fontRegular,
          color: darkColor,
        }
      );
      y -= 13;
    }
    y -= 8;

    // SECTION 4: HISTORIAL DE CITAS Y SOLICITUDES (SIN DATOS CLÍNICOS SENSIBLES)
    checkPageBreak(90);
    page.drawText(this.clean('4. TRAZABILIDAD DE CITAS Y SOLICITUDES ADMINISTRATIVAS'), {
      x: 50,
      y: y,
      size: 8.5,
      font: fontBold,
      color: darkColor,
    });
    y -= 12;

    page.drawText(
      this.clean('* Conforme a la Ley 23 de 1981, Res. 1995/1999 y RF-HCL-010, este certificado salvaguarda la reserva de la historia clínica;'),
      {
        x: 62,
        y: y,
        size: 7,
        font: fontOblique,
        color: grayColor,
      }
    );
    y -= 9;
    page.drawText(
      this.clean('  no se revelan diagnósticos, motivos de consulta médicos ni notas confidenciales.'),
      {
        x: 62,
        y: y,
        size: 7,
        font: fontOblique,
        color: grayColor,
      }
    );
    y -= 14;

    const citas = data.citasRegistradas || [];
    if (citas.length > 0) {
      citas.slice(0, 10).forEach((c) => {
        checkPageBreak(14);
        const f = c.fechaHora ? String(c.fechaHora).split('T')[0] : 'Fecha no especificada';
        page.drawText(
          this.clean(`- Cita #${c.idCita}: ${f}  -  Estado: ${c.estado}  -  Profesional: ${c.profesional}`),
          {
            x: 62,
            y: y,
            size: 7.5,
            font: fontRegular,
            color: darkColor,
          }
        );
        y -= 12;
      });
      if (citas.length > 10) {
        page.drawText(
          this.clean(`  ... y ${citas.length - 10} registros administrativos adicionales en archivo.`),
          {
            x: 62,
            y: y,
            size: 7,
            font: fontOblique,
            color: grayColor,
          }
        );
        y -= 12;
      }
    } else {
      page.drawText(this.clean('- No registra citas o solicitudes previas en el sistema.'), {
        x: 62,
        y: y,
        size: 7.5,
        font: fontRegular,
        color: darkColor,
      });
      y -= 12;
    }
    y -= 8;

    // SECTION 5: DERECHOS ARCO
    checkPageBreak(65);
    page.drawText(this.clean('5. CANALES Y PROCEDIMIENTO PARA EL EJERCICIO DE DERECHOS ARCO'), {
      x: 50,
      y: y,
      size: 8.5,
      font: fontBold,
      color: darkColor,
    });
    y -= 12;

    const arcoText = this.clean(
      'El titular podrá ejercer sus derechos de Acceso, Rectificación, Cancelación y Oposición remitiendo comunicación escrita a habeasdata@odontoleal.com.co o en la sede física de la entidad, con respuesta garantizada dentro de los términos de ley (10 a 15 días hábiles).'
    );
    page.drawText(arcoText, {
      x: 62,
      y: y,
      size: 7,
      font: fontRegular,
      color: darkColor,
      maxWidth: 490,
      lineHeight: 9.5,
    });
    y -= 30;

    // SECTION 6: FIRMA INSTITUCIONAL
    checkPageBreak(85);
    y -= 10;
    page.drawLine({
      start: { x: 350, y: y },
      end: { x: 530, y: y },
      thickness: 1,
      color: darkColor,
    });
    y -= 12;
    page.drawText(this.clean('OFICIAL DE PROTECCIÓN DE DATOS'), {
      x: 350,
      y: y,
      size: 8,
      font: fontBold,
      color: darkColor,
    });
    y -= 10;
    page.drawText(this.clean('OdontoLeal S.A.S. - Responsable del Tratamiento'), {
      x: 350,
      y: y,
      size: 7,
      font: fontRegular,
      color: grayColor,
    });
    page.drawText(this.clean(`Firma Digital Verificada: ${cuvCode}`), {
      x: 350,
      y: y - 10,
      size: 6.5,
      font: fontOblique,
      color: goldColor,
    });

    // Draw final page footer
    drawFooter();

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}
