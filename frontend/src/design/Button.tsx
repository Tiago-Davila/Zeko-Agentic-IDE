import type { ButtonHTMLAttributes } from 'react';

import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant | undefined;
  readonly size?: ButtonSize | undefined;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-spray-lime text-ink-950 font-semibold hover:bg-spray-lime/90 active:bg-spray-lime-dim disabled:bg-ink-700 disabled:text-chalk-600',
  secondary:
    'bg-ink-700 text-chalk-50 hover:bg-ink-600 disabled:bg-ink-800 disabled:text-chalk-600',
  ghost:
    'bg-transparent text-chalk-200 hover:bg-ink-800 hover:text-chalk-50 disabled:text-chalk-600 disabled:hover:bg-transparent',
  danger:
    'bg-state-failed/15 text-state-failed border border-state-failed/40 hover:bg-state-failed/25 disabled:opacity-50',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
};

export function Button({ variant = 'secondary', size = 'md', className, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius-control)]',
        'whitespace-nowrap transition-colors duration-150',
        'disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
}
