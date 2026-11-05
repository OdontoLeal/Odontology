// src/shared/ui/components/AlertModal.tsx
import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export type AlertModalType =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'confirm'
  | 'destructive';

export interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  children?: React.ReactNode;
  type?: AlertModalType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  children,
  type = 'info',
  confirmText,
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  maxWidth = 'md',
}) => {
  const isQuestionType = type === 'confirm' || type === 'destructive';
  const defaultConfirmText = isQuestionType
    ? type === 'destructive'
      ? 'Sí, confirmar'
      : 'Confirmar'
    : 'Entendido';

  const resolvedConfirmText = confirmText || defaultConfirmText;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <div className="h-11 w-11 rounded-2xl bg-[#DCFCE7] text-[#15803D] flex items-center justify-center text-xl font-bold shadow-2xs">
            ✓
          </div>
        );
      case 'error':
        return (
          <div className="h-11 w-11 rounded-2xl bg-[#FEE2E2] text-[#B91C1C] flex items-center justify-center text-xl font-bold shadow-2xs">
            ✕
          </div>
        );
      case 'warning':
        return (
          <div className="h-11 w-11 rounded-2xl bg-[#FEFCE8] text-[#B59428] border border-[#D4AF37]/30 flex items-center justify-center text-xl font-bold shadow-2xs">
            ⚠
          </div>
        );
      case 'destructive':
        return (
          <div className="h-11 w-11 rounded-2xl bg-[#FEE2E2] text-[#B91C1C] border border-[#B91C1C]/25 flex items-center justify-center text-xl font-bold shadow-2xs">
            ⚠
          </div>
        );
      case 'confirm':
        return (
          <div className="h-11 w-11 rounded-2xl bg-[#FEFCE8] text-[#D4AF37] border border-[#D4AF37]/30 flex items-center justify-center text-xl font-bold shadow-2xs">
            ?
          </div>
        );
      case 'info':
      default:
        return (
          <div className="h-11 w-11 rounded-2xl bg-[#DBEAFE] text-[#1D4ED8] flex items-center justify-center text-xl font-bold shadow-2xs">
            ℹ
          </div>
        );
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  const handleBackdropOrClose = () => {
    if (!isQuestionType && onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleBackdropOrClose}
      maxWidth={maxWidth}
      zIndex="z-[100]"
      closeOnBackdropClick={!isQuestionType}
      footer={
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 w-full">
          {isQuestionType && (
            <button
              type="button"
              onClick={handleCancel}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-[40px] px-4 py-2 rounded-xl border border-[#E5E7EB] bg-white text-sm font-semibold text-[#1F2937] hover:bg-[#F3F4F6] transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            className={`w-full sm:w-auto min-h-[44px] sm:min-h-[40px] px-5 py-2 rounded-xl text-sm font-bold shadow-2xs transition-all focus:outline-none focus:ring-2 ${
              type === 'destructive'
                ? 'bg-[#B91C1C] hover:bg-[#991B1B] text-white focus:ring-[#B91C1C]'
                : 'bg-[#D4AF37] hover:bg-[#B59428] text-[#111111] focus:ring-[#D4AF37]'
            }`}
          >
            {resolvedConfirmText}
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-4 py-1">
        <div className="flex-shrink-0 pt-0.5">{getIcon()}</div>
        <div className="space-y-2 flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-[#1F2937] leading-snug">
            {title}
          </h3>
          {message && (
            <p className="text-[13.5px] sm:text-sm text-[#4B5563] leading-relaxed whitespace-pre-line">
              {message}
            </p>
          )}
          {children && <div className="mt-2 text-sm">{children}</div>}
        </div>
      </div>
    </Modal>
  );
};
