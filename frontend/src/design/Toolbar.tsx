import type { HTMLAttributes } from 'react';

import { cn } from './cn';

interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  readonly label: string;
  readonly floating?: boolean | undefined;
}

export function Toolbar({ label, floating = false, className, children, ...rest }: ToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      className={cn(
        'flex items-center gap-1 rounded-[var(--radius-control)] border border-ink-700 bg-ink-900/90 p-1',
        floating ? 'shadow-[var(--shadow-panel)] backdrop-blur-sm' : '',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function ToolbarSeparator() {
  return <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-ink-700" />;
}
