// src/modules/consents/ui/hooks/useConsents.ts
import { useState, useCallback, useEffect } from 'react';

export interface ConsentTemplateItem {
  idPlantilla: number;
  titulo: string;
  version: number;
  cuerpoTexto: string;
  activo: boolean;
  requiereFirmaProfesional?: boolean;
  fechaCreacion: string;
}

export interface PatientConsentItem {
  idConsentimientoFirmado?: number;
  idConsentimiento: number;
  idPlantilla: number;
  titulo: string;
  version: number;
  versionActualPlantilla?: number;
  idPaciente: number;
  estado: 'Sin firmar' | 'Pendiente de firma' | 'Firmado' | 'No aceptado';
  fechaFirma?: string | null;
  firmaDigitalUrl?: string | null;
  firmaBase64?: string | null;
  firmadoPor?: string | null;
  rolFirmante?: 'Paciente' | 'Acudiente';
  firmaPorAcudiente?: boolean;
  nombreDocumentoAcudiente?: string | null;
  diligenciadoPor?: string | null;
  textoFirmado?: string | null;
}

export function useConsents(apiBaseUrl = '/api/v1') {
  const [templates, setTemplates] = useState<ConsentTemplateItem[]>([]);
  const [patientConsents, setPatientConsents] = useState<PatientConsentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapTemplate = (t: any): ConsentTemplateItem => ({
    idPlantilla: Number(t.idConsentimiento ?? t.id_consentimiento ?? t.idPlantilla ?? 1),
    titulo: t.nombre ?? t.titulo ?? 'Plantilla de Consentimiento',
    version: Number(t.version ?? 1),
    cuerpoTexto: t.textoPlantilla ?? t.texto_plantilla ?? t.plantillaUrl ?? t.cuerpoTexto ?? '',
    activo: Boolean(t.estado ?? t.activo ?? true),
    requiereFirmaProfesional: false,
    fechaCreacion: t.fechaModificacion
      ? String(t.fechaModificacion).slice(0, 10)
      : (t.fecha ?? t.fechaCreacion ?? new Date().toISOString().split('T')[0]),
  });

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/consents/templates`);
      if (res.ok) {
        const json = await res.json();
        const raw = json.data || json;
        if (Array.isArray(raw)) {
          setTemplates(raw.map(mapTemplate));
        }
      }
    } catch (err: any) {
      console.error('Error fetching templates:', err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const fetchPatientConsents = useCallback(
    async (idPaciente: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/consents/patient/${idPaciente}`);
        if (res.ok) {
          const json = await res.json();
          const raw = json.data || json;
          if (Array.isArray(raw)) {
            setPatientConsents(
              raw.map((item: any) => {
                const esAcudiente = Boolean(item.firmaPorAcudiente ?? item.firma_por_acudiente);
                const nombreAcudiente =
                  item.nombreDocumentoAcudiente ?? item.nombre_documento_acudiente ?? null;

                return {
                  idConsentimientoFirmado: Number(
                    item.idConsentimientoFirmado ??
                      item.id_consentimiento_firmado ??
                      item.idConsentimiento
                  ),
                  idConsentimiento: Number(item.idConsentimiento ?? item.id_consentimiento),
                  idPlantilla: Number(item.idConsentimiento ?? item.id_consentimiento),
                  titulo:
                    item.nombrePlantilla || item.nombre || item.titulo || 'Consentimiento Informado',
                  version: Number(item.versionPlantilla ?? item.version ?? 1),
                  versionActualPlantilla: Number(item.versionActualPlantilla ?? item.version ?? 1),
                  idPaciente,
                  estado: 'Firmado' as const,
                  fechaFirma: item.fecha ? String(item.fecha).replace('T', ' ').slice(0, 16) : null,
                  firmaBase64: item.firmaBase64 ?? item.firma_base64 ?? null,
                  firmaDigitalUrl: item.firmaBase64 ?? item.firma_base64 ?? null,
                  firmaPorAcudiente: esAcudiente,
                  nombreDocumentoAcudiente: nombreAcudiente,
                  firmadoPor: esAcudiente ? (nombreAcudiente || 'Acudiente') : 'Paciente Titular',
                  rolFirmante: (esAcudiente ? 'Acudiente' : 'Paciente') as 'Paciente' | 'Acudiente',
                  diligenciadoPor: item.usuarioDiligencioNombre ?? null,
                  textoFirmado: item.textoFirmado ?? item.texto_firmado ?? null,
                };
              })
            );
          }
        }
      } catch (err: any) {
        console.error('Error fetching patient consents:', err.message);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const signConsent = useCallback(
    async (params: {
      idConsentimiento: number;
      idPaciente: number;
      textoFirmado?: string;
      firmaBase64: string;
      firmaPorAcudiente?: boolean;
      nombreDocumentoAcudiente?: string | null;
      nombreFirmante?: string;
      rolFirmante?: 'Paciente' | 'Acudiente';
      idCita?: number;
    }) => {
      const res = await fetch(`${apiBaseUrl}/consents/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idConsentimiento: params.idConsentimiento,
          idPaciente: params.idPaciente,
          textoFirmado: params.textoFirmado,
          firmaBase64: params.firmaBase64,
          firmaPorAcudiente: Boolean(params.firmaPorAcudiente),
          nombreDocumentoAcudiente: params.nombreDocumentoAcudiente ?? null,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Error al guardar el consentimiento firmado.');
      }

      await fetchPatientConsents(params.idPaciente);
    },
    [apiBaseUrl, fetchPatientConsents]
  );

  const toggleTemplateStatus = useCallback(
    async (idPlantilla: number) => {
      const target = templates.find((t) => t.idPlantilla === idPlantilla);
      if (!target) return;
      const nextState = !target.activo;

      try {
        await fetch(`${apiBaseUrl}/consents/templates/${idPlantilla}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: nextState }),
        });
        setTemplates((prev) =>
          prev.map((t) => (t.idPlantilla === idPlantilla ? { ...t, activo: nextState } : t))
        );
      } catch (err: any) {
        console.error('Error toggling template:', err.message);
      }
    },
    [apiBaseUrl, templates]
  );

  const saveTemplate = useCallback(
    async (template: Partial<ConsentTemplateItem>) => {
      try {
        if (template.idPlantilla) {
          await fetch(`${apiBaseUrl}/consents/templates/${template.idPlantilla}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nombre: template.titulo,
              textoPlantilla: template.cuerpoTexto,
            }),
          });
        } else {
          await fetch(`${apiBaseUrl}/consents/templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nombre: template.titulo,
              textoPlantilla: template.cuerpoTexto,
            }),
          });
        }
        fetchTemplates();
      } catch (err: any) {
        console.error('Error saving template:', err.message);
      }
    },
    [apiBaseUrl, fetchTemplates]
  );

  const downloadConsentPdf = useCallback(
    async (idConsentimientoFirmado: number, filename = 'consentimiento_firmado.pdf') => {
      const res = await fetch(`${apiBaseUrl}/consents/${idConsentimientoFirmado}/pdf`);
      if (!res.ok) {
        throw new Error('Error al generar PDF del consentimiento firmado.');
      }
      const json = await res.json();
      const pdfBase64 = json.data?.pdfBase64;
      if (!pdfBase64) {
        throw new Error('No se recibió el documento PDF.');
      }
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${pdfBase64}`;
      link.download = filename;
      link.click();
    },
    [apiBaseUrl]
  );

  return {
    templates,
    patientConsents,
    isLoading,
    error,
    fetchTemplates,
    fetchPatientConsents,
    signConsent,
    toggleTemplateStatus,
    saveTemplate,
    downloadConsentPdf,
  };
}
