import { z } from 'zod';

export const PROTECTED_CLINICAL_PERMISSIONS = [
  'RF-HCL-005',
  'RF-HCL-006',
  'RF-HCL-007',
  'RF-HCL-008',
  'RF-HCL-009',
  'RF-CON-001',
  'RF-CON-002',
  'RF-CON-003',
  'RF-DOC-001',
  'RF-DOC-002',
  'RF-DOC-003',
  'RF-DOC-004',
] as const;

export const EXCLUDED_SYSTEM_PERMISSIONS = [
  'RF-USR-008', // Universal (cerrar sesión)
  'RF-AGE-004', // Notificación automática escalada
  'RF-AGE-010', // Recordatorio automático 24h
  'RF-AGE-011', // Reasignación automática de cancelaciones
] as const;

export const RolPermisosSchema = z
  .array(z.string().min(1, 'El código de permiso no puede estar vacío.'))
  .min(1, 'El rol debe tener al menos un (1) permiso asignado.');

/**
 * Validador estricto para creación y edición de roles configurables (RF-USR-007, RF-USR-010).
 * Rechaza permisos clínicos protegidos en roles personalizados.
 */
export const ConfigurableRolPermisosSchema = RolPermisosSchema.refine(
  (permisos) => {
    const hasProtected = permisos.some((p) =>
      PROTECTED_CLINICAL_PERMISSIONS.includes(p as any)
    );
    return !hasProtected;
  },
  {
    message:
      'Los permisos clínicos (RF-HCL-005 a RF-HCL-009, RF-CON-001 a RF-CON-003, RF-DOC-001 a RF-DOC-004) son protegidos y no pueden asignarse a roles configurables.',
  }
).refine(
  (permisos) => {
    const hasExcluded = permisos.some((p) =>
      EXCLUDED_SYSTEM_PERMISSIONS.includes(p as any)
    );
    return !hasExcluded;
  },
  {
    message:
      'Los procesos automáticos del sistema y RF-USR-008 no son permisos asignables a roles.',
  }
);

export type RolPermisos = z.infer<typeof RolPermisosSchema>;
