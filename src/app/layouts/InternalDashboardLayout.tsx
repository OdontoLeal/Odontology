// src/app/layouts/InternalDashboardLayout.tsx
import React, { useEffect, useState } from 'react';
import { UserWithRolesDomainDTO } from '../../modules/users-auth/domain/user.repository.interface';
import { InactivityWarningModal } from '../../modules/users-auth/ui/components/InactivityWarningModal';
import { TopPatientSearchBar } from '../../modules/patients/ui/components/TopPatientSearchBar';
import { PatientListItem } from '../../modules/patients/ui/hooks/usePatients';

export type InternalNavigationView =
  | 'APPOINTMENTS'
  | 'PATIENTS'
  | 'USERS'
  | 'ROLES'
  | 'CONSENTS';

export interface InternalDashboardLayoutProps {
  currentUser: UserWithRolesDomainDTO;
  activeView: InternalNavigationView;
  onSelectView: (view: InternalNavigationView) => void;
  isWarningModalOpen: boolean;
  hasUnsavedChanges?: boolean;
  canAccessAppointments?: boolean;
  canAccessPatients?: boolean;
  canAccessUsersModule?: boolean;
  canAccessRolesModule?: boolean;
  canAccessConsents?: boolean;
  onContinueSession: () => void;
  onTimeoutCloseSession: () => void;
  onManualCloseSession: () => void;
  onSelectPatientFromSearch?: (patient: PatientListItem) => void;
  children: React.ReactNode;
}

export const InternalDashboardLayout: React.FC<InternalDashboardLayoutProps> = ({
  currentUser,
  activeView,
  onSelectView,
  isWarningModalOpen,
  hasUnsavedChanges = false,
  canAccessAppointments,
  canAccessPatients,
  canAccessUsersModule,
  canAccessRolesModule,
  canAccessConsents,
  onContinueSession,
  onTimeoutCloseSession,
  onManualCloseSession,
  onSelectPatientFromSearch,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userHasAdmin = currentUser.roles?.some(
    (r) =>
      r.estadoAsignacion &&
      (r.codigo === 'ROL-ADM' ||
        (r as any).codigoRol === 'ROL-ADM' ||
        (r.nombreRol && r.nombreRol.toLowerCase().includes('administrador')))
  );

  const showAppointmentsTab =
    canAccessAppointments !== undefined ? canAccessAppointments : true;
  const showPatientsTab =
    canAccessPatients !== undefined ? canAccessPatients : true;
  const showUsersTab =
    canAccessUsersModule !== undefined ? canAccessUsersModule : Boolean(userHasAdmin);
  const showRolesTab =
    canAccessRolesModule !== undefined ? canAccessRolesModule : Boolean(userHasAdmin);
  const showConsentsTab =
    canAccessConsents !== undefined ? canAccessConsents : true;

  const primaryRoleName =
    currentUser.roles.find((r) => r.estadoAsignacion)?.nombreRol ||
    'Director Odontológico';

  const allNavItems: Array<{
    id: InternalNavigationView;
    label: string;
    icon: React.ReactNode;
    show?: boolean;
  }> = [
    {
      id: 'APPOINTMENTS',
      label: 'Citas',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      show: showAppointmentsTab,
    },
    {
      id: 'PATIENTS',
      label: 'Pacientes',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      show: showPatientsTab,
    },
    {
      id: 'USERS',
      label: 'Doctores',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      ),
      show: showUsersTab,
    },
    {
      id: 'ROLES',
      label: 'Roles y permisos',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      show: showRolesTab,
    },
    {
      id: 'CONSENTS',
      label: 'Consentimientos',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      show: showConsentsTab,
    },
  ];

  const navItems = allNavItems.filter((item) => item.show !== false);


  const closeMenu = () => setMobileMenuOpen(false);

  // Bloquea el scroll de la página y permite cerrar con Escape mientras el drawer está abierto.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    document.body.classList.add('drawer-open');
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const onDesktop = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    desktopQuery.addEventListener('change', onDesktop);
    return () => {
      document.body.classList.remove('drawer-open');
      window.removeEventListener('keydown', onKeyDown);
      desktopQuery.removeEventListener('change', onDesktop);
    };
  }, [mobileMenuOpen]);

  const brand = (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className="flex h-10 w-12 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-[#D4AF37] shadow-xs border border-[#D4AF37]/30"
        aria-hidden="true"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 4c-2.2 0-4 1.8-4 4 0 2.6 1.5 5.2 2.4 7.7.6 1.7 1.3 4.3 2.6 4.3 1.1 0 1.6-1.8 2.3-3.5.4-.9.9-1.5 1.7-1.5s1.3.6 1.7 1.5c.7 1.7 1.2 3.5 2.3 3.5 1.3 0 2-2.6 2.6-4.3.9-2.5 2.4-5.1 2.4-7.7 0-2.2-1.8-4-4-4-1.5 0-2.9.8-3.8 1.5-.7.5-1.7.5-2.4 0C9.9 4.8 8.5 4 7 4z"
          />
        </svg>
      </div>
      <div className="min-w-0 leading-tight">
        <span className="block truncate text-[16px] font-extrabold tracking-tight text-[#1E242B]">
          OdontoLeal
        </span>
        <span className="block truncate text-[13px] font-semibold text-[#B8942A]">
          Gestión Clínica
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] text-[#1E242B] lg:flex">
      {/* Fondo oscuro del menú lateral (solo < 1024px) */}
      <div
        aria-hidden="true"
        onClick={closeMenu}
        className={`fixed inset-0 z-40 bg-[#111111]/50 transition-opacity lg:hidden ${
          mobileMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Sidebar: fijo de 240px en escritorio, off-canvas drawer en tablet/móvil */}
      <aside
        id="app-sidebar"
        aria-label="Navegación principal"
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(280px,85vw)] flex-col overflow-y-auto border-r border-[#E2E6EA] bg-white shadow-xl transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-[240px] lg:shrink-0 lg:translate-x-0 lg:shadow-none ${
          mobileMenuOpen ? 'visible translate-x-0' : 'invisible -translate-x-full lg:visible lg:translate-x-0'
        }`}
      >
        <div className="flex min-h-[72px] items-center justify-between gap-2 px-5 py-3">
          {brand}
          <button
            type="button"
            onClick={closeMenu}
            aria-label="Cerrar menú de navegación"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E2E6EA] text-[#1E242B] hover:bg-[#F8F9FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] lg:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav aria-label="Menú principal" className="space-y-1.5 px-3.5 py-4">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  onSelectView(item.id);
                  closeMenu();
                }}
                className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-[14px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                  isActive
                    ? 'bg-[#111827] font-bold text-white shadow-xs'
                    : 'font-medium text-[#687380] hover:bg-[#F3F5F7] hover:text-[#1E242B]'
                }`}
              >
                <span className={`shrink-0 ${isActive ? 'text-[#D4AF37]' : 'text-[#687380]'}`} aria-hidden="true">
                  {item.icon}
                </span>
                <span className="text-break">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Contenedor derecho: barra superior + contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-[64px] w-full flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#E2E6EA] bg-white px-3 py-2.5 sm:px-6 md:min-h-[72px] md:gap-4 lg:px-8">
          {/* Hamburguesa (< 1024px) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menú de navegación"
            aria-controls="app-sidebar"
            aria-expanded={mobileMenuOpen}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-[#E2E6EA] text-[#1E242B] hover:bg-[#F8F9FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] lg:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Buscador global: pasa a su propia fila a ancho completo en < 768px */}
          {onSelectPatientFromSearch && (
            <div className="order-last w-full min-w-0 md:order-none md:w-auto md:flex-1">
              <TopPatientSearchBar onSelectPatient={onSelectPatientFromSearch} />
            </div>
          )}

          {/* Perfil del usuario activo y Cerrar sesión (RF-USR-008) */}
          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-4">
            <div className="hidden h-8 w-px bg-[#E2E6EA] md:block" aria-hidden="true" />

            <div className="min-w-0 text-right leading-tight">
              <span
                className="block max-w-[160px] truncate text-[14px] font-bold text-[#1E242B] sm:max-w-[240px]"
                title={currentUser.nombreCompleto}
              >
                {currentUser.nombreCompleto}
              </span>
              <span className="hidden max-w-[240px] truncate text-[13px] font-semibold text-[#B8942A] md:block">
                {primaryRoleName}
              </span>
            </div>

            <button
              type="button"
              onClick={onManualCloseSession}
              aria-label="Cerrar sesión"
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#E2E6EA] bg-white px-3 py-2 text-[13px] font-bold text-[#1E242B] transition-colors hover:border-[#B91C1C] hover:bg-[#FEE2E2]/40 hover:text-[#B91C1C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] sm:px-3.5"
            >
              <svg className="h-4 w-4 text-[#B91C1C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </header>

        {/* Área de trabajo principal */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Modal de advertencia al minuto 29 de inactividad (RF-USR-008) */}
      <InactivityWarningModal
        isOpen={isWarningModalOpen}
        initialSecondsRemaining={60}
        hasUnsavedChanges={hasUnsavedChanges}
        onContinueSession={onContinueSession}
        onTimeoutCloseSession={onTimeoutCloseSession}
        onManualCloseSession={onManualCloseSession}
      />
    </div>
  );
};
