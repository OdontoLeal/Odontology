// src/modules/clinical-documents/ui/hooks/useClinicalDocuments.ts

export type TipoDocumentoClinicoUI = 'ORDEN_MEDICAMENTOS' | 'INCAPACIDAD' | 'REMISION';

/**
 * RF-DOC-001 a RF-DOC-004 (ERS v1.2/v1.3): pide al servidor el PDF generado en memoria
 * (con la firma del profesional fusionada) y lo abre para imprimir o descargar.
 * No queda ninguna copia en el servidor. Devuelve el aviso de firma, si lo hay.
 */
export async function downloadClinicalDocument(params: {
  idPaciente: number;
  idCita: number;
  tipoDocumento: TipoDocumentoClinicoUI;
  detalles: Record<string, unknown>;
  modoFirma?: 'CON_FIRMA_REGISTRADA' | 'FIRMA_MANUSCRITA';
  apiBaseUrl?: string;
}): Promise<string | undefined> {
  const res = await fetch(`${params.apiBaseUrl ?? '/api/v1'}/clinical-documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idPaciente: params.idPaciente,
      idCita: params.idCita,
      tipoDocumento: params.tipoDocumento,
      modoFirma: params.modoFirma ?? 'CON_FIRMA_REGISTRADA',
      detalles: params.detalles,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'No se pudo generar el documento clínico.');
  }

  const { pdfBase64, nombreArchivo } = json.data ?? {};
  const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const opened = window.open(url, '_blank');
  if (!opened) {
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo || 'documento-clinico.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return json.warning;
}
