// src/modules/clinical-documents/ui/hooks/useClinicalDocuments.ts
import { useState, useCallback, useEffect } from 'react';

export interface ClinicalDocumentItem {
  idDocumento: number;
  tipoDocumento: 'FORMULA' | 'INCAPACIDAD' | 'REMISION';
  titulo: string;
  fechaEmision: string;
  profesionalNombre: string;
  idPaciente: number;
  detalle: any;
  firmadoDigitalmente: boolean;
}

export function useClinicalDocuments(idPaciente: number, apiBaseUrl = '/api/v1') {
  const [documents, setDocuments] = useState<ClinicalDocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!idPaciente) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/clinical-documents/patient/${idPaciente}`);
      if (res.ok) {
        const json = await res.json();
        const rawList = Array.isArray(json) ? json : json.data || [];
        setDocuments(
          rawList.map((item: any) => ({
            idDocumento: Number(item.idDocumento ?? item.id_evolucion ?? Date.now()),
            tipoDocumento: item.tipoDocumento || 'FORMULA',
            titulo:
              item.tipoDocumento === 'INCAPACIDAD'
                ? 'Incapacidad Médica Laboral'
                : item.tipoDocumento === 'REMISION'
                ? 'Remisión a Especialidad'
                : 'Fórmula Médica Odontológica',
            fechaEmision: String(item.fecha ?? new Date().toISOString()).replace('T', ' ').slice(0, 16),
            profesionalNombre: item.diligenciadoPor?.nombreCompleto || 'Dr. Eduar Leal Álvarez',
            idPaciente,
            detalle: item.detalles || item.detalle,
            firmadoDigitalmente: item.modoFirma === 'INCRUSTAR_PNG',
          }))
        );
      }
    } catch (err: any) {
      console.error('Error fetching clinical documents:', err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, idPaciente]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const addDocument = useCallback(
    async (doc: Omit<ClinicalDocumentItem, 'idDocumento'>) => {
      try {
        const res = await fetch(`${apiBaseUrl}/clinical-documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idPaciente: doc.idPaciente,
            idCita: 1, // o cita activa
            tipoDocumento: doc.tipoDocumento,
            archivoPdfUrl: `https://odontoleal.com/docs/${Date.now()}.pdf`,
            modoFirma: doc.firmadoDigitalmente ? 'INCRUSTAR_PNG' : 'ESPACIO_EN_BLANCO',
            detalles: doc.detalle,
            diligenciadoPor: {
              idUsuario: 1,
              nombreCompleto: doc.profesionalNombre,
              rol: 'Odontólogo General',
            },
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const createdItem: ClinicalDocumentItem = {
            ...doc,
            idDocumento: Number(json.data?.idDocumento || Date.now()),
          };
          setDocuments((prev) => [createdItem, ...prev]);
        }
      } catch (err: any) {
        console.error('Error creating clinical document:', err.message);
      }
    },
    [apiBaseUrl]
  );

  return {
    documents,
    isLoading,
    error,
    fetchDocuments,
    addDocument,
  };
}
