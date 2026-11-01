// src/modules/consents/domain/consent-template-interpolator.ts

export interface ConsentInterpolationContext {
  nombrePaciente: string;
  documentoPaciente: string;
  firmaPorAcudiente: boolean;
  nombreDocumentoAcudiente?: string | null;
  doctorTratante?: string;
  fecha?: Date | string;
}

export interface TemplatePlaceholderDescriptor {
  placeholder: string;
  descripcion: string;
  ejemplo: string;
}

export const AVAILABLE_TEMPLATE_PLACEHOLDERS: TemplatePlaceholderDescriptor[] = [
  {
    placeholder: '{{nombre_paciente}}',
    descripcion: 'Nombre completo del paciente titular.',
    ejemplo: 'Carlos Eduardo Gómez Pérez',
  },
  {
    placeholder: '{{documento_paciente}}',
    descripcion: 'Documento de identidad del paciente titular.',
    ejemplo: '1.098.765.432',
  },
  {
    placeholder: '{{leyenda_firmante}}',
    descripcion:
      'Leyenda médico-legal automática de quien suscribe (paciente o acudiente según RF-CON-005).',
    ejemplo: 'Firma del paciente titular: Carlos Eduardo Gómez Pérez',
  },
  {
    placeholder: '{{datos_acudiente}}',
    descripcion:
      'Nombre y documento del acudiente/representante legal (solo si firma por acudiente).',
    ejemplo: 'Acudiente: Claudia Patricia Gómez - C.C. 37.890.123',
  },
  {
    placeholder: '{{fecha}}',
    descripcion: 'Fecha en que se suscribe el consentimiento.',
    ejemplo: '31/10/2026',
  },
  {
    placeholder: '{{doctor_tratante}}',
    descripcion: 'Nombre del profesional odontológico tratante.',
    ejemplo: 'Dr. Eduar Leal Álvarez',
  },
];

/**
 * Interpola dinámicamente las variables y marcadores en el texto de una plantilla
 * de consentimiento informado (RF-CON-001, RF-CON-002, RF-CON-004 y RF-CON-005).
 */
export function interpolateConsentTemplate(
  templateText: string,
  ctx: ConsentInterpolationContext
): string {
  if (!templateText) return '';

  const fechaStr = ctx.fecha
    ? ctx.fecha instanceof Date
      ? ctx.fecha.toLocaleDateString('es-CO')
      : String(ctx.fecha)
    : new Date().toLocaleDateString('es-CO');

  const leyendaFirmante = ctx.firmaPorAcudiente
    ? `Firma del acudiente / representante legal en representación del paciente ${ctx.nombrePaciente}`
    : `Firma del paciente titular: ${ctx.nombrePaciente}`;

  const datosAcudiente =
    ctx.firmaPorAcudiente && ctx.nombreDocumentoAcudiente?.trim()
      ? `\nAcudiente / Representante legal: ${ctx.nombreDocumentoAcudiente.trim()}`
      : '';

  let result = templateText
    // {{nombre_paciente}}, {{nombrePaciente}}, [nombre del paciente]
    .replace(/\{\{\s*nombre_?paciente\s*\}\}/gi, ctx.nombrePaciente)
    .replace(/\{\{\s*nombrePaciente\s*\}\}/g, ctx.nombrePaciente)
    .replace(/\[\s*nombre\s+del\s+paciente\s*\]/gi, ctx.nombrePaciente)
    // {{documento_paciente}}, {{documentoPaciente}}, {{documento}}, [documento del paciente]
    .replace(/\{\{\s*documento_?paciente\s*\}\}/gi, ctx.documentoPaciente)
    .replace(/\{\{\s*documentoPaciente\s*\}\}/g, ctx.documentoPaciente)
    .replace(/\{\{\s*documento\s*\}\}/gi, ctx.documentoPaciente)
    .replace(/\[\s*documento\s+del\s+paciente\s*\]/gi, ctx.documentoPaciente)
    // {{leyenda_firmante}}, {{leyendaFirmante}}
    .replace(/\{\{\s*leyenda_?firmante\s*\}\}/gi, leyendaFirmante)
    .replace(/\{\{\s*leyendaFirmante\s*\}\}/g, leyendaFirmante)
    // {{datos_acudiente}}, {{datosAcudiente}}
    .replace(/\{\{\s*datos_?acudiente\s*\}\}/gi, datosAcudiente)
    .replace(/\{\{\s*datosAcudiente\s*\}\}/g, datosAcudiente)
    // {{fecha}}, {{fecha_actual}}
    .replace(/\{\{\s*fecha(_actual)?\s*\}\}/gi, fechaStr)
    // {{doctor_tratante}}, {{profesional}}
    .replace(
      /\{\{\s*(doctor_tratante|profesional)\s*\}\}/gi,
      ctx.doctorTratante || 'Dr. Eduar Leal Álvarez'
    );

  // Cláusula de seguridad médico-legal: si la plantilla era un texto plano sin marcadores
  // pero el paciente firma por acudiente, nos aseguramos de que el texto firmado
  // conserve de forma inmutable la constancia del representante legal (RF-CON-005)
  if (
    ctx.firmaPorAcudiente &&
    !result.includes(ctx.nombreDocumentoAcudiente || 'Acudiente') &&
    !result.includes('acudiente') &&
    !result.includes('representante legal')
  ) {
    result += `\n\n[Suscrito en calidad de acudiente / representante legal: ${
      ctx.nombreDocumentoAcudiente?.trim() || 'No especificado'
    } en representación del paciente ${ctx.nombrePaciente} (Doc: ${ctx.documentoPaciente})]`;
  }

  return result;
}
