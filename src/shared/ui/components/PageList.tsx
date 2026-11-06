// src/shared/ui/components/PageList.tsx
import React from 'react';

/** Lista vertical de tarjetas con 12px de separación entre filas. */
export const PageList: React.FC<{
  children: React.ReactNode;
  'aria-label'?: string;
}> = ({ children, ...props }) => (
  <section {...props} className="flex flex-col gap-3">
    {children}
  </section>
);

export interface ListCardProps extends React.HTMLAttributes<HTMLElement> {
  muted?: boolean;
}

/**
 * Tarjeta de fila: padding 16px 20px, radio 12px, borde 1px #E2E8F0.
 * < 768px: columna (info arriba, acciones debajo a ancho completo, gap 16px).
 * >= 768px: fila con space-between.
 */
export const ListCard: React.FC<ListCardProps> = ({
  muted = false,
  className = '',
  children,
  ...props
}) => (
  <article
    {...props}
    className={`flex min-w-0 flex-col items-stretch gap-4 rounded-xl border border-[#E2E8F0] px-4 py-4 transition-colors sm:px-5 md:flex-row md:items-center md:justify-between md:gap-3 ${
      muted ? 'bg-[#F8FAFC] opacity-80' : 'bg-white hover:border-[#D4AF37]/50'
    } ${className}`}
  >
    {children}
  </article>
);

/** Estados vacíos / de carga con el mismo contenedor que las tarjetas. */
export const ListState: React.FC<{ children: React.ReactNode; role?: string }> = ({
  children,
  role,
}) => (
  <div
    role={role}
    className="space-y-2 rounded-xl border border-[#E2E8F0] bg-white px-5 py-10 text-center"
  >
    {children}
  </div>
);

export const getInitials = (fullName: string): string => {
  const parts = fullName
    .replace(/^(Dr\.|Dra\.)\s*/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'US';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export interface InitialsAvatarProps {
  name: string;
  /** Clases de color (fondo, texto y borde). Por defecto dorado suave OdontoLeal. */
  toneClassName?: string;
}

/** Avatar circular de 48px con iniciales. */
export const InitialsAvatar: React.FC<InitialsAvatarProps> = ({
  name,
  toneClassName = 'bg-[#FBF3D5] text-[#B8942A] border-[#D4AF37]/30',
}) => (
  <div
    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-[14px] font-bold tracking-tight ${toneClassName}`}
    aria-hidden="true"
  >
    {getInitials(name)}
  </div>
);
