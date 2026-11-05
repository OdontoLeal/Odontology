import React, { useState } from 'react';
import { formatDateTimeCO } from '../../../../shared/ui/format';
import {
  AuthenticateUserCommand,
  AuthenticateUserResult,
} from '../../application/authenticate-user.use-case';
import { SessionDraftDTO, UserWithRolesDomainDTO } from '../../domain/user.repository.interface';
import { LoginAuthCard, LoginAuthSubmitParams } from '../components/LoginAuthCard';

export interface LoginPageProps {
  onAuthenticate?: (command: AuthenticateUserCommand) => Promise<AuthenticateUserResult>;
  onLoginSuccess?: (sessionData: {
    usuario: UserWithRolesDomainDTO;
    permisos: string[];
  }) => void;
  onNavigateToRecovery?: () => void;
  onNavigateToPublicBooking?: () => void;
  onOpenPrivacyNotice?: () => void;
  pendingDraftsOnLogin?: SessionDraftDTO[];
  onRestoreDraft?: (draft: SessionDraftDTO) => void;
  onDiscardDraft?: (formularioId: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onAuthenticate,
  onLoginSuccess,
  onNavigateToRecovery,
  onNavigateToPublicBooking,
  onOpenPrivacyNotice,
  pendingDraftsOnLogin = [],
  onRestoreDraft,
  onDiscardDraft,
}) => {
  const [requiresTempPasswordChange, setRequiresTempPasswordChange] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [authenticatedSession, setAuthenticatedSession] = useState<{
    usuario: UserWithRolesDomainDTO;
    permisos: string[];
  } | null>(null);

  const handleLoginSubmit = async (params: LoginAuthSubmitParams) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (onAuthenticate) {
        const result = await onAuthenticate({
          correo: params.correo,
          contrasena: params.contrasena,
          nuevaContrasena: params.nuevaContrasena,
          confirmacionNuevaContrasena: params.confirmacionNuevaContrasena,
        });

        if (result.requiereCambioContrasena) {
          setRequiresTempPasswordChange(true);
          setErrorMessage(null);
          return;
        }

        if (result.usuario && result.permisos) {
          setRequiresTempPasswordChange(false);
          setIsLockedOut(false);
          setAuthenticatedSession({
            usuario: result.usuario,
            permisos: result.permisos,
          });

          if (pendingDraftsOnLogin.length === 0 && onLoginSuccess) {
            onLoginSuccess({
              usuario: result.usuario,
              permisos: result.permisos,
            });
          }
        }
      } else {
        // Fallback HTTP hacia el endpoint estándar de autenticación (RF-USR-005)
        const response = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.message || 'Correo o contraseña incorrectos');
        }

        if (body.requiereCambioContrasena) {
          setRequiresTempPasswordChange(true);
          return;
        }

        if (body.usuario && onLoginSuccess) {
          onLoginSuccess({
            usuario: body.usuario,
            permisos: body.permisos ?? [],
          });
        }
      }
    } catch (error: any) {
      const msg = error?.message || 'Correo o contraseña incorrectos';
      setErrorMessage(msg);
      if (msg.toLowerCase().includes('15 minutos') || msg.toLowerCase().includes('demasiados intentos')) {
        setIsLockedOut(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatColombianDateTime = (date: Date): string => formatDateTimeCO(date);

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[#F8F9FA] text-[#1E242B] overflow-x-hidden">
      {/* Cabecera Institucional OdontoLeal (Diseño image_05071f.png) */}
      <header className="w-full border-b border-[#E2E6EA] bg-white px-4 py-3.5 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#111111] text-[#D4AF37] shadow-xs border border-[#D4AF37]/40"
              aria-hidden="true"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 4c-2.2 0-4 1.8-4 4 0 2.6 1.5 5.2 2.4 7.7.6 1.7 1.3 4.3 2.6 4.3 1.1 0 1.6-1.8 2.3-3.5.4-.9.9-1.5 1.7-1.5s1.3.6 1.7 1.5c.7 1.7 1.2 3.5 2.3 3.5 1.3 0 2-2.6 2.6-4.3.9-2.5 2.4-5.1 2.4-7.7 0-2.2-1.8-4-4-4-1.5 0-2.9.8-3.8 1.5-.7.5-1.7.5-2.4 0C9.9 4.8 8.5 4 7 4z"
                />
              </svg>
            </div>
            <div>
              <span className="block text-base sm:text-lg font-extrabold tracking-tight text-[#1E242B] leading-tight">
                Portal OdontoLeal
              </span>
              <span className="block text-[13px] font-bold uppercase tracking-widest text-[#D4AF37]">
                DR. EDUAR LEAL
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onNavigateToPublicBooking) {
                onNavigateToPublicBooking();
              } else {
                window.location.href = '/solicitud-cita';
              }
            }}
            className="hidden sm:inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E2E6EA] bg-[#F8F9FA] px-4 py-2 text-[13px] font-bold text-[#1E242B] hover:border-[#D4AF37] hover:bg-[#FBF6E6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] transition-colors"
          >
            <span>Agendar cita como paciente</span>
          </button>
        </div>
      </header>

      {/* Contenido Principal Centrado */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        {/* Si el usuario acaba de autenticarse y tiene borradores pendientes por cierre de inactividad (RF-USR-008) */}
        {authenticatedSession && pendingDraftsOnLogin.length > 0 ? (
          <section
            aria-labelledby="draft-recovery-title"
            className="w-full max-w-lg rounded-3xl border border-[#E2E6EA] border-t-4 border-t-[#D4AF37] bg-white p-6 sm:p-8 shadow-xl space-y-5"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FBF6E6] border border-[#D4AF37]/40 text-[#D4AF37]">
                💾
              </div>
              <div>
                <span className="inline-flex items-center rounded-md bg-[#DBEAFE] px-2.5 py-0.5 text-[13px] font-bold text-[#1D4ED8]">
                  Borrador recuperado
                </span>
                <h2 id="draft-recovery-title" className="mt-1.5 text-xl font-bold text-[#1E242B]">
                  Cambios sin guardar de su sesión anterior
                </h2>
                <p className="mt-1 text-[13px] sm:text-sm text-[#687380]">
                  Su sesión anterior se cerró por inactividad. Estos borradores son visibles solo para usted y no entran a ningún registro oficial hasta que los guarde con las reglas del formulario de origen.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {pendingDraftsOnLogin.map((draft) => (
                <div
                  key={draft.formularioId}
                  className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-bold text-[#1E242B]">
                      Formulario: {draft.formularioId}
                    </p>
                    <p className="text-[13px] text-[#687380]">
                      Guardado el: {formatColombianDateTime(draft.fechaGuardado)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRestoreDraft?.(draft)}
                      className="min-h-[44px] rounded-xl bg-[#D4AF37] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#B8942A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]"
                    >
                      Retomar borrador
                    </button>
                    <button
                      type="button"
                      onClick={() => onDiscardDraft?.(draft.formularioId)}
                      className="min-h-[44px] rounded-xl border border-[#E2E6EA] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#B91C1C] hover:bg-[#FEE2E2]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B91C1C]"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[#E2E6EA] pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => onLoginSuccess?.(authenticatedSession)}
                className="min-h-[44px] rounded-xl border border-[#E2E6EA] bg-white px-5 py-2.5 text-sm font-bold text-[#1E242B] hover:border-[#D4AF37]"
              >
                Continuar al panel principal →
              </button>
            </div>
          </section>
        ) : (
          <LoginAuthCard
            requiresTemporaryPasswordChange={requiresTempPasswordChange}
            isSubmitting={isSubmitting}
            errorMessage={errorMessage}
            isLockedOut={isLockedOut}
            onSubmit={handleLoginSubmit}
            onForgotPasswordClick={() => {
              if (onNavigateToRecovery) {
                onNavigateToRecovery();
              } else {
                window.location.href = '/recuperar-contrasena';
              }
            }}
            onBackToPublicBookingClick={() => {
              if (onNavigateToPublicBooking) {
                onNavigateToPublicBooking();
              } else {
                window.location.href = '/solicitud-cita';
              }
            }}
          />
        )}
      </main>

      {/* Pie de Página con Aviso de Privacidad (RQNF-SEG-006 y diseño image_05071f.png) */}
      <footer className="w-full border-t border-[#E2E6EA] bg-white px-4 py-4 text-center">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-[13px] text-[#687380]">
          <span>
            © 2026 OdontoLeal • Dirección Médica Dr. Eduar Leal • Todos los derechos reservados
          </span>
          <span className="hidden sm:inline" aria-hidden="true">
            •
          </span>
          <button
            type="button"
            onClick={() => {
              if (onOpenPrivacyNotice) {
                onOpenPrivacyNotice();
              } else {
                window.location.href = '/aviso-privacidad';
              }
            }}
            className="font-semibold text-[#1E242B] underline hover:text-[#D4AF37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded"
          >
            Aviso de Privacidad y Política de Tratamiento de Datos (Ley 1581 de 2012)
          </button>
        </div>
      </footer>
    </div>
  );
};