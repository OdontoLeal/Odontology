// src/shared/ui/components/PageLayout.tsx
import React from 'react';

export interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper único de todas las vistas del panel de gestión.
 * - Fondo #F8FAFC, contenedor centrado: 1280px de ancho máximo (1440px desde 1920px)
 *   para evitar líneas excesivamente largas en pantallas ultrawide (RQNF-COM-002).
 * - Padding 32px / 40px idéntico en todas las pestañas (se reduce solo en móvil).
 * - Sin overflow propio: el scroll es siempre el nativo de la página.
 */
export const PageLayout: React.FC<PageLayoutProps> = ({ children, className = '' }) => (
  <div className="min-h-full w-full bg-[#F8FAFC] text-[#1E242B]">
    <div
      className={`mx-auto w-full min-w-0 max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8 min-[1920px]:max-w-[1440px] ${className}`}
    >
      {children}
    </div>
  </div>
);
