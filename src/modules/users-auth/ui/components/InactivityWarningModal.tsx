import React, { useEffect, useState } from 'react';

export interface InactivityWarningModalProps {
  isOpen: boolean;
  initialSecondsRemaining?: number;
  hasUnsavedChanges?: boolean;
  onContinueSession: () => void;
  onTimeoutCloseSession: () => void;
  onManualCloseSession: () => void;
}

export const InactivityWarningModal: React.FC<InactivityWarningModalProps> = ({
  isOpen,
  initialSecondsRemaining = 60,
  hasUnsavedChanges = false,
  onContinueSession,
  onTimeoutCloseSession,
  onManualCloseSession,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSecondsRemaining);

  useEffect(() => {
    if (!isOpen) {
      setSecondsLeft(initialSecondsRemaining);
      return;
    }

    setSecondsLeft(initialSecondsRemaining);
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          onTimeoutCloseSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isOpen, initialSecondsRemaining, onTimeoutCloseSession]);

  if (!isOpen) return null;

  const progressPercentage = Math.max(
    0,
    Math.min(100, Math.round((secondsLeft / initialSecondsRemaining) * 100))
  );

  return (
    <div
      id="inactivity-warning-modal"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="inactivity-modal-title"
      aria-describedby="inactivity-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/70 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl border-t-4 border-[#D4AF37] bg-white p-6 sm:p-7 shadow-2xl">
        {/* Ícono superior estilo OdontoLeal */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF37]/40 bg-[#FBF6E6] text-[#D4AF37]">
          <svg
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <div className="mt-4 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEE2E2] px-3 py-1 text-[13px] font-bold text-[#B91C1C]">
            ⚠ Aviso de inactividad por seguridad
          </span>

          <h2
            id="inactivity-modal-title"
            className="mt-3 text-xl font-bold text-[#1E242B]"
          >
            Su sesión está por cerrarse
          </h2>

          <p
            id="inactivity-modal-desc"
            className="mt-2 text-sm text-[#687380] leading-relaxed"
          >
            Por seguridad clínica, la sesión se cerrará automáticamente tras 30 minutos sin interacción. Tiempo restante:
          </p>

          {/* Contador regresivo accesible */}
          <div
            role="timer"
            aria-live="assertive"
            className="my-4 rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] py-3 px-4"
          >
            <span className="text-3xl font-extrabold text-[#1E242B] font-mono">
              00:{String(secondsLeft).padStart(2, '0')}
            </span>
            <span className="block text-[13px] font-medium text-[#687380] mt-0.5">
              segundos para el cierre automático
            </span>

            {/* Barra de progreso */}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#E2E6EA]">
              <div
                className="h-full bg-[#D4AF37] transition-all duration-1000"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Aviso de borrador automático según RF-USR-008 */}
          {hasUnsavedChanges && (
            <div className="mb-4 rounded-xl border border-[#1D4ED8]/20 bg-[#DBEAFE] p-3 text-left text-[13px] text-[#1D4ED8]">
              <p className="font-bold">💾 Protección de cambios sin guardar:</p>
              <p className="mt-0.5">
                Si la sesión se cierra por inactividad, sus cambios actuales se conservarán como un <strong>borrador privado</strong> y se le ofrecerán al volver a ingresar.
              </p>
            </div>
          )}
        </div>

        {/* Controles con altura mínima táctil de 44px (RQNF-COM-002) */}
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            autoFocus
            onClick={onContinueSession}
            className="w-full min-h-[46px] rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#B8942A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] transition-colors"
          >
            Continuar sesión
          </button>

          <button
            type="button"
            onClick={onManualCloseSession}
            className="w-full min-h-[44px] rounded-xl border border-[#E2E6EA] bg-white px-5 py-2.5 text-sm font-semibold text-[#687380] hover:border-[#B91C1C] hover:text-[#B91C1C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] transition-colors"
          >
            Cerrar sesión ahora
          </button>
        </div>
      </div>
    </div>
  );
};
