// src/App.tsx
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  InternalDashboardLayout,
  InternalNavigationView,
} from './app/layouts/InternalDashboardLayout';
import { useAuth, useSessionDraft } from './modules/users-auth/ui/hooks';
import {
  LoginPage,
  PasswordRecoveryPage,
  clearRecoveryTokenFromUrl,
  RolesManagementPage,
  UsersManagementPage,
} from './modules/users-auth/ui/views';
import { RoleExtendedViewDTO } from './modules/users-auth/ui/views/RolesManagementPage';

// Importaciones de los nuevos módulos UI
import {
  PublicBookingPage,
  InternalAgendaPage,
} from './modules/appointments/ui/views';
import {
  PatientsDirectoryPage,
  PatientProfilePage,
  HolderDataQueryPage,
} from './modules/patients/ui/views';
import { PatientListItem, usePatients } from './modules/patients/ui/hooks/usePatients';
import {
  ActiveConsultationPage,
  ClinicalHistoryListPage,
} from './modules/clinical-records/ui/views';
import {
  ConsentTemplatesAdminPage,
  ConsentSigningPage,
  PrivacyNoticePage,
} from './modules/consents/ui/views';
import { useAlertModal } from './shared/ui/hooks/useAlertModal';

type AppRoute =
  | 'LOGIN'
  | 'RECOVERY'
  | 'PUBLIC_BOOKING'
  | 'PRIVACY_NOTICE'
  | 'INTERNAL_DASHBOARD'
  | 'CONSENT_SIGNING';

export const App: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('LOGIN');
  const [internalView, setInternalView] = useState<InternalNavigationView>('APPOINTMENTS');
  const [catalogRoles, setCatalogRoles] = useState<RoleExtendedViewDTO[] | undefined>(undefined);

  // Estados de navegación contextual de Pacientes e Historias
  const [selectedPatient, setSelectedPatient] = useState<PatientListItem | null>(null);
  const [selectedConsentTemplate, setSelectedConsentTemplate] = useState<{
    idPlantilla: number;
    titulo: string;
    cuerpoTexto: string;
  } | null>(null);
  const [patientSubView, setPatientSubView] = useState<'DIRECTORY' | 'PROFILE' | 'CLINICAL_HISTORY' | 'HOLDER_DATA'>('DIRECTORY');

  // Estado de Consulta Activa
  const [activeConsultationContext, setActiveConsultationContext] = useState<{
    idPaciente: number;
    idCita: number;
    doctorName?: string;
    doctorSignature?: string | null;
  } | null>(null);

  const calculatedPatientAge = useMemo(() => {
    if (selectedPatient?.edad !== undefined) return selectedPatient.edad;
    if (!selectedPatient?.fechaNacimiento) return undefined;
    const birth = new Date(selectedPatient.fechaNacimiento);
    if (isNaN(birth.getTime())) return undefined;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : undefined;
  }, [selectedPatient]);

  const { drafts, saveDraftForUser, discardDraft } = useSessionDraft(null);

  const auth = useAuth({
    apiBaseUrl: '/api/v1',
    onInactivityAutoSaveDraft: (idUsuario, draft) => {
      saveDraftForUser(idUsuario, draft.formularioId, draft.datosBorrador);
    },
  });

  const userDraftHook = useSessionDraft(auth.session?.usuario.idUsuario);
  const { patients, updatePatient, getHolderData } = usePatients();
  const { showAlert, showConfirm, AlertModalComponent } = useAlertModal();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // RQNF-SEG-006: el aviso de privacidad es público y no pide sesión
      if (window.location.pathname.startsWith('/aviso-privacidad')) {
        setCurrentRoute('PRIVACY_NOTICE');
        return;
      }

      // Si el usuario ya está autenticado, tiene prioridad el Dashboard interno y se purgan tokens residuales
      if (auth.isAuthenticated) {
        clearRecoveryTokenFromUrl();
        setCurrentRoute('INTERNAL_DASHBOARD');
        return;
      }

      const params = new URLSearchParams(window.location.search);
      if (params.get('token')) {
        setCurrentRoute('RECOVERY');
        return;
      }
    }
    if (auth.isAuthenticated) {
      setCurrentRoute('INTERNAL_DASHBOARD');
    }
  }, [auth.isAuthenticated]);

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
    if (!auth.isAuthenticated) return;
    refreshCatalogRoles();
  }, [auth.isAuthenticated, refreshCatalogRoles]);

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

  // Permisos dinámicos RBAC centralizados
  const canAccessAppointments = useMemo(() => {
    return (
      auth.hasPermission('RF-AGE-008') ||
      auth.hasPermission('RF-AGE-001') ||
      auth.hasPermission('RF-AGE-002') ||
      auth.hasPermission('RF-AGE-005') ||
      auth.hasPermission('RF-AGE-009') ||
      auth.hasPermission('RF-AGE-012')
    );
  }, [auth]);

  const canAccessPatients = useMemo(() => {
    return (
      auth.hasPermission('RF-HCL-004') ||
      auth.hasPermission('RF-HCL-001') ||
      auth.hasPermission('RF-HCL-002') ||
      auth.hasPermission('RF-HCL-003') ||
      auth.hasPermission('RF-HCL-005') ||
      auth.hasPermission('RF-HCL-008') ||
      auth.hasPermission('RF-HCL-010')
    );
  }, [auth]);

  const canAccessUsersModule = useMemo(() => {
    return (
      auth.hasPermission('RF-USR-004') ||
      auth.hasPermission('RF-USR-001') ||
      auth.hasPermission('RF-USR-002') ||
      auth.hasPermission('RF-USR-003')
    );
  }, [auth]);

  const canAccessRolesModule = useMemo(() => {
    return (
      auth.hasPermission('RF-USR-007') ||
      auth.hasPermission('RF-USR-010') ||
      auth.hasPermission('RF-USR-011')
    );
  }, [auth]);

  const canAccessConsents = useMemo(() => {
    return (
      auth.hasPermission('RF-CON-001') ||
      auth.hasPermission('RF-CON-002') ||
      auth.hasPermission('RF-CON-003') ||
      auth.hasPermission('RF-CON-004') ||
      auth.hasPermission('RF-CON-007') ||
      auth.hasPermission('RF-CON-008')
    );
  }, [auth]);

  // Permisos operativos granulares según RBAC
  const canManageSlots = auth.hasPermission('RF-AGE-001');
  const canCreateAppointment = auth.hasPermission('RF-AGE-002');
  const canStartAttention = auth.hasPermission('RF-AGE-009');
  const canEditClinicalOpening =
    auth.hasPermission('RF-HCL-005') || auth.hasPermission('RF-HCL-006');
  const canAssistConsultation =
    canStartAttention ||
    auth.hasPermission('RF-HCL-007') ||
    auth.hasPermission('RF-HCL-009');
  const canViewClinicalHistory = auth.hasPermission('RF-HCL-008');
  const canGenerateClinicalDocuments =
    auth.hasPermission('RF-DOC-001') ||
    auth.hasPermission('RF-DOC-002') ||
    auth.hasPermission('RF-DOC-003');
  const canCreatePatient = auth.hasPermission('RF-HCL-001');
  const canAccessHabeasData = auth.hasPermission('RF-HCL-010');
  const canCreateUser = auth.hasPermission('RF-USR-001');
  const canCreateRole = auth.hasPermission('RF-USR-007');

  const openConsultationWorkspace = useCallback(
    (
      idPaciente: number,
      idCita: number,
      doctorInfo?: { doctorName?: string; doctorSignature?: string | null }
    ) => {
      const matched = patients.find((p) => p.idPaciente === idPaciente);
      if (matched) {
        setSelectedPatient(matched);
      } else {
        setSelectedPatient(null);
        fetch(`/api/v1/patients/${idPaciente}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((json) => {
            if (json?.data) setSelectedPatient(json.data);
          })
          .catch(() => {});
      }
      setActiveConsultationContext({
        idPaciente,
        idCita,
        doctorName: doctorInfo?.doctorName,
        doctorSignature: doctorInfo?.doctorSignature,
      });
    },
    [patients]
  );

  // Redirigir dinámicamente si la vista activa no está permitida para el rol del usuario
  useEffect(() => {
    if (!auth.session || currentRoute !== 'INTERNAL_DASHBOARD') return;

    const isViewAllowed = (view: InternalNavigationView): boolean => {
      switch (view) {
        case 'APPOINTMENTS':
          return canAccessAppointments;
        case 'PATIENTS':
          return canAccessPatients;
        case 'USERS':
          return canAccessUsersModule;
        case 'ROLES':
          return canAccessRolesModule;
        case 'CONSENTS':
          return canAccessConsents;
        default:
          return false;
      }
    };

    if (!isViewAllowed(internalView)) {
      if (canAccessAppointments) {
        setInternalView('APPOINTMENTS');
      } else if (canAccessPatients) {
        setInternalView('PATIENTS');
      } else if (canAccessConsents) {
        setInternalView('CONSENTS');
      } else if (canAccessUsersModule) {
        setInternalView('USERS');
      } else if (canAccessRolesModule) {
        setInternalView('ROLES');
      }
    }
  }, [
    auth.session,
    currentRoute,
    internalView,
    canAccessAppointments,
    canAccessPatients,
    canAccessUsersModule,
    canAccessRolesModule,
    canAccessConsents,
  ]);

  // Ruta 1: Portal Público de Agendamiento (Páginas 3, 4, 5)
  if (currentRoute === 'PUBLIC_BOOKING') {
    return (
      <PublicBookingPage
        onNavigateToStaffLogin={() => setCurrentRoute('LOGIN')}
        onOpenPrivacyNotice={() => setCurrentRoute('PRIVACY_NOTICE')}
      />
    );
  }

  // Aviso de privacidad y política de tratamiento de datos (RQNF-SEG-006), sin sesión
  if (currentRoute === 'PRIVACY_NOTICE') {
    return (
      <PrivacyNoticePage
        onBack={() => {
          if (typeof window !== 'undefined' && window.location.pathname.startsWith('/aviso-privacidad')) {
            window.history.replaceState(null, '', '/');
          }
          setCurrentRoute(auth.session ? 'INTERNAL_DASHBOARD' : 'LOGIN');
        }}
        onNavigateToPublicBooking={() => setCurrentRoute('PUBLIC_BOOKING')}
      />
    );
  }

  // Firma del consentimiento dentro de la sesión, en tablet o computador (RF-CON-001, RF-CON-002, RF-CON-005)
  if (currentRoute === 'CONSENT_SIGNING') {
    const isMinor = calculatedPatientAge !== undefined ? calculatedPatientAge < 18 : false;
    const backToProfile = () => {
      setCurrentRoute('INTERNAL_DASHBOARD');
      setInternalView('PATIENTS');
      setPatientSubView('PROFILE');
    };

    return (
      <ConsentSigningPage
        tituloConsentimiento={selectedConsentTemplate?.titulo}
        cuerpoTexto={selectedConsentTemplate?.cuerpoTexto}
        nombrePaciente={selectedPatient?.nombreCompleto}
        documentoPaciente={selectedPatient?.documentoIdentidad}
        isMinor={isMinor}
        onConsentSigned={async (payload) => {
          if (!selectedPatient || !selectedConsentTemplate) {
            throw new Error('No hay un paciente o una plantilla seleccionados.');
          }
          const res = await fetch('/api/v1/consents/sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idConsentimiento: selectedConsentTemplate.idPlantilla,
              idPaciente: selectedPatient.idPaciente,
              firmaBase64: payload.firmaBase64,
              aceptado: true,
              firmaPorAcudiente: payload.firmaPorAcudiente,
              nombreDocumentoAcudiente: payload.nombreDocumentoAcudiente,
              textoFirmado: payload.textoFirmado,
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'No se pudo guardar el consentimiento.');
          }
        }}
        onExit={backToProfile}
      />
    );
  }

  // Ruta 3: Recuperación de Contraseña (Módulo A)
  if (currentRoute === 'RECOVERY') {
    return (
      <PasswordRecoveryPage
        onRequestRecoveryLink={auth.requestPasswordRecovery}
        onResetPassword={auth.resetPasswordWithToken}
        onNavigateToLogin={() => {
          clearRecoveryTokenFromUrl();
          setCurrentRoute('LOGIN');
        }}
        onNavigateToPublicBooking={() => {
          clearRecoveryTokenFromUrl();
          setCurrentRoute('PUBLIC_BOOKING');
        }}
      />
    );
  }

  // Ruta 4: Login de Usuarios
  if (!auth.session || currentRoute === 'LOGIN') {
    return (
      <LoginPage
        onAuthenticate={auth.authenticate}
        onLoginSuccess={(sessionData) => {
          clearRecoveryTokenFromUrl();
          auth.setActiveSession(sessionData);
          setCurrentRoute('INTERNAL_DASHBOARD');
        }}
        onNavigateToRecovery={() => setCurrentRoute('RECOVERY')}
        onNavigateToPublicBooking={() => setCurrentRoute('PUBLIC_BOOKING')}
        onOpenPrivacyNotice={() => setCurrentRoute('PRIVACY_NOTICE')}
        pendingDraftsOnLogin={drafts}
        onDiscardDraft={discardDraft}
      />
    );
  }

  // Render del Dashboard Interno
  return (
    <InternalDashboardLayout
      currentUser={auth.session.usuario}
      activeView={internalView}
      canAccessAppointments={canAccessAppointments}
      canAccessPatients={canAccessPatients}
      canAccessUsersModule={canAccessUsersModule}
      canAccessRolesModule={canAccessRolesModule}
      canAccessConsents={canAccessConsents}
      onSelectPatientFromSearch={(patient) => {
        const matched = patients.find((p) => p.idPaciente === patient.idPaciente);
        setSelectedPatient(matched || patient);
        setPatientSubView('PROFILE');
        setInternalView('PATIENTS');
      }}
      onSelectView={(view) => {
        setInternalView(view);
        // Si cambia de vista principal, resetea sub-vistas
        if (view === 'PATIENTS') {
          setPatientSubView('DIRECTORY');
          setSelectedPatient(null);
        }
        if (view === 'APPOINTMENTS') {
          setActiveConsultationContext(null);
        }
      }}
      isWarningModalOpen={auth.isWarningModalOpen}
      hasUnsavedChanges={Boolean(auth.unsavedFormDraft)}
      onContinueSession={auth.continueSessionAfterWarning}
      onTimeoutCloseSession={() => {
        auth.logout('INACTIVITY_TIMEOUT', true);
        setCurrentRoute('LOGIN');
      }}
      onManualCloseSession={async () => {
        const res = await auth.logout('MANUAL', false);
        if (res.requiresConfirmation) {
          showConfirm({
            title: '¿Cerrar Sesión Activa?',
            message: res.message || 'Tiene modificaciones sin guardar. ¿Desea cerrar su sesión de todos modos?',
            confirmText: 'Sí, cerrar sesión',
            cancelText: 'Continuar en el sistema',
            onConfirm: async () => {
              await auth.logout('MANUAL', true);
              setCurrentRoute('LOGIN');
            },
          });
          return;
        }
        setCurrentRoute('LOGIN');
      }}
    >
      <AlertModalComponent />
      {/* VISTA 1: MÓDULO B - AGENDAMIENTO DE CITAS & CONSULTA ACTIVA */}
      {internalView === 'APPOINTMENTS' && (
        activeConsultationContext ? (
          <ActiveConsultationPage
            idPaciente={activeConsultationContext.idPaciente}
            idCita={activeConsultationContext.idCita}
            patientName={selectedPatient?.nombreCompleto || 'Paciente'}
            patientDoc={selectedPatient?.documentoIdentidad || ''}
            patientPhone={selectedPatient?.telefono || ''}
            patientEmail={selectedPatient?.correo || ''}
            patientAge={calculatedPatientAge}
            patientSex={selectedPatient?.sexo ?? undefined}
            doctorName={
              activeConsultationContext.doctorName ||
              (canEditClinicalOpening ? auth.session.usuario.nombreCompleto : 'Profesional asignado')
            }
            doctorSignature={
              activeConsultationContext.doctorSignature ??
              (canEditClinicalOpening ? (auth.session.usuario as any).firmaUrl : null)
            }
            onBackToAgenda={() => setActiveConsultationContext(null)}
            canFinishAttention={canStartAttention}
            isAssistantMode={!canEditClinicalOpening}
            canGenerateDocuments={canGenerateClinicalDocuments}
            canViewClinicalHistory={canViewClinicalHistory}
            onFinishConsultation={async (idCita) => {
              try {
                const res = await fetch(`/api/v1/appointments/${idCita}/state`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ nuevoEstado: 'Atendida' }),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  // RF-AGE-009: sin motivo de consulta guardado no se finaliza
                  showAlert({
                    title: 'No se pudo finalizar la atención',
                    message: err.message || 'Intente de nuevo.',
                    type: 'warning',
                  });
                  return;
                }
              } catch (err) {
                console.error('Error finalizando cita:', err);
                return;
              }

              setActiveConsultationContext(null);
              setInternalView('APPOINTMENTS');
            }}
          />
        ) : (
          <InternalAgendaPage
            canManageSlots={canManageSlots}
            canCreateAppointment={canCreateAppointment}
            canStartAttention={canStartAttention}
            canAssistConsultation={canAssistConsultation}
            onStartAttention={(idCita, idPaciente, doctorInfo) =>
              openConsultationWorkspace(idPaciente, idCita, doctorInfo)
            }
            onOpenConsultationWorkspace={(idPaciente, idCita, doctorInfo) =>
              openConsultationWorkspace(idPaciente, idCita, doctorInfo)
            }
            onNavigateToPatientProfile={(idPaciente) => {
              const matched = patients.find((p) => p.idPaciente === idPaciente);
              if (matched) {
                setSelectedPatient(matched);
                setPatientSubView('PROFILE');
                setInternalView('PATIENTS');
              } else {
                fetch(`/api/v1/patients/${idPaciente}`)
                  .then((res) => (res.ok ? res.json() : null))
                  .then((json) => {
                    if (json?.data) {
                      setSelectedPatient(json.data);
                      setPatientSubView('PROFILE');
                      setInternalView('PATIENTS');
                    }
                  })
                  .catch((err) => {
                    console.error('Error al redirigir al perfil del paciente:', err);
                  });
              }
            }}
          />
        )
      )}

      {/* VISTA 2: MÓDULO C (PARTE 1) - PACIENTES & HISTORIAL CLÍNICO */}
      {internalView === 'PATIENTS' && (
        patientSubView === 'HOLDER_DATA' ? (
          <HolderDataQueryPage
            patients={patients}
            initialSelectedDocument={selectedPatient?.documentoIdentidad}
            onBack={() => setPatientSubView('DIRECTORY')}
            onQueryHolderData={getHolderData}
          />
        ) : patientSubView === 'PROFILE' && selectedPatient ? (
          <PatientProfilePage
            patient={selectedPatient}
            canScheduleAppointment={canCreateAppointment}
            canStartAttention={canStartAttention}
            canAssistConsultation={canAssistConsultation}
            canViewClinicalHistory={canViewClinicalHistory}
            onBack={() => setPatientSubView('DIRECTORY')}
            onScheduleAppointment={(_patient) => {
              setInternalView('APPOINTMENTS');
            }}
            onOpenConsultation={async (patient, idCita, estadoCita) => {
              setSelectedPatient(patient);
              if (idCita && estadoCita !== 'En consulta') {
                try {
                  const res = await fetch(`/api/v1/appointments/${idCita}/state`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nuevoEstado: 'En consulta', motivo: 'Inicio de atención clínica' }),
                  });
                  if (!res.ok) {
                    const errJson = await res.json().catch(() => ({}));
                    // Si ya estaba En consulta no bloqueamos
                    if (!String(errJson.message).toLowerCase().includes('en consulta')) {
                      showAlert({
                        title: 'No se pudo iniciar la atención',
                        message: errJson.message || 'Error al cambiar el estado de la cita a "En consulta".',
                        type: 'error',
                      });
                      return;
                    }
                  }
                } catch (err: any) {
                  showAlert({
                    title: 'Error de conexión',
                    message: err.message || 'No se pudo conectar con el servidor para iniciar la cita.',
                    type: 'error',
                  });
                  return;
                }
              }
              if (!idCita) return;
              setActiveConsultationContext({ idPaciente: patient.idPaciente, idCita });
              setInternalView('APPOINTMENTS');
            }}
            onViewClinicalHistoryDetail={() => {
              const roles: any[] = auth.session?.usuario?.roles || [];
              const roleCodes = roles.map((r) => (typeof r === 'string' ? r : r.codigoRol || r.nombreRol));
              const isCoordinatorOnly = roleCodes.includes('ROL-COA') && !roleCodes.some((rc) => ['ROL-ODO', 'ROL-ESP', 'ROL-ADM'].includes(rc));
              if (isCoordinatorOnly) {
                showAlert({
                  title: 'Acceso Restringido',
                  message: 'No tiene permiso para realizar esta acción.',
                  type: 'warning',
                });
                return;
              }
              setPatientSubView('CLINICAL_HISTORY');
            }}
            onSignConsent={(tplOrId) => {
              if (tplOrId && typeof tplOrId === 'object') {
                setSelectedConsentTemplate({
                  idPlantilla: tplOrId.idPlantilla,
                  titulo: tplOrId.titulo,
                  cuerpoTexto: tplOrId.cuerpoTexto,
                });
              } else {
                setSelectedConsentTemplate({
                  idPlantilla: Number(tplOrId || 1),
                  titulo: 'Consentimiento Informado',
                  cuerpoTexto: '',
                });
              }
              setCurrentRoute('CONSENT_SIGNING');
            }}
            onUpdatePatient={async (id, data) => {
              await updatePatient(id, data);
              setSelectedPatient((prev) => (prev ? { ...prev, ...data } : null));
            }}
          />
        ) : patientSubView === 'CLINICAL_HISTORY' && selectedPatient ? (
          <ClinicalHistoryListPage
            idPaciente={selectedPatient.idPaciente}
            patientName={selectedPatient.nombreCompleto}
            patientDoc={selectedPatient.documentoIdentidad}
            patientData={selectedPatient}
            onBack={() => setPatientSubView('PROFILE')}
          />
        ) : (
          <PatientsDirectoryPage
            onOpenHolderDataQuery={() => setPatientSubView('HOLDER_DATA')}
            canCreatePatient={canCreatePatient}
            canAccessHabeasData={canAccessHabeasData}
            onSelectPatient={(patient, tab) => {
              setSelectedPatient(patient);
              if (tab === 'CLINICAL') {
                const roles: any[] = auth.session?.usuario?.roles || [];
                const roleCodes = roles.map((r) => (typeof r === 'string' ? r : r.codigoRol || r.nombreRol));
                const isCoordinatorOnly = roleCodes.includes('ROL-COA') && !roleCodes.some((rc) => ['ROL-ODO', 'ROL-ESP', 'ROL-ADM'].includes(rc));
                if (isCoordinatorOnly) {
                  showAlert({
                    title: 'Acceso Restringido',
                    message: 'No tiene permiso para realizar esta acción.',
                    type: 'warning',
                  });
                  return;
                }
                setPatientSubView('CLINICAL_HISTORY');
              } else {
                setPatientSubView('PROFILE');
              }
            }}
          />
        )
      )}

      {/* VISTA 3: MÓDULO A - GESTIÓN DE DOCTORES / USUARIOS */}
      {internalView === 'USERS' && (
        !canAccessUsersModule ? (
          <div className="p-6 sm:p-8">
            <div
              role="alert"
              className="mx-auto max-w-xl rounded-2xl border border-[#E2E6EA] border-t-4 border-t-[#D4AF37] bg-white p-8 text-center shadow-xs space-y-4"
            >
              <h2 className="text-xl font-extrabold text-[#1E242B]">
                Módulo de Doctores no disponible
              </h2>
              <p className="text-sm text-[#687380]">
                Su rol actual no cuenta con permisos suficientes para gestionar el cuerpo médico.
              </p>
            </div>
          </div>
        ) : (
          <UsersManagementPage
            initialRoles={catalogRoles}
            onFetchRoles={auth.fetchRoles}
            canCreateUser={canCreateUser}
            savedUserDraft={userDraftHook.getDraftByFormId('USER_FORM')}
            onDiscardUserDraft={() => userDraftHook.discardDraft('USER_FORM')}
            onSearchUsers={auth.searchUsers}
            onCreateUser={auth.createUser}
            onUpdateUser={auth.updateUser}
            onToggleUserStatus={auth.toggleUserStatus}
          />
        )
      )}

      {/* VISTA 4: MÓDULO A - ROLES Y PERMISOS */}
      {internalView === 'ROLES' && (
        !canAccessRolesModule ? (
          <div className="p-6 sm:p-8">
            <div
              role="alert"
              className="mx-auto max-w-xl rounded-2xl border border-[#E2E6EA] border-t-4 border-t-[#D4AF37] bg-white p-8 text-center shadow-xs space-y-4"
            >
              <h2 className="text-xl font-extrabold text-[#1E242B]">
                Módulo de Roles y Permisos no disponible
              </h2>
              <p className="text-sm text-[#687380]">
                Su rol actual no dispone de los privilegios necesarios para configurar roles.
              </p>
            </div>
          </div>
        ) : (
          <RolesManagementPage
            initialRoles={catalogRoles}
            canCreateRole={canCreateRole}
            onCreateRole={handleCreateRole}
            onUpdateRole={handleUpdateRole}
            onDeleteRole={handleDeleteRole}
          />
        )
      )}

      {/* VISTA 5: MÓDULO D - CONSENTIMIENTOS INFORMADOS */}
      {internalView === 'CONSENTS' && (
        <ConsentTemplatesAdminPage />
      )}
    </InternalDashboardLayout>
  );
};

export default App;
