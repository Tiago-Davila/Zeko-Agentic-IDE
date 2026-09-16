import type { ButtonHTMLAttributes } from 'react';

import { cn } from './cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // Obligatorio: el contenido es un icono, así que el nombre accesible tiene que venir de acá.
  readonly label: string;
  readonly active?: boolean | undefined;
}

export function IconButton({ label, active = false, className, type, children, ...rest }: IconButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-[var(--radius-control)]',
        'transition-colors duration-150 disabled:cursor-not-allowed disabled:text-chalk-600',
        active
          ? 'bg-spray-lime/15 text-spray-lime'
          : 'text-chalk-400 hover:bg-ink-800 hover:text-chalk-50',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
