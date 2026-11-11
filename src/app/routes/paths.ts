// src/app/routes/paths.ts
import { InternalNavigationView } from '../layouts/InternalDashboardLayout';

export const ROUTES = {
  PUBLIC_BOOKING: '/',
  PUBLIC_BOOKING_ALIAS_REQUEST: '/solicitud-cita',
  PUBLIC_BOOKING_ALIAS_SCHEDULE: '/agendar',
  PRIVACY_NOTICE: '/aviso-privacidad',
  LOGIN: '/login',
  RECOVERY: '/recuperar-contrasena',
  AGENDA: '/agenda',
  AGENDA_REQUEST_DETAIL: '/agenda/solicitudes/:idSolicitud',
  AGENDA_APPOINTMENT_DETAIL: '/agenda/citas/:idCita',
  CONSULTATION: '/consulta/:idCita',
  PATIENTS: '/pacientes',
  PATIENT_HOLDER_DATA: '/pacientes/titular',
  PATIENT_PROFILE: '/pacientes/:idPaciente',
  PATIENT_CLINICAL_HISTORY: '/pacientes/:idPaciente/historia',
  PATIENT_CONSENT_SIGNING: '/pacientes/:idPaciente/consentimientos/firmar/:idPlantilla',
  USERS: '/usuarios',
  ROLES: '/roles',
  CONSENTS: '/consentimientos',
} as const;

export const VIEW_TO_ROUTE: Record<InternalNavigationView, string> = {
  APPOINTMENTS: ROUTES.AGENDA,
  PATIENTS: ROUTES.PATIENTS,
  USERS: ROUTES.USERS,
  ROLES: ROUTES.ROLES,
  CONSENTS: ROUTES.CONSENTS,
};

const ALLOWED_REDIRECT_PREFIXES = [
  ROUTES.AGENDA,
  '/consulta/',
  ROUTES.PATIENTS,
  ROUTES.USERS,
  ROUTES.ROLES,
  ROUTES.CONSENTS,
];

export const buildAgendaRequestPath = (idSolicitud: number): string =>
  `/agenda/solicitudes/${idSolicitud}`;

export const buildAgendaAppointmentPath = (idCita: number): string =>
  `/agenda/citas/${idCita}`;

export const buildConsultationPath = (idCita: number): string =>
  `/consulta/${idCita}`;

export const buildPatientProfilePath = (idPaciente: number): string =>
  `/pacientes/${idPaciente}`;

export const buildPatientClinicalHistoryPath = (idPaciente: number): string =>
  `/pacientes/${idPaciente}/historia`;

export const buildConsentSigningPath = (idPaciente: number, idPlantilla: number): string =>
  `/pacientes/${idPaciente}/consentimientos/firmar/${idPlantilla}`;

export const buildHolderDataPath = (documento?: string): string =>
  documento && documento.trim()
    ? `${ROUTES.PATIENT_HOLDER_DATA}?doc=${encodeURIComponent(documento.trim())}`
    : ROUTES.PATIENT_HOLDER_DATA;

/**
 * Valida que el destino de redirección post-login sea una ruta interna privada válida,
 * evitando ataques de Open Redirect (OWASP) o bucles hacia rutas públicas.
 */
export const sanitizeInternalRedirect = (rawRedirect: string | null): string | null => {
  if (!rawRedirect) return null;
  const trimmed = rawRedirect.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return null;
  }
  const pathnameOnly = trimmed.split('?')[0].split('#')[0];
  const isProtectedPath = ALLOWED_REDIRECT_PREFIXES.some(
    (prefix) => pathnameOnly === prefix || pathnameOnly.startsWith(`${prefix}/`) || (prefix.endsWith('/') && pathnameOnly.startsWith(prefix))
  );
  return isProtectedPath ? trimmed : null;
};

export const buildLoginUrl = (redirectTo?: string): string => {
  const safeTarget = sanitizeInternalRedirect(redirectTo ?? null);
  return safeTarget
    ? `${ROUTES.LOGIN}?redirect=${encodeURIComponent(safeTarget)}`
    : ROUTES.LOGIN;
};

export const mapPathnameToNavView = (pathname: string): InternalNavigationView => {
  if (pathname.startsWith(ROUTES.PATIENTS)) return 'PATIENTS';
  if (pathname.startsWith(ROUTES.USERS)) return 'USERS';
  if (pathname.startsWith(ROUTES.ROLES)) return 'ROLES';
  if (pathname.startsWith(ROUTES.CONSENTS)) return 'CONSENTS';
  return 'APPOINTMENTS';
};
