// src/modules/consents/ui/hooks/usePrivacyNotice.ts
import { useEffect, useState } from 'react';

export interface PrivacyNotice {
  idPlantilla: number;
  nombre: string;
  version: number;
  fechaPublicacion: string | null;
  texto: string;
}

/**
 * RQNF-SEG-006: aviso de privacidad vigente. Es la plantilla activa de
 * autorización de datos del Módulo D y se consulta sin sesión.
 */
export function usePrivacyNotice(enabled: boolean = true) {
  const [notice, setNotice] = useState<PrivacyNotice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setIsLoading(true);
    fetch('/api/v1/public/privacy-notice')
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message || 'No se pudo cargar el aviso de privacidad.');
        if (!cancelled) setNotice(json.data);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { notice, isLoading, error };
}
