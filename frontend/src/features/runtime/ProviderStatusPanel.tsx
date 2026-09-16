import { Button } from '../../design/Button';
import { cn } from '../../design/cn';

export type ProviderState = 'available' | 'unavailable' | 'unknown';

export interface ProviderStatus {
  readonly provider: 'DOCKER' | 'OLLAMA';
  readonly state: ProviderState;
  readonly detail: string;
}

interface ProviderStatusPanelProps {
  readonly providers: readonly ProviderStatus[];
  readonly onRetry?: () => void;
}

const dots: Record<ProviderState, string> = {
  available: 'bg-state-completed',
  unavailable: 'bg-state-failed',
  unknown: 'bg-state-pending',
};

const words: Record<ProviderState, string> = {
  available: 'disponible',
  unavailable: 'no disponible',
  unknown: 'estado desconocido',
};

export function ProviderStatusPanel({ providers, onRetry }: ProviderStatusPanelProps) {
  return (
    <section
      aria-label="Proveedores locales"
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-ink-700 bg-ink-900/60 px-4 py-1.5"
    >
      <h3 className="sr-only">Proveedores locales</h3>
      <ul className="flex flex-wrap items-center gap-3">
        {providers.map((provider) => (
          <li key={provider.provider} className="flex items-center gap-1.5 text-[11px]">
            <span aria-hidden="true" className={cn('size-1.5 rounded-full', dots[provider.state])} />
            <strong className="font-medium text-chalk-200">{label(provider.provider)}</strong>
            <span className="text-chalk-400">: {words[provider.state]}</span>
            <span className="text-chalk-600">· {provider.detail}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-chalk-600">
        La reconexión de la interfaz no reanuda ejecuciones; el reintento siempre es manual.
      </p>
      {onRetry ? (
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onRetry}>
          Reintentar conexión local
        </Button>
      ) : null}
    </section>
  );
}

function label(provider: ProviderStatus['provider']): string {
  return provider === 'DOCKER' ? 'Docker' : 'Ollama';
}
