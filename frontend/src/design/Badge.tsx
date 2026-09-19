import type { HTMLAttributes } from 'react';

import { cn } from './cn';

export type BadgeTone = 'neutral' | 'accent' | 'info' | 'warn' | 'danger' | 'muted';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: BadgeTone | undefined;
  readonly mono?: boolean | undefined;
}

const tones: Record<BadgeTone, string> = {
  neutral: 'border-ink-600 bg-ink-800 text-chalk-200',
  accent: 'border-spray-lime/40 bg-spray-lime/10 text-spray-lime',
  info: 'border-spray-cyan/40 bg-spray-cyan/10 text-spray-cyan',
  warn: 'border-state-waiting/40 bg-state-waiting/10 text-state-waiting',
  danger: 'border-state-failed/40 bg-state-failed/10 text-state-failed',
  muted: 'border-ink-700 bg-ink-850 text-chalk-600',
};

export function Badge({ tone = 'neutral', mono = false, className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4',
        mono ? 'font-mono' : '',
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}
