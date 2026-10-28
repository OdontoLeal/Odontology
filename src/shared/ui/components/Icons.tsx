// src/shared/ui/components/Icons.tsx
import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  color?: string;
}

// 👤 Paciente / Usuario
export const UserIcon: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// 👥 Grupo de usuarios / Familiares
export const UsersIcon: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

// 👨‍⚕️ Médico / Profesional tratante
export const DoctorIcon: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M19 8v6m3-3h-6" />
  </svg>
);

// 📅 Calendario / Fecha
export const CalendarIcon: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

// 🕒 Reloj / Horario
export const ClockIcon: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// 🦷 Diente / Odontograma / Pieza Dental
export const ToothIcon: React.FC<IconProps> = ({ size = 18, className = '', color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M7 3C4.24 3 2 5.24 2 8c0 3.1 1.5 6.2 3 9.5 1.1 2.4 2.8 3.5 4.5 3.5 1.5 0 2.5-.8 2.5-2.5V14h0v4.5c0 1.7 1 2.5 2.5 2.5 1.7 0 3.4-1.1 4.5-3.5 1.5-3.3 3-6.4 3-9.5 0-2.76-2.24-5-5-5-2.2 0-3.8 1.4-5 1.4S9.2 3 7 3z" />
  </svg>
);

// 💊 Píldora / Medicamento / Fármaco
export const PillIcon: React.FC<IconProps> = ({ size = 18, className = '', color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
    <path d="m8.5 8.5 7 7" />
  </svg>
);

// 🛌 Reposo / Incapacidad médica
export const BedIcon: React.FC<IconProps> = ({ size = 18, className = '', color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M2 4v16" />
    <path d="M2 8h18a2 2 0 0 1 2 2v10" />
    <path d="M2 17h20" />
    <path d="M6 8v9" />
  </svg>
);

// 🩺 Estetoscopio / Patologías / Remisión médica
export const StethoscopeIcon: React.FC<IconProps> = ({ size = 18, className = '', color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
    <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
    <circle cx="20" cy="10" r="2" />
  </svg>
);

// 🖨️ Impresora / Documento PDF
export const PrinterIcon: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

// 📋 Portapapeles / Procedimiento / Ficha
export const ClipboardIcon: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

// 📝 Nota / Observación
export const FileTextIcon: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

// 📞 Teléfono / Contacto
export const PhoneIcon: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

// ✨ Destello / Precarga / Autocompletado (Dorado OdontoLeal)
export const SparklesIcon: React.FC<IconProps> = ({ size = 16, className = '', color = '#D4AF37', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </svg>
);

// 🔍 Búsqueda
export const SearchIcon: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

// 🔒 Candado cerrado
export const LockIcon: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// 🔓 Candado abierto
export const UnlockIcon: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

// ✂️ Tijeras / Cirugías
export const ScissorsIcon: React.FC<IconProps> = ({ size = 16, className = '', color = '#D4AF37', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
);

// 🩹 Vendaje / Traumas / Accidentes
export const BandageIcon: React.FC<IconProps> = ({ size = 16, className = '', color = '#D4AF37', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <rect x="2" y="7" width="20" height="10" rx="3" />
    <line x1="9" y1="7" x2="9" y2="17" />
    <line x1="15" y1="7" x2="15" y2="17" />
  </svg>
);

// 🛡️ Escudo / Inmunología / Protección
export const ShieldIcon: React.FC<IconProps> = ({ size = 16, className = '', color = '#D4AF37', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

// 🍷 Copa / Bebidas / Alcohol
export const WineIcon: React.FC<IconProps> = ({ size = 16, className = '', color = '#D4AF37', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M8 22h8" />
    <path d="M12 15v7" />
    <path d="M12 15a5 5 0 0 0 5-5V2H7v8a5 5 0 0 0 5 5Z" />
  </svg>
);

// 🚬 Cigarro / Tabaco / Vapeo
export const CigaretteIcon: React.FC<IconProps> = ({ size = 16, className = '', color = '#D4AF37', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M18 12H2v4h16" />
    <path d="M22 12v4" />
    <path d="M18 8c0-2.5-2-2.5-2-5" />
    <path d="M22 8c0-2.5-2-2.5-2-5" />
  </svg>
);

// 🍬 Caramelo / Golosinas / Chicle
export const CandyIcon: React.FC<IconProps> = ({ size = 16, className = '', color = '#D4AF37', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="12" cy="12" r="5" />
    <path d="M16 16l5 5m-2-5l2 5-5-2" />
    <path d="M8 8L3 3m2 5L3 3l5 2" />
  </svg>
);

// 🪥 Cepillo dental / Cepillado
export const ToothbrushIcon: React.FC<IconProps> = ({ size = 16, className = '', color = '#D4AF37', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M19.5 4.5l-4 4" />
    <path d="M17 2l5 5-13 13H4v-5L17 2z" />
    <path d="M14 6l4 4" />
  </svg>
);

// 🧵 Hilo / Seda dental
export const DentalFlossIcon: React.FC<IconProps> = ({ size = 16, className = '', color = '#D4AF37', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 4v3m0 10v3" />
  </svg>
);

// 👄 Labios / Sonrisa
export const LipIcon: React.FC<IconProps> = ({ size = 16, className = '', color = '#D4AF37', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M3 13c3-3 6-4 9-2 3-2 6-1 9 2-3 4-6 6-9 6s-6-2-9-6Z" />
    <path d="M3 13c3 1 6 2 9 2s6-1 9-2" />
  </svg>
);

// 👅 Lengua
export const TongueIcon: React.FC<IconProps> = ({ size = 16, className = '', color = '#D4AF37', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M6 9a6 6 0 0 1 12 0v5a6 6 0 0 1-12 0V9Z" />
    <line x1="12" y1="9" x2="12" y2="15" />
  </svg>
);

// 🗣️ Carrillos / Mucosa yugal
export const CheeksIcon: React.FC<IconProps> = ({ size = 16, className = '', color = '#D4AF37', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 15c1 1 2.5 1.5 4 1.5s3-.5 4-1.5" />
    <circle cx="9" cy="10" r="1" fill={color} />
    <circle cx="15" cy="10" r="1" fill={color} />
  </svg>
);

// 🏛️ Bóveda palatina / Paladar duro
export const PalateIcon: React.FC<IconProps> = ({ size = 16, className = '', color = '#D4AF37', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M4 19c0-6 3.5-12 8-12s8 6 8 12" />
    <line x1="12" y1="7" x2="12" y2="19" />
  </svg>
);

// 〰️ Frenillos
export const FrenumIcon: React.FC<IconProps> = ({ size = 16, className = '', color = '#D4AF37', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M12 2v20" />
    <path d="M7 8c2.5 1.5 7.5 1.5 10 0" />
    <path d="M7 16c2.5 1.5 7.5 1.5 10 0" />
  </svg>
);

// 🔴 Amígdalas / Nódulos
export const TonsilsIcon: React.FC<IconProps> = ({ size = 16, className = '', color = '#D4AF37', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="7" cy="12" r="4" />
    <circle cx="17" cy="12" r="4" />
    <path d="M11 6v12" />
  </svg>
);

// 💾 Guardar
export const SaveIcon: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);
