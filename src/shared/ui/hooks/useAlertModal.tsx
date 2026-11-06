// src/shared/ui/hooks/useAlertModal.tsx
import React, { useState, useCallback } from 'react';
import { AlertModal, AlertModalType } from '../components/AlertModal';

export interface ShowAlertOptions {
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

export function useAlertModal() {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    children?: React.ReactNode;
    type: AlertModalType;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
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
      children: options.children,
      type: options.type || 'info',
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
      maxWidth: options.maxWidth || 'md',
    });
  }, []);

  const showConfirm = useCallback((options: Omit<ShowAlertOptions, 'type'>) => {
    setModalState({
      isOpen: true,
      title: options.title,
      message: options.message,
      children: options.children,
      type: 'confirm',
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
      maxWidth: options.maxWidth || 'md',
    });
  }, []);

  const showDestructive = useCallback((options: Omit<ShowAlertOptions, 'type'>) => {
    setModalState({
      isOpen: true,
      title: options.title,
      message: options.message,
      children: options.children,
      type: 'destructive',
      confirmText: options.confirmText || 'Sí, eliminar',
      cancelText: options.cancelText || 'Cancelar',
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
      maxWidth: options.maxWidth || 'md',
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
        children={modalState.children}
        type={modalState.type}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        onConfirm={modalState.onConfirm}
        onCancel={modalState.onCancel}
        maxWidth={modalState.maxWidth}
      />
    );
  }, [modalState, closeModal]);

  return {
    showAlert,
    showConfirm,
    showDestructive,
    closeModal,
    AlertModalComponent,
  };
}
