import type { HTMLAttributes } from 'react';

import { cn } from './cn';
import { toneOf, type StateTone } from './stateTone';

interface StatePillProps extends HTMLAttributes<HTMLSpanElement> {
  // Valor crudo del enum del backend. Se muestra tal cual salvo que llegue `label`.
  readonly state: string;
  readonly label?: string | undefined;
  readonly dense?: boolean | undefined;
}

const toneStyles: Record<StateTone, string> = {
  pending: 'border-state-pending/40 bg-state-pending/10 text-state-pending',
  running: 'border-state-running/50 bg-state-running/10 text-state-running',
  waiting: 'border-state-waiting/50 bg-state-waiting/10 text-state-waiting',
  completed: 'border-state-completed/50 bg-state-completed/10 text-state-completed',
  failed: 'border-state-failed/50 bg-state-failed/10 text-state-failed',
  cancelled: 'border-state-cancelled/40 bg-state-cancelled/10 text-state-cancelled',
  blocked: 'border-state-blocked/50 bg-state-blocked/10 text-state-blocked',
};

const dotStyles: Record<StateTone, string> = {
  pending: 'bg-state-pending',
  running: 'bg-state-running animate-pulse',
  waiting: 'bg-state-waiting',
  completed: 'bg-state-completed',
  failed: 'bg-state-failed',
  cancelled: 'bg-state-cancelled',
  blocked: 'bg-state-blocked',
};

export function StatePill({ state, label, dense = false, className, ...rest }: StatePillProps) {
  const tone = toneOf(state);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        dense ? 'px-1.5 py-0 text-[10px] leading-4' : 'px-2 py-0.5 text-[11px] leading-4',
        toneStyles[tone],
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', dotStyles[tone])} />
      {label ?? state}
    </span>
  );
}
