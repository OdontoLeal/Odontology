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
    <div className="flex items-center gap-2 text-[13px] font-semibold leading-5 tracking-[0.05em] text-[#B8942A]">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4AF37]" aria-hidden="true" />
      <span className="min-w-0 text-break">
        <span className="uppercase">{eyebrow}</span>
        {eyebrowDetail && <span className="text-[#B8942A]"> · {eyebrowDetail}</span>}
      </span>
    </div>

    {/* < 768px: columna con CTA a ancho completo; >= 768px: fila con acciones a la derecha */}
    <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
      <div className="min-w-0">
        <h1 className="mt-1 text-[24px] font-bold leading-8 text-[#1E242B] text-break sm:text-[28px] sm:leading-9">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[14px] leading-5 text-[#64748B] text-break">{subtitle}</p>
        )}
      </div>

      {actions && (
        <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap md:w-auto md:shrink-0 md:items-center [&>*]:w-full sm:[&>*]:w-auto">
          {actions}
        </div>
      )}
    </div>
  </header>
);

export interface PageHeaderActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline';
  leftIcon?: React.ReactNode;
}

/** Botón de acción del encabezado: mínimo 44px de alto (área táctil), 8px de radio, padding 0 20px. */
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
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-5 py-2 text-center text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses} ${className}`}
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
