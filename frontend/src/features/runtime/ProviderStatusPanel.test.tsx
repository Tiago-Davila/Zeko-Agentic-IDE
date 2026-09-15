import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProviderStatusPanel } from './ProviderStatusPanel';

describe('ProviderStatusPanel', () => {
  afterEach(cleanup);
  it('shows the affected provider without reporting false success', () => {
    render(<ProviderStatusPanel providers={[{ provider: 'OLLAMA', state: 'unavailable', detail: 'Sin conexión local' }]} />);
    expect(screen.getByText(/Ollama/)).not.toBeNull();
    expect(screen.getByText(/no disponible/)).not.toBeNull();
    expect(screen.getByText(/no reanuda ejecuciones/)).not.toBeNull();
  });
});
