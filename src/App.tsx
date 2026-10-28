// src/App.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  InternalDashboardLayout,
  InternalNavigationView,
} from './app/layouts/InternalDashboardLayout';
import { useAuth, useSessionDraft } from './modules/users-auth/ui/hooks';
import {
  LoginPage,
  PasswordRecoveryPage,
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
} from './modules/patients/ui/views';
import { PatientListItem, usePatients } from './modules/patients/ui/hooks/usePatients';
import {
  ActiveConsultationPage,
  ClinicalHistoryListPage,
} from './modules/clinical-records/ui/views';
import {
  ConsentTemplatesAdminPage,
  TabletSigningPage,
} from './modules/consents/ui/views';
import { useAlertModal } from './shared/ui/hooks/useAlertModal';

type AppRoute =
  | 'LOGIN'
  | 'RECOVERY'
  | 'PUBLIC_BOOKING'
  | 'INTERNAL_DASHBOARD'
  | 'TABLET_SIGNING';

export const App: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('LOGIN');
  const [internalView, setInternalView] = useState<InternalNavigationView>('APPOINTMENTS');
  const [catalogRoles, setCatalogRoles] = useState<RoleExtendedViewDTO[] | undefined>(undefined);

  // Estados de navegación contextual de Pacientes e Historias
  const [selectedPatient, setSelectedPatient] = useState<PatientListItem | null>(null);
  const [patientSubView, setPatientSubView] = useState<'DIRECTORY' | 'PROFILE' | 'CLINICAL_HISTORY'>('DIRECTORY');

  // Estado de Consulta Activa
  const [activeConsultationContext, setActiveConsultationContext] = useState<{
    idPaciente: number;
    idCita: number;
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
  const { patients, updatePatient } = usePatients();
  const { showAlert, showConfirm, AlertModalComponent } = useAlertModal();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('token')) {
        setCurrentRoute('RECOVERY');
        return;
      }
      if (window.location.pathname.startsWith('/tablet-sign')) {
        setCurrentRoute('TABLET_SIGNING');
        return;
      }
    }
    if (auth.isAuthenticated) {
      setCurrentRoute('INTERNAL_DASHBOARD');
    }
  }, [auth.isAuthenticated]);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    auth
      .fetchRoles()
      .then((loadedRoles) => {
        if (loadedRoles.length > 0) {
          setCatalogRoles(loadedRoles);
        }
      })
      .catch(() => {
        // Conserva los roles semilla
      });
  }, [auth.isAuthenticated, auth.fetchRoles]);

  // Ruta 1: Portal Público de Agendamiento (Páginas 3, 4, 5)
  if (currentRoute === 'PUBLIC_BOOKING') {
    return (
      <PublicBookingPage
        onNavigateToStaffLogin={() => setCurrentRoute('LOGIN')}
        onSubmitPublicBooking={async (bookingData) => {
          console.log('Solicitud pública de cita recibida:', bookingData);
        }}
      />
    );
  }

  // Ruta 2: Terminal Táctil para Tablet de Paciente (Página 21 / RF-CON-002)
  if (currentRoute === 'TABLET_SIGNING') {
    return (
      <TabletSigningPage
        nombrePaciente={selectedPatient?.nombreCompleto}
        documentoPaciente={selectedPatient?.documentoIdentidad}
        onConsentSigned={async (sig) => {
          if (selectedPatient) {
            try {
              await fetch('/api/v1/consents/sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  idConsentimiento: 1,
                  idPaciente: selectedPatient.idPaciente,
                  firmaBase64: sig,
                  nombreFirmante: selectedPatient.nombreCompleto,
                  rolFirmante: 'Paciente',
                }),
              });
            } catch (err) {
              console.error('Error signing consent on tablet:', err);
            }
          }
        }}
        onExit={() => setCurrentRoute('INTERNAL_DASHBOARD')}
      />
    );
  }

  // Ruta 3: Recuperación de Contraseña (Módulo A)
  if (currentRoute === 'RECOVERY') {
    return (
      <PasswordRecoveryPage
        onRequestRecoveryLink={auth.requestPasswordRecovery}
        onResetPassword={auth.resetPasswordWithToken}
        onNavigateToLogin={() => setCurrentRoute('LOGIN')}
        onNavigateToPublicBooking={() => setCurrentRoute('PUBLIC_BOOKING')}
      />
    );
  }

  // Ruta 4: Login de Usuarios
  if (!auth.session || currentRoute === 'LOGIN') {
    return (
      <LoginPage
        onAuthenticate={auth.authenticate}
        onLoginSuccess={(sessionData) => {
          auth.setActiveSession(sessionData);
          setCurrentRoute('INTERNAL_DASHBOARD');
        }}
        onNavigateToRecovery={() => setCurrentRoute('RECOVERY')}
        onNavigateToPublicBooking={() => setCurrentRoute('PUBLIC_BOOKING')}
        pendingDraftsOnLogin={drafts}
        onDiscardDraft={discardDraft}
      />
    );
  }

  // Permisos dinámicos
  const canAccessUsersModule =
    auth.hasPermission('RF-USR-004') || auth.hasPermission('RF-USR-001');
  const canAccessRolesModule =
    auth.hasPermission('RF-USR-007') || auth.hasPermission('RF-USR-010');

  // Render del Dashboard Interno
  return (
    <InternalDashboardLayout
      currentUser={auth.session.usuario}
      activeView={internalView}
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
            patientSex={selectedPatient?.sexo}
            doctorName={auth.session.usuario.nombreCompleto}
            onBackToAgenda={() => setActiveConsultationContext(null)}
            onFinishConsultation={async (idCita) => {
              try {
                await fetch(`/api/v1/appointments/${idCita}/state`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    nuevoEstado: 'Completada',
                    idUsuarioGestor: auth.session?.usuario.idUsuario ?? 1,
                    motivo: 'Atención odontológica concluida con éxito.',
                  }),
                });
              } catch (err) {
                console.error('Error finalizando cita:', err);
              }
              setActiveConsultationContext(null);
            }}
          />
        ) : (
          <InternalAgendaPage
            onStartAttention={(idCita, idPaciente) => {
              const matched = patients.find((p) => p.idPaciente === idPaciente);
              if (matched) setSelectedPatient(matched);
              setActiveConsultationContext({ idPaciente, idCita });
            }}
            onOpenConsultationWorkspace={(idPaciente, idCita) => {
              const matched = patients.find((p) => p.idPaciente === idPaciente);
              if (matched) setSelectedPatient(matched);
              setActiveConsultationContext({ idPaciente, idCita });
            }}
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
        patientSubView === 'PROFILE' && selectedPatient ? (
          <PatientProfilePage
            patient={selectedPatient}
            onBack={() => setPatientSubView('DIRECTORY')}
            onScheduleAppointment={(_patient) => {
              setInternalView('APPOINTMENTS');
            }}
            onOpenConsultation={(patient, idCita) => {
              setSelectedPatient(patient);
              setActiveConsultationContext({ idPaciente: patient.idPaciente, idCita: idCita || 1 });
              setInternalView('APPOINTMENTS');
            }}
            onViewClinicalHistoryDetail={() => {
              setPatientSubView('CLINICAL_HISTORY');
            }}
            onSignConsent={() => {
              setCurrentRoute('TABLET_SIGNING');
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
            onBack={() => setPatientSubView('PROFILE')}
          />
        ) : (
          <PatientsDirectoryPage
            onSelectPatient={(patient, tab) => {
              setSelectedPatient(patient);
              if (tab === 'CLINICAL') {
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
            onCreateRole={auth.createRole}
            onUpdateRole={auth.updateRole}
            onDeleteRole={auth.deleteRole}
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
