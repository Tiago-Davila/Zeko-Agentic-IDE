import { cn } from './cn';

export const inputStyles = cn(
  'h-9 w-full rounded-[var(--radius-control)] border border-ink-700 bg-ink-950 px-2.5',
  'text-sm text-chalk-50 placeholder:text-chalk-600',
  'transition-colors duration-150 hover:border-ink-600',
  'focus:border-spray-lime focus:outline-none',
  'disabled:cursor-not-allowed disabled:bg-ink-900 disabled:text-chalk-600',
);
