// src/modules/patients/ui/hooks/usePatients.ts
import { useState, useCallback, useEffect } from 'react';
import { PatientFormData } from '../components/PatientForm';

export interface PatientListItem {
  idPaciente: number;
  nombreCompleto: string;
  documentoIdentidad: string;
  fechaNacimiento: string;
  sexo: 'Femenino' | 'Masculino' | 'Indeterminado';
  correo: string;
  telefono: string;
  datosIncompletos?: boolean;
  edad?: number;
  acudiente?: {
    nombreCompleto: string;
    documentoIdentidad: string;
    parentesco: string;
    telefono: string;
  };
}

export function usePatients(apiBaseUrl = '/api/v1') {
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateAge = (dobString: string): number => {
    if (!dobString) return 0;
    const parts = dobString.split('T')[0].split('-');
    if (parts.length !== 3) return 0;
    const [y, m, d] = parts.map(Number);
    const dob = new Date(y, m - 1, d);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const diff = today.getMonth() - dob.getMonth();
    if (diff < 0 || (diff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 0 ? age : 0;
  };

  const mapRawPatient = (p: any): PatientListItem => {
    const id = p.idPaciente ?? p.id_paciente;
    const nombre = p.nombreCompleto ?? p.nombre_completo ?? '';
    const doc = p.documentoIdentidad ?? p.documento_identidad ?? '';
    const fn = (p.fechaNacimiento ?? p.fecha_nacimiento ?? '').toString().split('T')[0];
    const sx = (p.sexo ?? 'Indeterminado') as any;
    const mail = p.correo ?? '';
    const tel = p.telefono ?? '';

    return {
      idPaciente: Number(id),
      nombreCompleto: nombre,
      documentoIdentidad: doc,
      fechaNacimiento: fn,
      sexo: sx,
      correo: mail,
      telefono: tel,
      edad: calculateAge(fn),
      datosIncompletos: !p.sexo || p.datosIncompletos === true,
      acudiente: p.acudiente,
    };
  };

  const fetchPatients = useCallback(
    async (searchQuery = '') => {
      setIsLoading(true);
      setError(null);
      try {
        const queryParam = searchQuery.trim()
          ? `?q=${encodeURIComponent(searchQuery)}`
          : '';
        const res = await fetch(`${apiBaseUrl}/patients${queryParam}`);
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
        const json = await res.json();
        const rawList = Array.isArray(json) ? json : json.data || [];
        setPatients(rawList.map(mapRawPatient));
      } catch (err: any) {
        console.error('Error fetching patients:', err.message);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl]
  );

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const createPatient = useCallback(
    async (formData: PatientFormData): Promise<PatientListItem> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/patients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Error al crear paciente (${res.status})`);
        }
        const json = await res.json();
        const createdRaw = json.data?.patient || json.patient || json.data || json;
        const newPatient = mapRawPatient(createdRaw);
        setPatients((prev) => [newPatient, ...prev]);
        return newPatient;
      } catch (err: any) {
        console.error('Error creating patient:', err.message);
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const updatePatient = useCallback(
    async (id: number, formData: PatientFormData): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/patients/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Error al actualizar paciente (${res.status})`);
        }
        const json = await res.json();
        const updatedRaw = json.data || json;
        const updatedItem = mapRawPatient(updatedRaw);

        setPatients((prev) =>
          prev.map((p) => (p.idPaciente === id ? { ...p, ...updatedItem } : p))
        );
      } catch (err: any) {
        console.error('Error updating patient:', err.message);
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl]
  );

  return {
    patients,
    isLoading,
    error,
    fetchPatients,
    createPatient,
    updatePatient,
  };
}
