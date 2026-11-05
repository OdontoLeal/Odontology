// src/modules/patients/infrastructure/patient.model.ts
import { PatientSex } from '../domain/patient.entity';

/** Fila de `public.paciente`. */
export interface PatientRow {
  id_paciente: number;
  nombre_completo: string;
  documento_identidad: string;
  correo: string | null;
  telefono: string | null;
  fecha_nacimiento: string | Date;
  sexo: PatientSex | null;
}
