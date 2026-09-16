import { Handle, Position } from '@xyflow/react';
import type { ReactNode } from 'react';

import { cn } from '../../../design/cn';
import { toneOf } from '../../../design/stateTone';

export type NodeAccent = 'lime' | 'cyan' | 'violet' | 'magenta' | 'slate';

interface NodeShellProps {
  // Etiqueta corta del tipo, arriba del titulo.
  readonly kind: string;
  readonly accent: NodeAccent;
  readonly icon: ReactNode;
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly badges?: ReactNode | undefined;
  // Valor crudo del enum de estado, si el nodo tiene uno.
  readonly state?: string | undefined;
  readonly selected?: boolean | undefined;
  readonly hasTarget?: boolean | undefined;
  readonly hasSource?: boolean | undefined;
  readonly role?: string | undefined;
  readonly ariaLabel?: string | undefined;
}

const accentTile: Record<NodeAccent, string> = {
  lime: 'bg-spray-lime/15 text-spray-lime border-spray-lime/30',
  cyan: 'bg-spray-cyan/15 text-spray-cyan border-spray-cyan/30',
  violet: 'bg-spray-violet/15 text-spray-violet border-spray-violet/30',
  magenta: 'bg-spray-magenta/15 text-spray-magenta border-spray-magenta/30',
  slate: 'bg-ink-700 text-chalk-400 border-ink-600',
};

const ledStyles = {
  pending: 'bg-state-pending',
  running: 'bg-state-running animate-pulse',
  waiting: 'bg-state-waiting',
  completed: 'bg-state-completed',
  failed: 'bg-state-failed',
  cancelled: 'bg-state-cancelled',
  blocked: 'bg-state-blocked',
} as const;

const handleStyles = '!size-2 !rounded-full !border-2 !border-ink-900 !bg-ink-500';

export function NodeShell({
  kind,
  accent,
  icon,
  title,
  subtitle,
  badges,
  state,
  selected = false,
  hasTarget = false,
  hasSource = false,
  role,
  ariaLabel,
}: NodeShellProps) {
  return (
    <div
      {...(role === undefined ? {} : { role })}
      {...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel })}
      className={cn(
        'relative flex w-[248px] items-stretch overflow-hidden rounded-[var(--radius-node)]',
        'border bg-ink-800 shadow-[var(--shadow-node)] transition-colors duration-150',
        selected ? 'border-spray-lime ring-2 ring-spray-lime/30' : 'border-ink-700 hover:border-ink-600',
      )}
    >
      {hasTarget ? <Handle type="target" position={Position.Left} className={handleStyles} /> : null}

      <div className={cn('flex w-11 shrink-0 items-center justify-center border-r', accentTile[accent])}>
        {icon}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-2.5 py-2">
        <span className="text-[10px] font-semibold tracking-wider text-chalk-600 uppercase">{kind}</span>
        <span className="truncate text-[13px] leading-tight font-medium text-chalk-50" title={title}>
          {title}
        </span>
        {subtitle === undefined ? null : (
          <span className="truncate font-mono text-[10px] text-chalk-400" title={subtitle}>
            {subtitle}
          </span>
        )}
        {badges === undefined ? null : <div className="mt-1 flex flex-wrap items-center gap-1">{badges}</div>}
      </div>

      {state === undefined ? null : (
        <span
          aria-hidden="true"
          className={cn('absolute top-2 right-2 size-2 rounded-full', ledStyles[toneOf(state)])}
        />
      )}

      {hasSource ? <Handle type="source" position={Position.Right} className={handleStyles} /> : null}
    </div>
  );
}
