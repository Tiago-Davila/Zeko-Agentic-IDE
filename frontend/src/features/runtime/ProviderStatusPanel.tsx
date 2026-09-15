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

export function ProviderStatusPanel({ providers, onRetry }: ProviderStatusPanelProps) {
  return <section aria-label="Proveedores locales"><h3>Proveedores locales</h3><ul>{providers.map((provider) => <li key={provider.provider}><strong>{label(provider.provider)}</strong>: {provider.state === 'available' ? 'disponible' : provider.state === 'unavailable' ? 'no disponible' : 'estado desconocido'} · {provider.detail}</li>)}</ul><p>La reconexión de la interfaz no reanuda ejecuciones; el reintento siempre es manual.</p>{onRetry ? <button type="button" onClick={onRetry}>Reintentar conexión local</button> : null}</section>;
}

function label(provider: ProviderStatus['provider']): string {
  return provider === 'DOCKER' ? 'Docker' : 'Ollama';
}
