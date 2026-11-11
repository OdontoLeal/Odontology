// src/app/routes/AppRouter.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { InternalDashboardLayout } from '../layouts/InternalDashboardLayout';
import { PublicBookingPage } from '../../modules/appointments/ui/views';
import { ConsentTemplatesAdminPage, PrivacyNoticePage } from '../../modules/consents/ui/views';
import { PatientsDirectoryPage } from '../../modules/patients/ui/views';
import { usePatients } from '../../modules/patients/ui/hooks/usePatients';
import { useAuth, useSessionDraft } from '../../modules/users-auth/ui/hooks';
import {
  clearRecoveryTokenFromUrl,
  LoginPage,
  PasswordRecoveryPage,
  RolesManagementPage,
  UsersManagementPage,
} from '../../modules/users-auth/ui/views';
import { RoleExtendedViewDTO } from '../../modules/users-auth/ui/views/RolesManagementPage';
import { useAlertModal } from '../../shared/ui/hooks/useAlertModal';
import {
  AccessCapabilities,
  deriveAccessCapabilities,
  getDefaultInternalRoute,
} from './access-capabilities';
import {
  ActiveConsultationRoute,
  AgendaRoute,
  ClinicalHistoryRoute,
  ConsentSigningRoute,
  HolderDataQueryRoute,
  PatientProfileRoute,
} from './DetailRoutes';
import {
  buildPatientClinicalHistoryPath,
  buildPatientProfilePath,
  mapPathnameToNavView,
  ROUTES,
  sanitizeInternalRedirect,
  VIEW_TO_ROUTE,
} from './paths';
import {
  GuestOnlyLogin,
  PublicRootGuard,
  RequireAuth,
  RequirePermission,
} from './RouteGuards';

const RecoveryRoute: React.FC<{
  onRequestRecoveryLink: ReturnType<typeof useAuth>['requestPasswordRecovery'];
  onResetPassword: ReturnType<typeof useAuth>['resetPasswordWithToken'];
}> = ({ onRequestRecoveryLink, onResetPassword }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenKey = searchParams.get('token') ?? 'request';

  return (
    <PasswordRecoveryPage
      key={tokenKey}
      onRequestRecoveryLink={onRequestRecoveryLink}
      onResetPassword={onResetPassword}
      onNavigateToLogin={() => {
        clearRecoveryTokenFromUrl();
        navigate(ROUTES.LOGIN);
      }}
      onNavigateToPublicBooking={() => {
        clearRecoveryTokenFromUrl();
        navigate(ROUTES.PUBLIC_BOOKING);
      }}
    />
  );
};

const PrivacyNoticeRoute: React.FC<{
  isAuthenticated: boolean;
  defaultInternalRoute: string;
}> = ({ isAuthenticated, defaultInternalRoute }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  return (
    <PrivacyNoticePage
      onBack={() => {
        if (from) {
          navigate(from);
          return;
        }
        navigate(isAuthenticated ? defaultInternalRoute : ROUTES.PUBLIC_BOOKING);
      }}
      onNavigateToPublicBooking={() => navigate(ROUTES.PUBLIC_BOOKING)}
    />
  );
};

interface AuthenticatedShellProps {
  auth: ReturnType<typeof useAuth>;
  capabilities: AccessCapabilities;
  defaultInternalRoute: string;
  userDraftHook: ReturnType<typeof useSessionDraft>;
  patientsHook: ReturnType<typeof usePatients>;
  catalogRoles: RoleExtendedViewDTO[] | undefined;
  handleCreateRole: (payload: {
    codigo: string;
    nombreRol: string;
    descripcion: string;
    permisos: string[];
  }) => Promise<any>;
  handleUpdateRole: (payload: {
    idRol: number;
    nombreRol: string;
    descripcion: string;
    permisos: string[];
  }) => Promise<any>;
  handleDeleteRole: (idRol: number) => Promise<any>;
  showAlert: ReturnType<typeof useAlertModal>['showAlert'];
  showConfirm: ReturnType<typeof useAlertModal>['showConfirm'];
  AlertModalComponent: ReturnType<typeof useAlertModal>['AlertModalComponent'];
}

const AuthenticatedDashboardShell: React.FC<AuthenticatedShellProps> = ({
  auth,
  capabilities,
  showConfirm,
  AlertModalComponent,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  if (!auth.session) return null;

  const activeView = mapPathnameToNavView(location.pathname);

  return (
    <InternalDashboardLayout
      currentUser={auth.session.usuario}
      activeView={activeView}
      canAccessAppointments={capabilities.canAccessAppointments}
      canAccessPatients={capabilities.canAccessPatients}
      canAccessUsersModule={capabilities.canAccessUsersModule}
      canAccessRolesModule={capabilities.canAccessRolesModule}
      canAccessConsents={capabilities.canAccessConsents}
      onSelectPatientFromSearch={(patient) =>
        navigate(buildPatientProfilePath(patient.idPaciente), { state: { patient } })
      }
      onSelectView={(view) => navigate(VIEW_TO_ROUTE[view])}
      isWarningModalOpen={auth.isWarningModalOpen}
      hasUnsavedChanges={Boolean(auth.unsavedFormDraft)}
      onContinueSession={auth.continueSessionAfterWarning}
      onTimeoutCloseSession={() => {
        auth.logout('INACTIVITY_TIMEOUT', true);
        navigate(ROUTES.LOGIN, { replace: true });
      }}
      onManualCloseSession={async () => {
        const res = await auth.logout('MANUAL', false);
        if (res.requiresConfirmation) {
          showConfirm({
            title: '¿Cerrar Sesión Activa?',
            message:
              res.message ||
              'Tiene modificaciones sin guardar. ¿Desea cerrar su sesión de todos modos?',
            confirmText: 'Sí, cerrar sesión',
            cancelText: 'Continuar en el sistema',
            onConfirm: async () => {
              await auth.logout('MANUAL', true);
              navigate(ROUTES.LOGIN, { replace: true });
            },
          });
          return;
        }
        navigate(ROUTES.LOGIN, { replace: true });
      }}
    >
      <AlertModalComponent />
      <Outlet />
    </InternalDashboardLayout>
  );
};

const AuthenticatedWorkspace: React.FC<{
  auth: ReturnType<typeof useAuth>;
  capabilities: AccessCapabilities;
  defaultInternalRoute: string;
}> = ({ auth, capabilities, defaultInternalRoute }) => {
  const navigate = useNavigate();
  const [catalogRoles, setCatalogRoles] = useState<RoleExtendedViewDTO[] | undefined>(undefined);
  const userDraftHook = useSessionDraft(auth.session?.usuario.idUsuario);
  const patientsHook = usePatients();
  const { showAlert, showConfirm, AlertModalComponent } = useAlertModal();

  const refreshCatalogRoles = useCallback(async () => {
    try {
      const loadedRoles = await auth.fetchRoles();
      if (loadedRoles.length > 0) {
        setCatalogRoles(loadedRoles);
      }
    } catch {
      // Conserva los roles semilla
    }
  }, [auth.fetchRoles]);

  useEffect(() => {
    refreshCatalogRoles();
  }, [refreshCatalogRoles]);

  const handleCreateRole = useCallback(
    async (payload: {
      codigo: string;
      nombreRol: string;
      descripcion: string;
      permisos: string[];
    }) => {
      const res = await auth.createRole(payload);
      await refreshCatalogRoles();
      return res;
    },
    [auth.createRole, refreshCatalogRoles]
  );

  const handleUpdateRole = useCallback(
    async (payload: {
      idRol: number;
      nombreRol: string;
      descripcion: string;
      permisos: string[];
    }) => {
      const res = await auth.updateRole(payload);
      await refreshCatalogRoles();
      return res;
    },
    [auth.updateRole, refreshCatalogRoles]
  );

  const handleDeleteRole = useCallback(
    async (idRol: number) => {
      const res = await auth.deleteRole(idRol);
      await refreshCatalogRoles();
      return res;
    },
    [auth.deleteRole, refreshCatalogRoles]
  );

  return (
    <Routes>
      {/* Firma de consentimientos en pantalla completa (tablet o computador, RF-CON-001/002/005) */}
      <Route
        path={ROUTES.PATIENT_CONSENT_SIGNING}
        element={<ConsentSigningRoute capabilities={capabilities} />}
      />

      {/* Shell principal con menú lateral y barra superior */}
      <Route
        element={
          <AuthenticatedDashboardShell
            auth={auth}
            capabilities={capabilities}
            defaultInternalRoute={defaultInternalRoute}
            userDraftHook={userDraftHook}
            patientsHook={patientsHook}
            catalogRoles={catalogRoles}
            handleCreateRole={handleCreateRole}
            handleUpdateRole={handleUpdateRole}
            handleDeleteRole={handleDeleteRole}
            showAlert={showAlert}
            showConfirm={showConfirm}
            AlertModalComponent={AlertModalComponent}
          />
        }
      >
        <Route
          path={ROUTES.AGENDA}
          element={
            <RequirePermission
              allowed={capabilities.canAccessAppointments}
              title="Módulo de Agenda no disponible"
              message="Su rol actual no tiene permisos suficientes para acceder a la agenda clínica."
              fallbackRoute={defaultInternalRoute}
            >
              <AgendaRoute capabilities={capabilities} />
            </RequirePermission>
          }
        >
          <Route index element={null} />
          <Route path="solicitudes/:idSolicitud" element={null} />
          <Route path="citas/:idCita" element={null} />
        </Route>

        <Route
          path={ROUTES.CONSULTATION}
          element={
            <ActiveConsultationRoute
              patients={patientsHook.patients}
              capabilities={capabilities}
              currentUserName={auth.session?.usuario.nombreCompleto ?? ''}
              currentUserSignature={(auth.session?.usuario as any)?.firmaUrl ?? null}
              showAlert={showAlert}
            />
          }
        />

        <Route
          path={ROUTES.PATIENTS}
          element={
            <RequirePermission
              allowed={capabilities.canAccessPatients}
              title="Módulo de Pacientes no disponible"
              message="Su rol actual no tiene permisos suficientes para consultar pacientes."
              fallbackRoute={defaultInternalRoute}
            >
              <PatientsDirectoryPage
                onOpenHolderDataQuery={() => navigate(ROUTES.PATIENT_HOLDER_DATA)}
                canCreatePatient={capabilities.canCreatePatient}
                canAccessHabeasData={capabilities.canAccessHabeasData}
                onSelectPatient={(patient, tab) => {
                  if (tab === 'CLINICAL') {
                    if (capabilities.isCoordinatorOnly || !capabilities.canViewClinicalHistory) {
                      showAlert({
                        title: 'Acceso Restringido',
                        message: 'No tiene permiso para realizar esta acción.',
                        type: 'warning',
                      });
                      return;
                    }
                    navigate(buildPatientClinicalHistoryPath(patient.idPaciente), {
                      state: { patient },
                    });
                    return;
                  }
                  navigate(buildPatientProfilePath(patient.idPaciente), {
                    state: { patient },
                  });
                }}
              />
            </RequirePermission>
          }
        />

        <Route
          path={ROUTES.PATIENT_HOLDER_DATA}
          element={
            <HolderDataQueryRoute
              patients={patientsHook.patients}
              capabilities={capabilities}
              getHolderData={patientsHook.getHolderData}
            />
          }
        />

        <Route
          path={ROUTES.PATIENT_PROFILE}
          element={
            <RequirePermission
              allowed={capabilities.canAccessPatients}
              title="Ficha de Paciente no disponible"
              message="Su rol actual no dispone de permisos para visualizar fichas de pacientes."
              fallbackRoute={defaultInternalRoute}
            >
              <PatientProfileRoute
                patients={patientsHook.patients}
                capabilities={capabilities}
                updatePatient={patientsHook.updatePatient}
                showAlert={showAlert}
              />
            </RequirePermission>
          }
        />

        <Route
          path={ROUTES.PATIENT_CLINICAL_HISTORY}
          element={
            <ClinicalHistoryRoute
              patients={patientsHook.patients}
              capabilities={capabilities}
            />
          }
        />

        <Route
          path={ROUTES.USERS}
          element={
            <RequirePermission
              allowed={capabilities.canAccessUsersModule}
              title="Módulo de Doctores no disponible"
              message="Su rol actual no cuenta con permisos suficientes para gestionar el cuerpo médico."
              fallbackRoute={defaultInternalRoute}
            >
              <UsersManagementPage
                initialRoles={catalogRoles}
                onFetchRoles={auth.fetchRoles}
                canCreateUser={capabilities.canCreateUser}
                savedUserDraft={userDraftHook.getDraftByFormId('USER_FORM')}
                onDiscardUserDraft={() => userDraftHook.discardDraft('USER_FORM')}
                onSearchUsers={auth.searchUsers}
                onCreateUser={auth.createUser}
                onUpdateUser={auth.updateUser}
                onToggleUserStatus={auth.toggleUserStatus}
              />
            </RequirePermission>
          }
        />

        <Route
          path={ROUTES.ROLES}
          element={
            <RequirePermission
              allowed={capabilities.canAccessRolesModule}
              title="Módulo de Roles y Permisos no disponible"
              message="Su rol actual no dispone de los privilegios necesarios para configurar roles."
              fallbackRoute={defaultInternalRoute}
            >
              <RolesManagementPage
                initialRoles={catalogRoles}
                canCreateRole={capabilities.canCreateRole}
                onCreateRole={handleCreateRole}
                onUpdateRole={handleUpdateRole}
                onDeleteRole={handleDeleteRole}
              />
            </RequirePermission>
          }
        />

        <Route
          path={ROUTES.CONSENTS}
          element={
            <RequirePermission
              allowed={capabilities.canAccessConsents}
              title="Módulo de Consentimientos no disponible"
              message="Su rol actual no tiene permisos suficientes para acceder a consentimientos informados."
              fallbackRoute={defaultInternalRoute}
            >
              <ConsentTemplatesAdminPage />
            </RequirePermission>
          }
        />

        <Route path="*" element={<Navigate to={defaultInternalRoute} replace />} />
      </Route>
    </Routes>
  );
};

export const AppRouter: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { drafts, saveDraftForUser, discardDraft } = useSessionDraft(null);

  const auth = useAuth({
    apiBaseUrl: '/api/v1',
    onInactivityAutoSaveDraft: (idUsuario, draft) => {
      saveDraftForUser(idUsuario, draft.formularioId, draft.datosBorrador);
    },
  });

  const capabilities = useMemo(
    () => deriveAccessCapabilities(auth.hasPermission, auth.session?.usuario?.roles),
    [auth]
  );

  const defaultInternalRoute = useMemo(
    () => getDefaultInternalRoute(capabilities),
    [capabilities]
  );

  return (
    <Routes>
      {/* Ruta principal pública: Agendamiento de Pacientes (sin Acceso Personal en header/footer) */}
      <Route
        path={ROUTES.PUBLIC_BOOKING}
        element={
          <PublicRootGuard>
            <PublicBookingPage
              onOpenPrivacyNotice={() =>
                navigate(ROUTES.PRIVACY_NOTICE, { state: { from: ROUTES.PUBLIC_BOOKING } })
              }
            />
          </PublicRootGuard>
        }
      />

      {/* Alias de compatibilidad hacia la raíz pública */}
      <Route
        path={ROUTES.PUBLIC_BOOKING_ALIAS_REQUEST}
        element={<Navigate to={ROUTES.PUBLIC_BOOKING} replace />}
      />
      <Route
        path={ROUTES.PUBLIC_BOOKING_ALIAS_SCHEDULE}
        element={<Navigate to={ROUTES.PUBLIC_BOOKING} replace />}
      />

      {/* Aviso de privacidad público (RQNF-SEG-006) */}
      <Route
        path={ROUTES.PRIVACY_NOTICE}
        element={
          <PrivacyNoticeRoute
            isAuthenticated={auth.isAuthenticated}
            defaultInternalRoute={defaultInternalRoute}
          />
        }
      />

      {/* Recuperación de contraseña (/recuperar-contrasena?token=...) */}
      <Route
        path={ROUTES.RECOVERY}
        element={
          <RecoveryRoute
            onRequestRecoveryLink={auth.requestPasswordRecovery}
            onResetPassword={auth.resetPasswordWithToken}
          />
        }
      />

      {/* Portal de inicio de sesión para personal clínico y administrativo */}
      <Route
        path={ROUTES.LOGIN}
        element={
          <GuestOnlyLogin
            isAuthenticated={auth.isAuthenticated}
            defaultInternalRoute={defaultInternalRoute}
          >
            <LoginPage
              onAuthenticate={auth.authenticate}
              onLoginSuccess={(sessionData) => {
                clearRecoveryTokenFromUrl();
                auth.setActiveSession(sessionData);
                const nextCaps = deriveAccessCapabilities(
                  (code) => sessionData.permisos.includes(code),
                  sessionData.usuario.roles
                );
                const requestedRedirect = sanitizeInternalRedirect(searchParams.get('redirect'));
                navigate(requestedRedirect ?? getDefaultInternalRoute(nextCaps), {
                  replace: true,
                });
              }}
              onNavigateToRecovery={() => navigate(ROUTES.RECOVERY)}
              onNavigateToPublicBooking={() => navigate(ROUTES.PUBLIC_BOOKING)}
              onOpenPrivacyNotice={() =>
                navigate(ROUTES.PRIVACY_NOTICE, { state: { from: ROUTES.LOGIN } })
              }
              pendingDraftsOnLogin={drafts}
              onDiscardDraft={discardDraft}
            />
          </GuestOnlyLogin>
        }
      />

      {/* Rutas internas protegidas por sesión y permisos RBAC */}
      <Route
        path="/*"
        element={
          <RequireAuth isAuthenticated={auth.isAuthenticated}>
            <AuthenticatedWorkspace
              auth={auth}
              capabilities={capabilities}
              defaultInternalRoute={defaultInternalRoute}
            />
          </RequireAuth>
        }
      />
    </Routes>
  );
};
