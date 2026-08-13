'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

const VARIANTS = {
  primary: 'bg-brand text-base hover:brightness-[1.08]',
  dark: 'bg-surface-interactive text-ink hover:bg-surface-alt',
  outlined: 'bg-transparent text-ink shadow-[inset_0_0_0_1px_theme(colors.line.strong)] hover:bg-white/[0.07]',
  ghost: 'bg-transparent text-ink-muted hover:bg-white/[0.07]',
  danger: 'bg-status-over-bg text-status-over shadow-[inset_0_0_0_1px_#f3727f]',
} as const;

const SIZES = {
  sm: 'min-h-[32px] px-3.5 text-small',
  md: 'min-h-[40px] px-4 text-label',
  lg: 'min-h-[48px] px-8 text-label',
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  fullWidth?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', fullWidth = false, icon, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold tracking-button transition-[transform,filter,background-color] duration-base ease-standard active:scale-[.97] disabled:opacity-40 disabled:cursor-not-allowed ${
        fullWidth ? 'w-full' : ''
      } ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
