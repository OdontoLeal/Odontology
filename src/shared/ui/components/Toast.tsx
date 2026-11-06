// src/shared/ui/components/Toast.tsx
import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm sm:max-w-md w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => (
        <ToastSingle key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastSingle: React.FC<{ toast: ToastItem; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animación de entrada
    const enterTimer = setTimeout(() => setIsVisible(true), 10);
    const duration = toast.duration ?? 4000;
    const dismissTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onDismiss(toast.id), 200);
    }, duration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(dismissTimer);
    };
  }, [toast, onDismiss]);

  const getStyleTokens = () => {
    switch (toast.type) {
      case 'success':
        return {
          icon: '✓',
          iconBg: 'bg-[#DCFCE7] text-[#15803D]',
          border: 'border-[#15803D]/25',
          progress: 'bg-[#15803D]',
        };
      case 'error':
        return {
          icon: '✕',
          iconBg: 'bg-[#FEE2E2] text-[#B91C1C]',
          border: 'border-[#B91C1C]/25',
          progress: 'bg-[#B91C1C]',
        };
      case 'warning':
        return {
          icon: '⚠',
          iconBg: 'bg-[#FEFCE8] text-[#B59428]',
          border: 'border-[#D4AF37]/30',
          progress: 'bg-[#D4AF37]',
        };
      case 'info':
      default:
        return {
          icon: 'ℹ',
          iconBg: 'bg-[#DBEAFE] text-[#1D4ED8]',
          border: 'border-[#1D4ED8]/25',
          progress: 'bg-[#1D4ED8]',
        };
    }
  };

  const tokens = getStyleTokens();

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto transform transition-all duration-200 ease-out rounded-2xl bg-white p-4 shadow-xl border ${tokens.border} ${
        isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-3 opacity-0 scale-95'
      }`}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-sm shadow-2xs ${tokens.iconBg}`}
          aria-hidden="true"
        >
          {tokens.icon}
        </div>
        <div className="flex-1 min-w-0 pr-1">
          <h4 className="text-sm font-bold text-[#1F2937] leading-tight">
            {toast.title}
          </h4>
          {toast.message && (
            <p className="mt-1 text-xs text-[#4B5563] leading-relaxed line-clamp-2">
              {toast.message}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onDismiss(toast.id), 200);
          }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#1F2937] hover:bg-[#F3F4F6] transition-colors focus:outline-none"
          aria-label="Cerrar notificación"
        >
          <span className="text-sm font-semibold">✕</span>
        </button>
      </div>
    </div>
  );
};
