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

  it('no monta pantallas de negocio en el arranque minimo', () => {
    render(<App />);

    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('form')).toHaveLength(0);
  });
});
