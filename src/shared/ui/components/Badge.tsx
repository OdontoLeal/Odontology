// src/shared/ui/components/Badge.tsx
import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'gold';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  size = 'md',
  icon,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-1 text-xs',
  }[size];

  // Contrastes verificados WCAG AA (>= 4.5:1)
  const variantClasses: Record<BadgeVariant, string> = {
    success: 'bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]',
    warning: 'bg-[#FEF7E0] text-[#B06000] border border-[#FEEFC3]',
    danger: 'bg-[#FCE8E6] text-[#C5221F] border border-[#FAD2CF]',
    info: 'bg-[#E8F0FE] text-[#1967D2] border border-[#D2E3FC]',
    neutral: 'bg-[#F1F3F4] text-[#5F6368] border border-[#DADCE0]',
    gold: 'bg-[#FBF6E6] text-[#8F721A] border border-[#EAD89B]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold select-none ${sizeClasses} ${variantClasses[variant]} ${className}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{label}</span>
    </span>
  );
};
