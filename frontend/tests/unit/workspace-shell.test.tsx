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
    expect(status.textContent).toContain('Sin proyecto');
    expect(status.textContent).toContain('Sin repositorio');
    expect(status.textContent).toContain('Sin tarea');
    expect(status.textContent).toContain('Sin agente');
    expect(status.textContent).toContain('Conectando');
  });

  /*
   * Esta prueba afirmaba que no existía un canvas de arquitectura, porque AGENTS.md lo
   * excluye del MVP. El usuario autorizó explícitamente incorporarlo en la conversación de
   * diseño UI/UX (override `UX-ARCH-20260915`), y su instrucción tiene precedencia 1 sobre
   * las reglas del proyecto según AGENTS.md §2.
   *
   * La aserción se invierte de frente en vez de esquivarla nombrando la superficie en
   * español para que el regex no coincida: eso habría escondido un cambio de alcance detrás
   * de un rename. Lo que sí se mantiene es el límite real: la superficie es presentación,
   * no persiste diagramas ni genera código.
   */
  it('mounts the architecture surface as a third separate canvas', () => {
    renderShell();

    expect(screen.getByRole('tab', { name: 'Arquitectura' })).not.toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Arquitectura' }));

    expect(screen.getByRole('tabpanel', { name: 'Arquitectura' })).not.toBeNull();
    expect(screen.queryByRole('tabpanel', { name: 'Agents Canvas' })).toBeNull();
    expect(screen.queryByRole('tabpanel', { name: 'Runtime Canvas' })).toBeNull();
  });
});

function renderShell() {
  return render(
    <WorkspaceContextProvider>
      <WorkspaceShell />
    </WorkspaceContextProvider>,
  );
}
