// src/shared/domain/biological-sex.ts

/**
 * Fuente única de verdad para los valores admitidos de sexo biológico / género.
 * Todos los valores tienen como máximo 9 caracteres, compatibles con `varchar(10)` en BD.
 */
export const BIOLOGICAL_SEX_VALUES = ['Femenino', 'Masculino', 'Ambiguo'] as const;

export type BiologicalSex = (typeof BIOLOGICAL_SEX_VALUES)[number];

export function isBiologicalSex(value: unknown): value is BiologicalSex {
  return typeof value === 'string' && (BIOLOGICAL_SEX_VALUES as readonly string[]).includes(value);
}

export function normalizeOptionalSex(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}
