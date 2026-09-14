export type ProviderState = 'available' | 'unavailable' | 'unknown';

export interface ProviderStatus {
  readonly provider: 'Docker' | 'Ollama';
  readonly state: ProviderState;
  readonly detail: string;
}

export function ProviderStatusPanel({ providers }: { readonly providers: readonly ProviderStatus[] }) {
  return <section aria-label="Proveedores locales"><h3>Proveedores locales</h3><ul>{providers.map((provider) => <li key={provider.provider}><strong>{provider.provider}</strong>: {provider.state === 'available' ? 'disponible' : provider.state === 'unavailable' ? 'no disponible' : 'estado desconocido'} · {provider.detail}</li>)}</ul><p>La reconexión de la interfaz no reanuda ejecuciones; el reintento siempre es manual.</p></section>;
}
