'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

const VARIANTS = {
  primary: 'bg-brand text-on-brand hover:bg-brand-hover',
  dark: 'bg-neutral text-text hover:bg-neutral-hover',
  outlined: 'bg-transparent text-text shadow-[inset_0_0_0_1px_theme(colors.border.bold)] hover:bg-hover',
  ghost: 'bg-transparent text-text-subtle hover:bg-hover hover:text-text',
  danger: 'bg-danger-subtle text-danger shadow-[inset_0_0_0_1px_theme(colors.danger.DEFAULT)] hover:brightness-110',
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
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold tracking-button transition-[transform,filter,background-color,color] duration-fast ease-standard active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-40 disabled:cursor-not-allowed ${
        fullWidth ? 'w-full' : ''
      } ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
