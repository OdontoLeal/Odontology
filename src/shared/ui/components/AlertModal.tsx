// src/shared/ui/components/AlertModal.tsx
import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export type AlertModalType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: AlertModalType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'Entendido',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <div className="h-12 w-12 rounded-2xl bg-[#E6F4EA] text-[#137333] flex items-center justify-center text-2xl shadow-xs">
            ✓
          </div>
        );
      case 'error':
        return (
          <div className="h-12 w-12 rounded-2xl bg-[#FCE8E6] text-[#C5221F] flex items-center justify-center text-2xl shadow-xs">
            ✕
          </div>
        );
      case 'warning':
        return (
          <div className="h-12 w-12 rounded-2xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center text-2xl shadow-xs">
            ⚠️
          </div>
        );
      case 'confirm':
        return (
          <div className="h-12 w-12 rounded-2xl bg-[#FBF3D5] text-[#B8942A] flex items-center justify-center text-2xl shadow-xs">
            ❓
          </div>
        );
      case 'info':
      default:
        return (
          <div className="h-12 w-12 rounded-2xl bg-[#FBF3D5] text-[#D4AF37] flex items-center justify-center text-2xl shadow-xs">
            ℹ️
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          {type === 'confirm' && (
            <Button variant="outline" size="sm" onClick={handleCancel}>
              {cancelText}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={type === 'confirm' ? handleConfirm : onClose}
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-4 py-2">
        <div className="flex-shrink-0">{getIcon()}</div>
        <div className="space-y-1.5 flex-1">
          <h3 className="text-base font-extrabold text-[#1E242B]">{title}</h3>
          <p className="text-xs sm:text-sm text-[#4B5563] leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </div>
      </div>
    </Modal>
  );
};
