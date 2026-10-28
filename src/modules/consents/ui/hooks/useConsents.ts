// src/modules/consents/ui/hooks/useConsents.ts
import { useState, useCallback, useEffect } from 'react';

export interface ConsentTemplateItem {
  idPlantilla: number;
  titulo: string;
  version: number;
  cuerpoTexto: string;
  activo: boolean;
  requiereFirmaProfesional: boolean;
  fechaCreacion: string;
}

export interface PatientConsentItem {
  idConsentimiento: number;
  idPlantilla: number;
  titulo: string;
  version: number;
  idPaciente: number;
  estado: 'Sin firmar' | 'Pendiente de firma' | 'Firmado' | 'No aceptado';
  fechaFirma?: string | null;
  firmaDigitalUrl?: string | null;
  firmadoPor?: string | null;
  rolFirmante?: 'Paciente' | 'Acudiente';
  observaciones?: string | null;
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
    cuerpoTexto: t.plantillaUrl ?? t.cuerpoTexto ?? 'Cuerpo del consentimiento informado.',
    activo: Boolean(t.estado ?? t.activo ?? true),
    requiereFirmaProfesional: Boolean(t.tipoConsentimiento ?? t.tipo_consentimiento ?? true),
    fechaCreacion: t.fecha ?? t.fechaCreacion ?? new Date().toISOString().split('T')[0],
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
              raw.map((item: any) => ({
                idConsentimiento: Number(item.id_consentimiento ?? item.idConsentimiento),
                idPlantilla: Number(item.id_consentimiento ?? item.idPlantilla),
                titulo: item.nombre || item.titulo || 'Consentimiento Informado',
                version: Number(item.version || 1),
                idPaciente,
                estado: item.fecha ? 'Firmado' : 'Sin firmar',
                fechaFirma: item.fecha ? String(item.fecha).replace('T', ' ').slice(0, 16) : null,
                firmadoPor: item.firmadoPor || 'Paciente Titular',
                rolFirmante: item.rolFirmante || 'Paciente',
              }))
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
      idCita?: number;
      firmaBase64: string;
      nombreFirmante: string;
      rolFirmante: 'Paciente' | 'Acudiente';
    }) => {
      try {
        await fetch(`${apiBaseUrl}/consents/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idConsentimiento: params.idConsentimiento,
            idPaciente: params.idPaciente,
            idCita: params.idCita || 1,
            archivoUrl: params.firmaBase64.slice(0, 50), // referencia o storage
          }),
        });

        setPatientConsents((prev) =>
          prev.map((c) =>
            c.idConsentimiento === params.idConsentimiento
              ? {
                  ...c,
                  estado: 'Firmado',
                  fechaFirma: new Date().toISOString().replace('T', ' ').slice(0, 16),
                  firmaDigitalUrl: params.firmaBase64,
                  firmadoPor: params.nombreFirmante,
                  rolFirmante: params.rolFirmante,
                }
              : c
          )
        );
      } catch (err: any) {
        console.error('Error signing consent:', err.message);
      }
    },
    [apiBaseUrl]
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
              plantillaUrl: template.cuerpoTexto,
            }),
          });
        } else {
          await fetch(`${apiBaseUrl}/consents/templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nombre: template.titulo,
              plantillaUrl: template.cuerpoTexto || 'https://odontoleal.com/plantillas/default.pdf',
              tipoConsentimiento: Boolean(template.requiereFirmaProfesional),
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
  };
}
