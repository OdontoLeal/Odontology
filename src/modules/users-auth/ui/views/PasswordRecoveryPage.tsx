import React, { useEffect, useState } from 'react';
import {
  RecoverPasswordResult,
  RecoverPasswordUseCase,
  RequestPasswordRecoveryCommand,
  ResetPasswordWithTokenCommand,
} from '../../application/recover-password.use-case';
import { PublicNavbar } from '../../../../shared/ui/components/PublicNavbar';

export interface PasswordRecoveryPageProps {
  initialToken?: string | null;
  onRequestRecoveryLink?: (
    command: RequestPasswordRecoveryCommand
  ) => Promise<RecoverPasswordResult>;
  onResetPassword?: (
    command: ResetPasswordWithTokenCommand
  ) => Promise<RecoverPasswordResult>;
  onNavigateToLogin?: () => void;
  onNavigateToPublicBooking?: () => void;
}

export const PasswordRecoveryPage: React.FC<PasswordRecoveryPageProps> = ({
  initialToken,
  onRequestRecoveryLink,
  onResetPassword,
  onNavigateToLogin,
  onNavigateToPublicBooking,
}) => {
  const [tokenFromUrl, setTokenFromUrl] = useState<string | null>(initialToken ?? null);
  const [correo, setCorreo] = useState('');
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [confirmacionContrasena, setConfirmacionContrasena] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialToken !== undefined) {
      setTokenFromUrl(initialToken);
      return;
    }
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tokenParam = params.get('token');
      if (tokenParam) {
        setTokenFromUrl(tokenParam);
      }
    }
  }, [initialToken]);

  const isResetStep = Boolean(tokenFromUrl && tokenFromUrl.trim() !== '');

  const handleRequestLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setInfoMessage(null);

    if (!correo.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      setErrorMessage('Ingrese un correo electrónico con formato válido (usuario@dominio).');
      return;
    }

    setIsSubmitting(true);
    try {
      if (onRequestRecoveryLink) {
        const res = await onRequestRecoveryLink({
          correo: correo.trim().toLowerCase(),
        });
        setInfoMessage(res.message);
      } else {
        const response = await fetch('/api/v1/auth/recovery/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correo: correo.trim().toLowerCase() }),
        });
        const res = await response.json();
        setInfoMessage(res.message || RecoverPasswordUseCase.GENERIC_RESPONSE_MESSAGE);
      }
    } catch {
      setInfoMessage(RecoverPasswordUseCase.GENERIC_RESPONSE_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (nuevaContrasena !== confirmacionContrasena) {
      setErrorMessage('Las contraseñas ingresadas no coinciden.');
      return;
    }

    if (
      nuevaContrasena.length < 8 ||
      !/[a-zA-Z]/.test(nuevaContrasena) ||
      !/\d/.test(nuevaContrasena)
    ) {
      setErrorMessage(
        'La contraseña debe tener mínimo 8 caracteres con al menos una letra y un número.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      if (onResetPassword && tokenFromUrl) {
        const res = await onResetPassword({
          token: tokenFromUrl,
          nuevaContrasena,
          confirmacionContrasena,
        });
        setSuccessMessage(res.message);
      } else {
        const response = await fetch('/api/v1/auth/recovery/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: tokenFromUrl,
            nuevaContrasena,
            confirmacionContrasena,
          }),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(
            body.message || 'El enlace no es válido o ya venció. Solicite uno nuevo'
          );
        }
        setSuccessMessage(body.message || 'Contraseña restablecida exitosamente.');
      }
    } catch (error: any) {
      setErrorMessage(
        error?.message || 'El enlace no es válido o ya venció. Solicite uno nuevo'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToLogin = () => {
    if (onNavigateToLogin) {
      onNavigateToLogin();
    } else {
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[#F8F9FA] text-[#1E242B] overflow-x-hidden">
      {/* 1. Header Unificado con Marca OdontoLeal */}
      <PublicNavbar
        rightAction={
          <button
            type="button"
            onClick={goToLogin}
            className="h-10 px-4 rounded-lg border border-[#E2E6EA] bg-white text-[#1E242B] hover:bg-[#F8FAFC] transition-colors text-sm font-semibold inline-flex items-center gap-2 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
          >
            <span aria-hidden="true">←</span>
            <span>Volver al inicio de sesión</span>
          </button>
        }
      />

      {/* Tarjeta Central */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[440px] rounded-3xl border border-[#E2E6EA] border-t-4 border-t-[#D4AF37] bg-white shadow-xl overflow-hidden">
          <div className="px-6 pt-8 pb-7 sm:px-9 sm:pt-10">
            {/* Ícono superior */}
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF37]/30 bg-[#FBF6E6] text-[#D4AF37]"
              aria-hidden="true"
            >
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>

            <div className="mt-5 text-center">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1E242B]">
                {isResetStep ? 'Restablecer Contraseña' : 'Recuperar Contraseña'}
              </h1>
              <p className="mt-1.5 text-sm text-[#687380] leading-relaxed">
                {isResetStep
                  ? 'Ingrese dos veces su nueva contraseña. El enlace es de un solo uso y tiene vigencia de 30 minutos.'
                  : 'Ingrese el correo electrónico de su cuenta para recibir un enlace de restablecimiento de un solo uso.'}
              </p>
            </div>

            {/* Mensajes de estado (Color + Ícono + Etiqueta según RQNF-USA-001) */}
            {infoMessage && (
              <div
                role="status"
                className="mt-5 rounded-xl border border-[#1D4ED8]/30 bg-[#DBEAFE] p-4 text-[13px] sm:text-sm font-medium text-[#1D4ED8]"
              >
                <p className="font-bold">ℹ Aviso de recuperación:</p>
                <p className="mt-1">{infoMessage}</p>
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                className="mt-5 rounded-xl border border-[#15803D]/30 bg-[#DCFCE7] p-4 text-[13px] sm:text-sm font-medium text-[#15803D]"
              >
                <p className="font-bold">✓ Operación completada:</p>
                <p className="mt-1">{successMessage}</p>
                <button
                  type="button"
                  onClick={goToLogin}
                  className="mt-3 w-full min-h-[44px] rounded-xl bg-[#15803D] px-4 py-2 text-[13px] font-bold text-white hover:opacity-95"
                >
                  Ir a Iniciar Sesión ahora →
                </button>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-[#B91C1C]/30 bg-[#FEE2E2] p-4 text-[13px] sm:text-sm font-medium text-[#B91C1C]"
              >
                <p className="font-bold">✕ Error:</p>
                <p className="mt-1">{errorMessage}</p>
                {isResetStep && errorMessage.toLowerCase().includes('venció') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTokenFromUrl(null);
                      setErrorMessage(null);
                    }}
                    className="mt-3 inline-flex min-h-[40px] items-center rounded-lg bg-white px-3 py-1.5 text-[13px] font-bold text-[#B91C1C] border border-[#B91C1C]/30 hover:bg-[#FEE2E2]/40"
                  >
                    Solicitar un nuevo enlace
                  </button>
                )}
              </div>
            )}

            {/* Formulario Paso 1: Solicitar enlace */}
            {!isResetStep && !successMessage && (
              <form onSubmit={handleRequestLinkSubmit} noValidate className="mt-6 space-y-5">
                <div>
                  <label
                    htmlFor="recovery-email-input"
                    className="block text-[13px] font-bold uppercase tracking-wider text-[#1E242B] mb-2"
                  >
                    Correo Electrónico Registrado
                  </label>
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#687380]"
                      aria-hidden="true"
                    >
                      @
                    </span>
                    <input
                      id="recovery-email-input"
                      type="email"
                      required
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      placeholder="correo@gmail.com"
                      className="w-full min-h-[46px] rounded-xl border border-[#E2E6EA] bg-[#F3F5F7] pl-10 pr-4 py-2.5 text-sm text-[#1E242B] placeholder-[#687380] transition-colors focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#B8942A] disabled:bg-[#C4C9CF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] transition-colors"
                >
                  <span>{isSubmitting ? 'Procesando solicitud...' : 'Enviar enlace de recuperación'}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </form>
            )}

            {/* Formulario Paso 2: Restablecer contraseña con enlace de un solo uso */}
            {isResetStep && !successMessage && (
              <form onSubmit={handleResetPasswordSubmit} noValidate className="mt-6 space-y-5">
                <div>
                  <label
                    htmlFor="reset-new-password"
                    className="block text-[13px] font-bold uppercase tracking-wider text-[#1E242B] mb-2"
                  >
                    Nueva Contraseña *
                  </label>
                  <input
                    id="reset-new-password"
                    type={showPasswords ? 'text' : 'password'}
                    value={nuevaContrasena}
                    onChange={(e) => setNuevaContrasena(e.target.value)}
                    placeholder="Mínimo 8 caracteres (letra y número)"
                    className="w-full min-h-[46px] rounded-xl border border-[#E2E6EA] bg-[#F3F5F7] px-4 py-2.5 text-sm text-[#1E242B] placeholder-[#687380] focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reset-confirm-password"
                    className="block text-[13px] font-bold uppercase tracking-wider text-[#1E242B] mb-2"
                  >
                    Confirmar Nueva Contraseña *
                  </label>
                  <input
                    id="reset-confirm-password"
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmacionContrasena}
                    onChange={(e) => setConfirmacionContrasena(e.target.value)}
                    placeholder="Escriba de nuevo la contraseña"
                    className="w-full min-h-[46px] rounded-xl border border-[#E2E6EA] bg-[#F3F5F7] px-4 py-2.5 text-sm text-[#1E242B] placeholder-[#687380] focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowPasswords((prev) => !prev)}
                    className="text-[13px] font-semibold text-[#687380] hover:text-[#1E242B] underline"
                  >
                    {showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#B8942A] disabled:bg-[#C4C9CF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] transition-colors"
                >
                  <span>{isSubmitting ? 'Guardando nueva contraseña...' : 'Confirmar nueva contraseña'}</span>
                </button>
              </form>
            )}

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#E2E6EA]" />
              <span className="text-[13px] font-medium text-[#687380]">navegación</span>
              <div className="h-px flex-1 bg-[#E2E6EA]" />
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={goToLogin}
                className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-xl border border-[#E2E6EA] bg-white px-4 py-2.5 text-sm font-bold text-[#1E242B] hover:border-[#D4AF37] hover:bg-[#FBF6E6]/40 transition-colors"
              >
                <span aria-hidden="true">←</span>
                <span>Volver a Iniciar Sesión</span>
              </button>

              {onNavigateToPublicBooking && (
                <button
                  type="button"
                  onClick={onNavigateToPublicBooking}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-[#F8F9FA] px-4 py-2 text-[13px] font-semibold text-[#687380] hover:text-[#1E242B]"
                >
                  <span>Ir a solicitud pública de citas</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 border-t border-[#E2E6EA] bg-[#F8F9FA] px-4 py-3.5 text-[13px] font-medium text-[#687380]">
            <span>🔒 Enlace de un solo uso válido por 30 minutos</span>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-[#E2E6EA] bg-white px-4 py-4 text-center text-[13px] text-[#687380]">
        © 2026 OdontoLeal • Dirección Médica Dr. Eduar Leal • Todos los derechos reservados
      </footer>
    </div>
  );
};
