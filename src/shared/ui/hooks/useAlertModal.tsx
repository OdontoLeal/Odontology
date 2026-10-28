// src/shared/ui/hooks/useAlertModal.tsx
import React, { useState, useCallback } from 'react';
import { AlertModal, AlertModalType } from '../components/AlertModal';

export interface ShowAlertOptions {
  title: string;
  message: string;
  type?: AlertModalType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function useAlertModal() {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: AlertModalType;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showAlert = useCallback((options: ShowAlertOptions) => {
    setModalState({
      isOpen: true,
      title: options.title,
      message: options.message,
      type: options.type || 'info',
      confirmText: options.confirmText || 'Entendido',
      cancelText: options.cancelText,
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
    });
  }, []);

  const showConfirm = useCallback((options: Omit<ShowAlertOptions, 'type'>) => {
    setModalState({
      isOpen: true,
      title: options.title,
      message: options.message,
      type: 'confirm',
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
    });
  }, []);

  const closeModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const AlertModalComponent = useCallback(() => {
    return (
      <AlertModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        onConfirm={modalState.onConfirm}
        onCancel={modalState.onCancel}
      />
    );
  }, [modalState, closeModal]);

  return {
    showAlert,
    showConfirm,
    closeModal,
    AlertModalComponent,
  };
}
