import { Tabs, type TabItem } from '../../design/Tabs';
import { cn } from '../../design/cn';
import { ZekoWordmark } from '../brand/ZekoWordmark';
import type { LocalConnectionState } from '../WorkspaceContext';

interface AppHeaderProps<T extends string> {
  readonly surfaces: readonly TabItem<T>[];
  readonly surface: T;
  readonly onSurfaceChange: (surface: T) => void;
  readonly project: string;
  readonly repository: string;
  readonly connection: LocalConnectionState;
}

const connectionStyles: Record<LocalConnectionState, string> = {
  connecting: 'border-state-waiting/50 bg-state-waiting/10 text-state-waiting',
  ready: 'border-state-completed/50 bg-state-completed/10 text-state-completed',
  error: 'border-state-failed/50 bg-state-failed/10 text-state-failed',
};

const connectionDots: Record<LocalConnectionState, string> = {
  connecting: 'bg-state-waiting animate-pulse',
  ready: 'bg-state-completed',
  error: 'bg-state-failed',
};

const connectionShort: Record<LocalConnectionState, string> = {
  connecting: 'Conectando',
  ready: 'Local',
  error: 'Sin backend',
};

export function AppHeader<T extends string>({
  surfaces,
  surface,
  onSurfaceChange,
  project,
  repository,
  connection,
}: AppHeaderProps<T>) {
  return (
    <header className="z-10 flex h-14 shrink-0 items-center gap-4 border-b border-ink-700 bg-ink-900 px-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <h1 className="flex shrink-0 items-center">
          <span className="sr-only">Zeko Agentic IDE</span>
          <ZekoWordmark />
        </h1>
        <span aria-hidden="true" className="h-6 w-px shrink-0 bg-ink-700" />
        <nav aria-label="Contexto del workspace" className="flex min-w-0 items-center gap-1.5 text-xs">
          <span className="truncate font-medium text-chalk-200">{project}</span>
          <span aria-hidden="true" className="text-chalk-600">
            /
          </span>
          <span className="truncate font-mono text-chalk-400">{repository}</span>
        </nav>
      </div>

      <Tabs
        items={surfaces}
        value={surface}
        onChange={onSurfaceChange}
        label="Superficies del workspace"
        idPrefix="surface"
        className="shrink-0"
      />

      <div className="flex flex-1 justify-end">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
            connectionStyles[connection],
          )}
        >
          <span aria-hidden="true" className={cn('size-1.5 rounded-full', connectionDots[connection])} />
          {connectionShort[connection]}
        </span>
      </div>
    </header>
  );
}
