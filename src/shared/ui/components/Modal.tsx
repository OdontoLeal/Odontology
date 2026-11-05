// src/shared/ui/components/Modal.tsx
import React, { useEffect, useRef } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  zIndex?: string;
  closeOnBackdropClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'lg',
  zIndex = 'z-50',
  closeOnBackdropClick = true,
}) => {
  const modalCardRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Guardar elemento enfocado antes de abrir modal
    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    // Prevenir scroll en el fondo
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Auto-focus en el primer elemento interactivo del modal
    const focusableSelectors =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const timer = setTimeout(() => {
      if (modalCardRef.current) {
        const focusable = modalCardRef.current.querySelectorAll<HTMLElement>(focusableSelectors);
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      }
    }, 50);

    // Manejo de teclado (Escape y Focus Trap)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      // Focus Trap accesible (WCAG 2.1 AA)
      if (e.key === 'Tab' && modalCardRef.current) {
        const focusables = modalCardRef.current.querySelectorAll<HTMLElement>(focusableSelectors);
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);

      // Restaurar foco al cerrar
      if (previouslyFocusedElement.current && typeof previouslyFocusedElement.current.focus === 'function') {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    full: 'max-w-[95vw]',
  }[maxWidth];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 ${zIndex} flex items-center justify-center p-3 sm:p-6 overflow-y-auto`}
    >
      {/* Backdrop con blur */}
      <div
        onClick={closeOnBackdropClick ? onClose : undefined}
        className="fixed inset-0 bg-[#111111]/60 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Card - 70/20/10 tokens y diseño consistente */}
      <div
        ref={modalCardRef}
        className={`relative w-full ${maxWidthClasses} transform overflow-hidden rounded-2xl sm:rounded-3xl border border-[#E5E7EB] border-t-4 border-t-[#D4AF37] bg-white p-5 sm:p-7 text-left shadow-2xl transition-all my-auto max-h-[90vh] flex flex-col`}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div className="flex items-start justify-between pb-4 border-b border-[#E5E7EB] flex-shrink-0 gap-3">
            <div className="min-w-0 flex-1">
              {title && (
                <div className="text-lg sm:text-xl font-extrabold text-[#1F2937] leading-snug">
                  {title}
                </div>
              )}
              {subtitle && (
                <p className="mt-1 text-xs sm:text-[13px] text-[#4B5563] leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl p-2 text-[#64748B] hover:bg-[#F3F4F6] hover:text-[#111111] transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              aria-label="Cerrar ventana modal"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content Body con scroll interno controlado */}
        <div className="py-4 overflow-y-auto flex-1 text-sm text-[#4B5563]">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="pt-4 border-t border-[#E5E7EB] flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
