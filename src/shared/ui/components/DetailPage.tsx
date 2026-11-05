// src/shared/ui/components/DetailPage.tsx
// Sistema único para vistas de segundo y tercer nivel (detalle, fichas, historiales,
// certificados, sub-módulos): encabezado con "Volver", tarjetas de sección, avatares,
// banner de identificación del paciente y estados vacíos.
import React from 'react';
import { getInitials } from './PageList';

/* ------------------------------------------------------------------ */
/* Iconos base                                                         */
/* ------------------------------------------------------------------ */

export const ArrowLeftIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 16,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* DetailPageContainer                                                 */
/* ------------------------------------------------------------------ */

/** Contenedor de las vistas de detalle: mismo ancho y márgenes que <PageLayout />. */
export const DetailPageContainer: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className="min-h-full w-full bg-[#F8FAFC] text-[#1E242B]">
    <div
      className={`mx-auto w-full min-w-0 max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8 min-[1920px]:max-w-[1440px] ${className}`}
    >
      {children}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* BackLink + DetailPageHeader                                         */
/* ------------------------------------------------------------------ */

export interface BackLinkProps {
  /** Texto completo, p. ej. "Volver a la Agenda". */
  label: string;
  onClick?: () => void;
}

/** Fila 1: enlace de retorno solo en su línea. */
export const BackLink: React.FC<BackLinkProps> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="-ml-1 inline-flex min-h-[44px] items-center gap-2 rounded-lg px-1 text-[14px] font-medium text-[#64748B] transition-colors hover:text-[#1E242B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] md:min-h-[32px]"
  >
    <ArrowLeftIcon size={16} className="shrink-0" />
    <span className="text-break text-left">{label}</span>
  </button>
);

export interface DetailPageHeaderProps {
  backLabel?: string;
  onBack?: () => void;
  title: React.ReactNode;
  /** Badge principal de estado o normativa, en línea con el H1. */
  badge?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Contenido adicional bajo el subtítulo (metadatos de la vista). */
  meta?: React.ReactNode;
  /** Barra de acciones (usar <DetailAction />), alineada con el H1. */
  actions?: React.ReactNode;
}

/**
 * Encabezado único de vistas secundarias:
 * Fila 1 → "← Volver a …" · Fila 2 → H1 + badge + subtítulo | acciones.
 */
export const DetailPageHeader: React.FC<DetailPageHeaderProps> = ({
  backLabel,
  onBack,
  title,
  badge,
  subtitle,
  meta,
  actions,
}) => (
  <header className="mb-6 min-w-0">
    {backLabel && (
      <div className="mb-3">
        <BackLink label={backLabel} onClick={onBack} />
      </div>
    )}

    <div className="flex min-w-0 flex-col items-stretch gap-4 md:flex-row md:flex-wrap md:items-start md:justify-between">
      <div className="min-w-0 md:flex-1">
        <div className="inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-break text-[24px] font-bold leading-8 text-[#1E242B] sm:text-[28px] sm:leading-9">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-break mt-1 text-[14px] leading-5 text-[#64748B]">{subtitle}</p>
        )}
        {meta && <div className="mt-3 min-w-0">{meta}</div>}
      </div>

      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2.5 md:w-auto md:max-w-full md:justify-end [&>*]:flex-[1_1_auto] md:[&>*]:flex-none">
          {actions}
        </div>
      )}
    </div>
  </header>
);

/* ------------------------------------------------------------------ */
/* DetailAction                                                        */
/* ------------------------------------------------------------------ */

export type DetailActionVariant = 'primary' | 'outline' | 'dark' | 'danger';

export interface DetailActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: DetailActionVariant;
  leftIcon?: React.ReactNode;
}

const ACTION_VARIANTS: Record<DetailActionVariant, string> = {
  primary: 'bg-[#D4AF37] text-[#111111] border border-[#D4AF37] hover:bg-[#B8942A] hover:border-[#B8942A]',
  outline: 'bg-white text-[#1E242B] border border-[#E2E8F0] hover:border-[#D4AF37] hover:bg-[#FBF3D5]/40',
  dark: 'bg-[#111111] text-[#D4AF37] border border-[#111111] hover:bg-black',
  danger: 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FCA5A5] hover:bg-[#FEE2E2]',
};

/** Botón de la barra de acciones: 44px de alto en móvil, 40px en escritorio. */
export const DetailAction: React.FC<DetailActionProps> = ({
  variant = 'outline',
  leftIcon,
  className = '',
  children,
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-center text-[14px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-[40px] ${ACTION_VARIANTS[variant]} ${className}`}
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

/* ------------------------------------------------------------------ */
/* StatusBadge                                                         */
/* ------------------------------------------------------------------ */

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'gold' | 'dark';

const STATUS_TONES: Record<StatusTone, string> = {
  success: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
  warning: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
  danger: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]',
  info: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
  neutral: 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]',
  gold: 'bg-[#FBF3D5] text-[#8F721A] border-[#EAD89B]',
  dark: 'bg-[#111111] text-white border-[#111111]',
};

/** Badge de estado/normativa que acompaña al H1 y a los encabezados de sección. */
export const StatusBadge: React.FC<{
  tone?: StatusTone;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}> = ({ tone = 'neutral', children, icon, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[13px] font-semibold leading-5 ${STATUS_TONES[tone]} ${className}`}
  >
    {icon && (
      <span className="flex shrink-0 items-center" aria-hidden="true">
        {icon}
      </span>
    )}
    {children}
  </span>
);

/** Badge según el estado de una cita. */
export const AppointmentStatusBadge: React.FC<{ estado?: string | null }> = ({ estado }) => {
  if (!estado) return null;
  const tone: StatusTone =
    estado === 'Confirmada' || estado === 'Atendida'
      ? 'success'
      : estado === 'En consulta'
        ? 'dark'
        : estado === 'Solicitada' || estado === 'Pendiente'
          ? 'info'
          : estado === 'Inasistencia' || estado === 'Rechazada'
            ? 'danger'
            : 'neutral';
  return <StatusBadge tone={tone}>{estado}</StatusBadge>;
};

/* ------------------------------------------------------------------ */
/* SectionCard                                                         */
/* ------------------------------------------------------------------ */

/** Clase del contenedor de tarjeta de sección (para usar sin el componente). */
export const SECTION_CARD_CLASS =
  'min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-4 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-6';

export interface SectionCardHeaderProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  /** Variante del contenedor del icono. */
  iconTone?: 'gold' | 'dark';
  /** Contador o badge opcional junto al título. */
  count?: React.ReactNode;
  /** Texto descriptivo opcional bajo el título. */
  description?: React.ReactNode;
  /** Acción secundaria a la derecha del encabezado. */
  action?: React.ReactNode;
}

/** Encabezado interno estándar de una tarjeta de sección. */
export const SectionCardHeader: React.FC<SectionCardHeaderProps> = ({
  title,
  icon,
  iconTone = 'gold',
  count,
  description,
  action,
}) => (
  <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[#F3F4F6] pb-3">
    <div className="flex min-w-0 items-center gap-3">
      {icon && (
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#D4AF37] [&_svg]:h-[18px] [&_svg]:w-[18px] ${
            iconTone === 'dark' ? 'bg-[#111111]' : 'bg-[#FBF3D5]'
          }`}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-break text-[16px] font-bold leading-6 text-[#1E242B]">{title}</h2>
          {count !== undefined && count !== null && count !== false && (
            <span className="inline-flex items-center rounded-full bg-[#FBF3D5] px-2.5 py-0.5 text-[13px] font-semibold text-[#8F721A]">
              {count}
            </span>
          )}
        </div>
        {description && <p className="mt-0.5 text-[13px] leading-5 text-[#64748B]">{description}</p>}
      </div>
    </div>
    {action && <div className="flex min-w-0 flex-wrap items-center gap-2">{action}</div>}
  </div>
);

export interface SectionCardProps extends SectionCardHeaderProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

/** Tarjeta de sección estándar: fondo blanco, borde #E2E8F0, radio 12px, padding 20px 24px. */
export const SectionCard: React.FC<SectionCardProps> = ({
  children,
  className = '',
  id,
  ...header
}) => (
  <section id={id} className={`${SECTION_CARD_CLASS} ${className}`}>
    <SectionCardHeader {...header} />
    <div className="min-w-0">{children}</div>
  </section>
);

/** Enlace de acción secundaria para el encabezado de una SectionCard. */
export const SectionAction: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  className = '',
  children,
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={`inline-flex min-h-[44px] items-center gap-1 rounded-lg px-1 text-[14px] font-semibold text-[#B8942A] transition-colors hover:text-[#8F721A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-50 md:min-h-[32px] ${className}`}
    {...props}
  >
    {children}
  </button>
);

/* ------------------------------------------------------------------ */
/* EmptyState                                                          */
/* ------------------------------------------------------------------ */

/** Estado vacío interno estándar. */
export const EmptyState: React.FC<{ children: React.ReactNode; action?: React.ReactNode }> = ({
  children,
  action,
}) => (
  <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-center text-[14px] leading-6 text-[#64748B]">
    <div className="text-break">{children}</div>
    {action && <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div>}
  </div>
);

/* ------------------------------------------------------------------ */
/* UserAvatar                                                          */
/* ------------------------------------------------------------------ */

const AVATAR_SIZES = {
  sm: 'h-8 w-8 text-[13px]',
  md: 'h-12 w-12 text-[15px]',
  lg: 'h-16 w-16 text-[20px]',
} as const;

const AVATAR_TONES = {
  gold: 'bg-[#FBF3D5] text-[#8F721A] border-[#D4AF37]/40',
  dark: 'bg-[#111111] text-[#D4AF37] border-[#111111]',
} as const;

/** Avatar de persona (pacientes y doctores): siempre circular. */
export const UserAvatar: React.FC<{
  name: string;
  size?: keyof typeof AVATAR_SIZES;
  tone?: keyof typeof AVATAR_TONES;
  className?: string;
}> = ({ name, size = 'md', tone = 'gold', className = '' }) => (
  <div
    className={`flex shrink-0 items-center justify-center rounded-full border font-bold tracking-tight ${AVATAR_SIZES[size]} ${AVATAR_TONES[tone]} ${className}`}
    aria-hidden="true"
  >
    {getInitials(name || '')}
  </div>
);

/* ------------------------------------------------------------------ */
/* InfoItem + PatientSummaryBanner                                     */
/* ------------------------------------------------------------------ */

/** Dato etiquetado con icono dorado. */
export const InfoItem: React.FC<{
  icon?: React.ReactNode;
  label: string;
  value?: React.ReactNode;
  className?: string;
}> = ({ icon, label, value, className = '' }) => (
  <div className={`min-w-0 ${className}`}>
    <dt className="flex items-center gap-1.5 text-[13px] font-medium leading-5 text-[#64748B]">
      {icon && (
        <span className="flex shrink-0 items-center text-[#D4AF37] [&_svg]:h-3.5 [&_svg]:w-3.5" aria-hidden="true">
          {icon}
        </span>
      )}
      {label}
    </dt>
    <dd className="text-break mt-0.5 text-[14px] font-semibold leading-5 text-[#1E242B]">
      {value === undefined || value === null || value === '' ? '—' : value}
    </dd>
  </div>
);

const svgProps = {
  fill: 'none',
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const InfoIcons = {
  age: (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  birth: (
    <svg {...svgProps}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  ),
  sex: (
    <svg {...svgProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" />
    </svg>
  ),
  phone: (
    <svg {...svgProps}>
      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  mail: (
    <svg {...svgProps}>
      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  document: (
    <svg {...svgProps}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 10h4M7 14h10" />
    </svg>
  ),
};

export interface PatientSummaryBannerProps {
  nombre: string;
  documento?: string | null;
  edad?: number | string | null;
  fechaNacimiento?: string | null;
  sexo?: string | null;
  telefono?: string | null;
  correo?: string | null;
  /** Hace el nombre clicable (p. ej. ir a la ficha del paciente). */
  onNameClick?: () => void;
  /** Badges extra junto al nombre. */
  badges?: React.ReactNode;
  /** Acción a la derecha (p. ej. "Ver ficha completa"). */
  action?: React.ReactNode;
}

/** Banner de identificación del paciente (Detalle de Cita, Ficha Médica, etc.). */
export const PatientSummaryBanner: React.FC<PatientSummaryBannerProps> = ({
  nombre,
  documento,
  edad,
  fechaNacimiento,
  sexo,
  telefono,
  correo,
  onNameClick,
  badges,
  action,
}) => (
  <div className="min-w-0 space-y-4">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-4">
        <UserAvatar name={nombre} size="md" />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {onNameClick ? (
              <button
                type="button"
                onClick={onNameClick}
                className="text-break text-left text-[18px] font-bold leading-6 text-[#1E242B] transition-colors hover:text-[#B8942A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
              >
                {nombre}
              </button>
            ) : (
              <span className="text-break text-[18px] font-bold leading-6 text-[#1E242B]">{nombre}</span>
            )}
            {badges}
          </div>
          {documento && (
            <p className="mt-0.5 text-[14px] text-[#64748B]">Documento: {documento}</p>
          )}
        </div>
      </div>
      {action}
    </div>

    <dl className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-6 gap-y-3 rounded-lg bg-[#F8FAFC] p-4">
      {edad !== undefined && (
        <InfoItem icon={InfoIcons.age} label="Edad" value={edad !== null && edad !== '' ? `${edad} años` : null} />
      )}
      {fechaNacimiento !== undefined && (
        <InfoItem icon={InfoIcons.birth} label="Fecha de nacimiento" value={fechaNacimiento} />
      )}
      {sexo !== undefined && <InfoItem icon={InfoIcons.sex} label="Sexo" value={sexo} />}
      {telefono !== undefined && <InfoItem icon={InfoIcons.phone} label="Teléfono" value={telefono} />}
      {correo !== undefined && (
        <InfoItem icon={InfoIcons.mail} label="Correo electrónico" value={correo} className="sm:col-span-2" />
      )}
    </dl>
  </div>
);
