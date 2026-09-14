import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkspaceContextProvider } from '../../src/app/WorkspaceContext';
import { WorkspaceShell } from '../../src/app/WorkspaceShell';

afterEach(() => {
  cleanup();
});

describe('WorkspaceShell', () => {
  it('keeps Agents Canvas and Runtime Canvas as separate accessible surfaces', () => {
    renderShell();

    expect(screen.getByRole('tab', { name: 'Agents Canvas' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'Agents Canvas' })).not.toBeNull();
    expect(screen.queryByRole('tabpanel', { name: 'Runtime Canvas' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Runtime Canvas' }));

    expect(screen.getByRole('tab', { name: 'Runtime Canvas' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'Runtime Canvas' })).not.toBeNull();
  });

  it('keeps current workspace context and connection state visible', () => {
    renderShell();

    const status = screen.getByRole('complementary', { name: 'Estado del workspace' });
    expect(status.textContent).toContain('Sin proyecto local seleccionado');
    expect(status.textContent).toContain('Sin repositorio seleccionado');
    expect(status.textContent).toContain('Sin tarea activa');
    expect(status.textContent).toContain('Sin agente activo');
    expect(status.textContent).toContain('Conectando al backend local');
  });

  it('does not introduce an architecture canvas', () => {
    renderShell();

    expect(screen.queryByText(/architecture canvas/i)).toBeNull();
  });
});

function renderShell() {
  return render(
    <WorkspaceContextProvider>
      <WorkspaceShell />
    </WorkspaceContextProvider>,
  );
}
