import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { project, projectApi } = vi.hoisted(() => {
  const mockedProject = {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    name: 'Zeko',
    rootPath: '/workspace/zeko',
    repositories: [
      {
        id: '9f3b4e10-4f89-41d3-9a0c-0305e82c3301',
        projectId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
        path: '/workspace/zeko/backend',
        accessState: 'AVAILABLE' as const,
      },
    ],
  };

  return {
    project: mockedProject,
    projectApi: {
      listProjects: vi.fn().mockResolvedValue([mockedProject]),
      createProject: vi.fn(),
      addRepository: vi.fn(),
    },
  };
});

vi.mock('../../src/features/projects/projectApi', () => ({ ...projectApi }));

import { App } from '../../src/app/App';

afterEach(() => {
  cleanup();
});

describe('App', () => {
  it('renderiza el arranque local de la aplicacion', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Zeko Agentic IDE' })).not.toBeNull();
  });

  it('monta las superficies iniciales del workspace', async () => {
    render(<App />);

    // Solo se entra al workspace con un proyecto que ya tiene un repositorio configurado.
    const select = await screen.findByRole('combobox', { name: 'Abrir proyecto' });
    fireEvent.change(select, { target: { value: project.id } });

    // Se cuentan las tabs de superficie, no todas las del documento: el panel inferior
    // aporta su propio tablist y contarlas juntas ocultaría cuál de los dos cambió.
    const surfaces = await screen.findByRole('tablist', { name: 'Superficies del workspace' });
    await waitFor(() => expect(within(surfaces).getAllByRole('tab')).toHaveLength(3));
    expect(screen.getByRole('complementary', { name: 'Estado del workspace' })).not.toBeNull();
  });
});
