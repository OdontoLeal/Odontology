// src/shared/ui/components/Input.tsx
import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-extrabold uppercase tracking-wider text-[#64748B]"
          >
            {label}
            {props.required && <span className="ml-1 text-[#DC2626]">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3.5 flex items-center text-[#64748B]">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full h-[42px] min-h-[42px] rounded-xl border bg-white px-3.5 py-2 text-sm text-[#1E242B] placeholder-[#64748B] transition-colors focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 disabled:bg-[#F3F4F6] disabled:text-[#8F99A3] disabled:cursor-not-allowed ${
              leftIcon ? 'pl-10' : ''
            } ${rightIcon ? 'pr-10' : ''} ${
              error
                ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20'
                : 'border-[#E2E6EA] hover:border-[#CBD2D9]'
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-[#64748B]">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-[13px] font-semibold text-[#DC2626]">{error}</p>}
        {!error && helperText && (
          <p className="text-[13px] text-[#64748B]">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
