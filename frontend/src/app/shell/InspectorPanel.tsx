import type { ReactNode } from 'react';

import { cn } from '../../design/cn';

interface InspectorPanelProps {
  readonly label: string;
  readonly heading: string;
  readonly subheading?: string | undefined;
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

/*
 * Contenedor del panel derecho. Es presentacion pura: cada superficie arma su propio
 * contenido, porque lo que hay para inspeccionar depende de lo que esa superficie
 * seleccione.
 */
export function InspectorPanel({ label, heading, subheading, children, className }: InspectorPanelProps) {
  return (
    <aside
      aria-label={label}
      className={cn('flex w-[340px] shrink-0 flex-col border-l border-ink-700 bg-ink-900', className)}
    >
      <header className="shrink-0 border-b border-ink-700 px-3 py-2">
        <h3 className="text-xs font-semibold tracking-wide text-chalk-400 uppercase">{heading}</h3>
        {subheading === undefined ? null : (
          <p className="mt-0.5 truncate text-[11px] text-chalk-600">{subheading}</p>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">{children}</div>
    </aside>
  );
}
