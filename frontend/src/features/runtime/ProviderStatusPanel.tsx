export type ProviderState = 'available' | 'unavailable' | 'unknown';

export interface ProviderStatus {
  readonly provider: 'DOCKER' | 'OLLAMA';
  readonly state: ProviderState;
  readonly detail: string;
}

export function ProviderStatusPanel({ providers }: { readonly providers: readonly ProviderStatus[] }) {
  return (
    <section aria-label="Proveedores locales">
      <h3>Proveedores locales</h3>
      <ul>
        {providers.map((provider) => (
          <li key={provider.provider}>
            <strong>{label(provider.provider)}</strong>: {stateLabel(provider.state)} · {provider.detail}
          </li>
        ))}
      </ul>
      <p>La reconexión de la interfaz no reanuda ejecuciones; el reintento siempre es manual.</p>
    </section>
  );
}

function label(provider: ProviderStatus['provider']): string {
  return provider === 'DOCKER' ? 'Docker' : 'Ollama';
}

function stateLabel(state: ProviderState): string {
  if (state === 'available') {
    return 'disponible';
  }
  return state === 'unavailable' ? 'no disponible' : 'estado desconocido';
}
