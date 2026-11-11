// src/app/routes/access-capabilities.ts
import { ROUTES } from './paths';

export interface AccessCapabilities {
  canAccessAppointments: boolean;
  canAccessPatients: boolean;
  canAccessUsersModule: boolean;
  canAccessRolesModule: boolean;
  canAccessConsents: boolean;
  canManageSlots: boolean;
  canCreateAppointment: boolean;
  canStartAttention: boolean;
  canEditClinicalOpening: boolean;
  canAssistConsultation: boolean;
  canViewClinicalHistory: boolean;
  canGenerateClinicalDocuments: boolean;
  canCreatePatient: boolean;
  canAccessHabeasData: boolean;
  canCreateUser: boolean;
  canCreateRole: boolean;
  isCoordinatorOnly: boolean;
}

export function deriveAccessCapabilities(
  hasPermission: (code: string) => boolean,
  roles: unknown[] = []
): AccessCapabilities {
  const canAccessAppointments =
    hasPermission('RF-AGE-008') ||
    hasPermission('RF-AGE-001') ||
    hasPermission('RF-AGE-002') ||
    hasPermission('RF-AGE-005') ||
    hasPermission('RF-AGE-009') ||
    hasPermission('RF-AGE-012');

  const canAccessPatients =
    hasPermission('RF-HCL-004') ||
    hasPermission('RF-HCL-001') ||
    hasPermission('RF-HCL-002') ||
    hasPermission('RF-HCL-003') ||
    hasPermission('RF-HCL-005') ||
    hasPermission('RF-HCL-008') ||
    hasPermission('RF-HCL-010');

  const canAccessUsersModule =
    hasPermission('RF-USR-004') ||
    hasPermission('RF-USR-001') ||
    hasPermission('RF-USR-002') ||
    hasPermission('RF-USR-003');

  const canAccessRolesModule =
    hasPermission('RF-USR-007') ||
    hasPermission('RF-USR-010') ||
    hasPermission('RF-USR-011');

  const canAccessConsents =
    hasPermission('RF-CON-001') ||
    hasPermission('RF-CON-002') ||
    hasPermission('RF-CON-003') ||
    hasPermission('RF-CON-004') ||
    hasPermission('RF-CON-007') ||
    hasPermission('RF-CON-008');

  const canStartAttention = hasPermission('RF-AGE-009');
  const canEditClinicalOpening = hasPermission('RF-HCL-005') || hasPermission('RF-HCL-006');

  const roleCodes = roles.map((r: any) =>
    typeof r === 'string' ? r : r?.codigoRol || r?.codigo || r?.nombreRol || ''
  );
  const isCoordinatorOnly =
    roleCodes.includes('ROL-COA') &&
    !roleCodes.some((rc) => ['ROL-ODO', 'ROL-ESP', 'ROL-ADM'].includes(rc));

  return {
    canAccessAppointments,
    canAccessPatients,
    canAccessUsersModule,
    canAccessRolesModule,
    canAccessConsents,
    canManageSlots: hasPermission('RF-AGE-001'),
    canCreateAppointment: hasPermission('RF-AGE-002'),
    canStartAttention,
    canEditClinicalOpening,
    canAssistConsultation:
      canStartAttention || hasPermission('RF-HCL-007') || hasPermission('RF-HCL-009'),
    canViewClinicalHistory: hasPermission('RF-HCL-008'),
    canGenerateClinicalDocuments:
      hasPermission('RF-DOC-001') ||
      hasPermission('RF-DOC-002') ||
      hasPermission('RF-DOC-003'),
    canCreatePatient: hasPermission('RF-HCL-001'),
    canAccessHabeasData: hasPermission('RF-HCL-010'),
    canCreateUser: hasPermission('RF-USR-001'),
    canCreateRole: hasPermission('RF-USR-007'),
    isCoordinatorOnly,
  };
}

export function getDefaultInternalRoute(caps: AccessCapabilities): string {
  if (caps.canAccessAppointments) return ROUTES.AGENDA;
  if (caps.canAccessPatients) return ROUTES.PATIENTS;
  if (caps.canAccessConsents) return ROUTES.CONSENTS;
  if (caps.canAccessUsersModule) return ROUTES.USERS;
  if (caps.canAccessRolesModule) return ROUTES.ROLES;
  return ROUTES.AGENDA;
}

export function calculatePatientAge(
  patient?: { edad?: number; fechaNacimiento?: string | null } | null
): number | undefined {
  if (!patient) return undefined;
  if (patient.edad !== undefined && !isNaN(patient.edad)) return patient.edad;
  if (!patient.fechaNacimiento) return undefined;
  const birth = new Date(patient.fechaNacimiento);
  if (isNaN(birth.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : undefined;
}
