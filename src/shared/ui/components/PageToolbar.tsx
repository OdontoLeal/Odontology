// src/shared/ui/components/PageToolbar.tsx
import React from 'react';

export interface PageToolbarProps {
  children: React.ReactNode;
  'aria-label'?: string;
}

/** Tarjeta de filtros/controles unificada, justo debajo de <PageHeader />. */
export const PageToolbar: React.FC<PageToolbarProps> = ({ children, ...props }) => (
  <section
    {...props}
    className="mb-5 flex min-w-0 flex-col items-stretch gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4 [&>*]:min-w-0"
  >
    {children}
  </section>
);

const CONTROL_BASE =
  'min-h-[44px] md:min-h-[38px] rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[13px] text-[#1E242B] placeholder-[#94A3B8] focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors';

export interface ToolbarSearchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  wrapperClassName?: string;
}

/** Buscador: 44px de alto en móvil (táctil) y 38px en escritorio; ancho completo en < 768px. */
export const ToolbarSearch: React.FC<ToolbarSearchProps> = ({
  wrapperClassName = 'w-full md:w-auto md:min-w-[240px] md:flex-1 md:max-w-[480px]',
  className = '',
  ...props
}) => (
  <div className={`relative min-w-0 ${wrapperClassName}`}>
    <span
      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]"
      aria-hidden="true"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </span>
    <input
      type="search"
      className={`${CONTROL_BASE} w-full pl-10 pr-4 ${className}`}
      {...props}
    />
  </div>
);

/** Input de texto simple de 38px (sin icono). */
export const ToolbarInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  ...props
}) => <input className={`${CONTROL_BASE} px-3 ${className}`} {...props} />;

/** Select de 38px. */
export const ToolbarSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <select className={`${CONTROL_BASE} cursor-pointer px-3 font-medium ${className}`} {...props}>
    {children}
  </select>
);

export interface ToolbarSegmentedProps<T extends string> {
  value: T;
  options: ReadonlyArray<{ id: T; label: string }>;
  onChange: (value: T) => void;
  'aria-label': string;
}

/** Selector segmentado (Todos | Activos | Inactivos) con altura total de 38px. */
export function ToolbarSegmented<T extends string>({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
}: ToolbarSegmentedProps<T>): React.ReactElement {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex w-full min-h-[44px] flex-wrap items-stretch gap-[3px] rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-[3px] md:inline-flex md:min-h-[38px] md:w-auto"
    >
      {options.map((opt) => {
        const isSelected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={isSelected}
            className={`min-h-[36px] flex-1 rounded-md px-3.5 text-[13px] leading-tight transition-all md:min-h-[30px] md:flex-none ${
              isSelected
                ? 'bg-[#111111] font-semibold text-white'
                : 'font-medium text-[#64748B] hover:text-[#1E242B]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Etiqueta de texto para controles dentro del toolbar. */
export const ToolbarLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#64748B]">
    {children}
  </span>
);
