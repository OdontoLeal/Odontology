// src/shared/ui/components/Button.tsx
import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const sizeClasses = {
    sm: 'min-h-[36px] px-3 py-1.5 text-xs gap-1.5',
    md: 'min-h-[44px] px-5 py-2.5 text-sm gap-2',
    lg: 'min-h-[50px] px-6 py-3 text-base gap-2.5',
  }[size];

  const variantClasses = {
    primary:
      'bg-gradient-to-b from-[#DDB93E] to-[#C9A227] text-[#111111] shadow-[0_2px_6px_rgba(184,148,42,0.35)] hover:bg-[#B8942A] hover:shadow-[0_4px_10px_rgba(184,148,42,0.4)] active:scale-[0.98]',
    secondary:
      'bg-[#1E242B] text-white hover:bg-[#2C343E] active:scale-[0.98]',
    danger:
      'bg-[#DC2626] text-white hover:bg-[#B91C1C] active:scale-[0.98]',
    outline:
      'border border-[#E2E6EA] bg-white text-[#1E242B] hover:border-[#D4AF37] hover:bg-[#FBF6E6]/40 active:scale-[0.98]',
    ghost:
      'bg-transparent text-[#687380] hover:text-[#1E242B] hover:bg-[#E2E6EA]/50',
  }[variant];

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
