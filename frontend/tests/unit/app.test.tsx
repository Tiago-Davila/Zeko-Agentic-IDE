import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../../src/app/App';

afterEach(() => {
  cleanup();
});

describe('App', () => {
  it('renderiza el arranque local de la aplicacion', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Zeko Agentic IDE' })).not.toBeNull();
  });

  it('monta las superficies iniciales del workspace', () => {
    render(<App />);

    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('complementary', { name: 'Estado del workspace' })).not.toBeNull();
  });
});
