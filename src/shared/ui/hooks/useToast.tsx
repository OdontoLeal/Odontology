// src/shared/ui/hooks/useToast.tsx
import React, { useState, useCallback } from 'react';
import { ToastContainer, ToastItem, ToastType } from '../components/Toast';

export interface ShowToastOptions {
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((options: ShowToastOptions) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastItem = {
      id,
      type: options.type || 'info',
      title: options.title,
      message: options.message,
      duration: options.duration || 4000,
    };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ToastContainerComponent = useCallback(() => {
    return <ToastContainer toasts={toasts} onDismiss={dismissToast} />;
  }, [toasts, dismissToast]);

  return {
    showToast,
    dismissToast,
    ToastContainerComponent,
  };
}
