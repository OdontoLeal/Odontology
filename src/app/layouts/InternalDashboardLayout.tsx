// src/app/layouts/InternalDashboardLayout.tsx
import React, { useState } from 'react';
import { UserWithRolesDomainDTO } from '../../modules/users-auth/domain/user.repository.interface';
import { InactivityWarningModal } from '../../modules/users-auth/ui/components/InactivityWarningModal';

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
  onContinueSession: () => void;
  onTimeoutCloseSession: () => void;
  onManualCloseSession: () => void;
  children: React.ReactNode;
}

export const InternalDashboardLayout: React.FC<InternalDashboardLayoutProps> = ({
  currentUser,
  activeView,
  onSelectView,
  isWarningModalOpen,
  hasUnsavedChanges = false,
  onContinueSession,
  onTimeoutCloseSession,
  onManualCloseSession,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [topSearchQuery, setTopSearchQuery] = useState('');

  const primaryRoleName =
    currentUser.roles.find((r) => r.estadoAsignacion)?.nombreRol ||
    'Director Odontológico';

  const navItems: Array<{
    id: InternalNavigationView;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'APPOINTMENTS',
      label: 'Citas',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'PATIENTS',
      label: 'Pacientes',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
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
    },
    {
      id: 'ROLES',
      label: 'Roles y permisos',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      id: 'CONSENTS',
      label: 'Consentimientos',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F8F9FA] text-[#1E242B] overflow-x-hidden">
      {/* Sidebar Izquierdo Blanco según diseño adjunto */}
      <aside className="w-full lg:w-[235px] shrink-0 bg-white flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#E2E6EA]">
        <div>
          {/* Cabecera del Sidebar con Logo OdontoLeal */}
          <div className="flex items-center justify-between px-5 h-[72px]">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-12 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-[#D4AF37] shadow-xs border border-[#D4AF37]/30"
                aria-hidden="true"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.7}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 4c-2.2 0-4 1.8-4 4 0 2.6 1.5 5.2 2.4 7.7.6 1.7 1.3 4.3 2.6 4.3 1.1 0 1.6-1.8 2.3-3.5.4-.9.9-1.5 1.7-1.5s1.3.6 1.7 1.5c.7 1.7 1.2 3.5 2.3 3.5 1.3 0 2-2.6 2.6-4.3.9-2.5 2.4-5.1 2.4-7.7 0-2.2-1.8-4-4-4-1.5 0-2.9.8-3.8 1.5-.7.5-1.7.5-2.4 0C9.9 4.8 8.5 4 7 4z"
                  />
                </svg>
              </div>
              <div className="leading-tight">
                <span className="block text-[16px] font-extrabold tracking-tight text-[#1E242B]">
                  OdontoLeal
                </span>
                <span className="block text-[12px] font-semibold text-[#D4AF37]">
                  Gestión Clínica
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Abrir o cerrar menú de navegación"
              className="lg:hidden min-h-[44px] min-w-[44px] rounded-xl border border-[#E2E6EA] text-[#1E242B] flex items-center justify-center hover:bg-[#F8F9FA]"
            >
              ☰
            </button>
          </div>

          {/* Navegación Principal */}
          <nav
            aria-label="Menú principal"
            className={`${
              mobileMenuOpen ? 'block' : 'hidden'
            } lg:block px-3.5 py-4 space-y-1.5`}
          >
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectView(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full min-h-[44px] flex items-center gap-3 rounded-xl px-4 py-2.5 text-left text-[14px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                    isActive
                      ? 'bg-[#111827] font-bold text-white shadow-xs'
                      : 'font-medium text-[#687380] hover:bg-[#F3F5F7] hover:text-[#1E242B]'
                  }`}
                >
                  <span
                    className={isActive ? 'text-[#D4AF37]' : 'text-[#687380]'}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Contenedor Derecho: Header Superior + Contenido */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Barra Superior Blanca según diseño adjunto */}
        <header className="w-full min-h-[72px] bg-white border-b border-[#E2E6EA] px-4 py-3 sm:px-8 flex flex-wrap items-center justify-between gap-4">
          {/* Buscador superior izquierdo */}
          <div className="relative w-full max-w-md">
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#D4AF37]"
              aria-hidden="true"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={topSearchQuery}
              onChange={(e) => setTopSearchQuery(e.target.value)}
              placeholder="Buscar paciente por nombre o CC..."
              aria-label="Buscar paciente por nombre o CC"
              className="w-full min-h-[42px] rounded-xl border border-[#E2E6EA] bg-[#F8F9FA]/70 pl-10 pr-9 py-2 text-[13px] sm:text-sm text-[#1E242B] placeholder-[#94A3B8] focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
            />
            {topSearchQuery && (
              <button
                type="button"
                onClick={() => setTopSearchQuery('')}
                aria-label="Limpiar búsqueda rápida"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-[#94A3B8] hover:text-[#1E242B]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Perfil del usuario activo y botón Cerrar sesión (RF-USR-008) */}
          <div className="flex items-center gap-4 ml-auto">
            <div className="hidden sm:block h-8 w-px bg-[#E2E6EA]" aria-hidden="true" />

            <div className="text-right leading-tight">
              <span className="block text-[14px] font-bold text-[#1E242B]">
                {currentUser.nombreCompleto}
              </span>
              <span className="block text-[12px] font-semibold text-[#D4AF37]">
                {primaryRoleName}
              </span>
            </div>

            <button
              type="button"
              onClick={onManualCloseSession}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#E2E6EA] bg-white px-3.5 py-2 text-[13px] font-bold text-[#1E242B] hover:border-[#B91C1C] hover:bg-[#FEE2E2]/40 hover:text-[#B91C1C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] transition-colors"
            >
              <svg
                className="h-4 w-4 text-[#B91C1C]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span>Cerrar sesión</span>
            </button>
          </div>
        </header>

        {/* Área de Trabajo Principal */}
        <main className="flex-1">{children}</main>
      </div>

      {/* Modal de Advertencia al Minuto 29 de Inactividad (RF-USR-008) */}
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