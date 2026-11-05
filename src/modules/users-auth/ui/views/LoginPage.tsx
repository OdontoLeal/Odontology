import React, { useState } from 'react';
import { formatDateTimeCO } from '../../../../shared/ui/format';
import {
  AuthenticateUserCommand,
  AuthenticateUserResult,
} from '../../application/authenticate-user.use-case';
import { SessionDraftDTO, UserWithRolesDomainDTO } from '../../domain/user.repository.interface';
import { LoginAuthCard, LoginAuthSubmitParams } from '../components/LoginAuthCard';
import { PublicNavbar } from '../../../../shared/ui/components/PublicNavbar';

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
    } catch (err: any) {
      const msg = err.message || 'Error de autenticación';
      setErrorMessage(msg);
      if (msg.toLowerCase().includes('bloqueada') || msg.toLowerCase().includes('15 minutos')) {
        setIsLockedOut(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatColombianDateTime = (date: Date): string => formatDateTimeCO(date);

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[#F8F9FA] text-[#1E242B] overflow-x-hidden">
      {/* 1. Header Unificado con Marca OdontoLeal y Agendar Cita */}
      <PublicNavbar onNavigateToBooking={onNavigateToPublicBooking} />

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
