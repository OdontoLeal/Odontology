// src/app/routes/patient-hydration.ts
import { useEffect, useState } from 'react';
import { PatientListItem } from '../../modules/patients/ui/hooks/usePatients';
import { calculatePatientAge } from './access-capabilities';

export function mapRawPatientRecord(raw: any): PatientListItem {
  const fnRaw = raw.fechaNacimiento ?? raw.fecha_nacimiento ?? '';
  const fechaNacimiento = fnRaw ? String(fnRaw).split('T')[0] : '';
  const rawSexo = raw.sexo ?? null;

  return {
    idPaciente: Number(raw.idPaciente ?? raw.id_paciente),
    nombreCompleto: raw.nombreCompleto ?? raw.nombre_completo ?? '',
    documentoIdentidad: raw.documentoIdentidad ?? raw.documento_identidad ?? '',
    fechaNacimiento,
    sexo: rawSexo as PatientListItem['sexo'],
    correo: raw.correo ?? '',
    telefono: raw.telefono ?? '',
    datosIncompletos:
      raw.datosIncompletos !== undefined ? Boolean(raw.datosIncompletos) : !rawSexo,
    edad: calculatePatientAge({ edad: raw.edad, fechaNacimiento }),
  };
}

export function useHydratedPatient(
  idPaciente: number | undefined,
  options?: {
    initialPatient?: PatientListItem | null;
    cachedPatients?: PatientListItem[];
    enabled?: boolean;
  }
) {
  const initial =
    options?.initialPatient && Number(options.initialPatient.idPaciente) === Number(idPaciente)
      ? options.initialPatient
      : options?.cachedPatients?.find((p) => Number(p.idPaciente) === Number(idPaciente)) ?? null;

  const [patient, setPatient] = useState<PatientListItem | null>(initial);
  const [isLoading, setIsLoading] = useState(Boolean(idPaciente && !initial && options?.enabled !== false));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (options?.enabled === false) {
      return;
    }
    if (!idPaciente || isNaN(idPaciente) || idPaciente <= 0) {
      setPatient(null);
      setIsLoading(false);
      setError('Identificador de paciente no válido.');
      return;
    }

    const stateMatch =
      options?.initialPatient && Number(options.initialPatient.idPaciente) === Number(idPaciente)
        ? options.initialPatient
        : null;
    const cacheMatch =
      options?.cachedPatients?.find((p) => Number(p.idPaciente) === Number(idPaciente)) ?? null;
    const resolved = stateMatch || cacheMatch;

    if (resolved) {
      setPatient(resolved);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`/api/v1/patients/${idPaciente}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.data) {
          throw new Error(json?.message || 'No se encontró la ficha del paciente solicitado.');
        }
        if (!cancelled) {
          setPatient(mapRawPatientRecord(json.data));
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setPatient(null);
          setError(err?.message || 'Error al cargar la ficha del paciente.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [idPaciente, options?.initialPatient, options?.cachedPatients, options?.enabled]);

  return { patient, setPatient, isLoading, error };
}
