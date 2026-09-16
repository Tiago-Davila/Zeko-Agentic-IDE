import type { ReactNode } from 'react';

import { cn } from './cn';

interface EmptyStateProps {
  readonly title: string;
  readonly description?: string | undefined;
  readonly action?: ReactNode | undefined;
  readonly className?: string | undefined;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
      <p className="text-sm font-medium text-chalk-200">{title}</p>
      {description === undefined ? null : (
        <p className="max-w-prose text-xs text-chalk-400">{description}</p>
      )}
      {action === undefined ? null : <div className="mt-1">{action}</div>}
    </div>
  );
}
