// src/shared/ui/components/PageHeader.tsx
import React from 'react';

export interface PageHeaderProps {
  /** Categoría en mayúsculas (ej. "AGENDA CLÍNICA"). */
  eyebrow: string;
  /** Texto complementario del eyebrow (ej. "Gestión de Horarios y Citas"). */
  eyebrowDetail?: string;
  title: string;
  subtitle?: string;
  /** Zona de acciones (derecha): botón secundario outline + un único CTA primario. */
  actions?: React.ReactNode;
}

/**
 * Encabezado único de las vistas del panel.
 * Estructura fija: eyebrow → fila principal (H1 + subtítulo | acciones).
 * Separación inferior fija de 24px respecto a <PageToolbar />.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  eyebrowDetail,
  title,
  subtitle,
  actions,
}) => (
  <header className="mb-6">
    <div className="flex items-center gap-2 text-[12px] font-semibold leading-4 tracking-[0.05em] text-[#B8942A]">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4AF37]" aria-hidden="true" />
      <span className="truncate">
        <span className="uppercase">{eyebrow}</span>
        {eyebrowDetail && <span className="text-[#B8942A]"> · {eyebrowDetail}</span>}
      </span>
    </div>

    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="mt-1 text-[28px] font-bold leading-9 text-[#1E242B]">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-[14px] leading-5 text-[#64748B] lg:truncate" title={subtitle}>
            {subtitle}
          </p>
        )}
      </div>

      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  </header>
);

export interface PageHeaderActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline';
  leftIcon?: React.ReactNode;
}

/** Botón de acción del encabezado: 40px de alto, 8px de radio, padding 0 20px. */
export const PageHeaderAction: React.FC<PageHeaderActionProps> = ({
  variant = 'primary',
  leftIcon,
  className = '',
  children,
  type = 'button',
  ...props
}) => {
  const variantClasses =
    variant === 'primary'
      ? 'bg-[#D4AF37] text-[#111111] hover:bg-[#B8942A]'
      : 'border border-[#E2E8F0] bg-white text-[#1E242B] hover:border-[#D4AF37] hover:bg-[#FBF3D5]/40';

  return (
    <button
      type={type}
      className={`inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses} ${className}`}
      {...props}
    >
      {leftIcon && (
        <span className="flex shrink-0 items-center" aria-hidden="true">
          {leftIcon}
        </span>
      )}
      <span>{children}</span>
    </button>
  );
};

export const PlusIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);
