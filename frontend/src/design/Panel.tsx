import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from './cn';

interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  readonly heading?: ReactNode | undefined;
  readonly actions?: ReactNode | undefined;
  readonly bare?: boolean | undefined;
}

export function Panel({ heading, actions, bare = false, className, children, ...rest }: PanelProps) {
  return (
    <section
      className={cn(
        'flex min-h-0 flex-col',
        bare ? '' : 'rounded-[var(--radius-panel)] border border-ink-700 bg-ink-900',
        className,
      )}
      {...rest}
    >
      {heading === undefined && actions === undefined ? null : (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-700 px-3 py-2">
          <h3 className="text-xs font-semibold tracking-wide text-chalk-400 uppercase">{heading}</h3>
          {actions === undefined ? null : <div className="flex items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
    </section>
  );
}
