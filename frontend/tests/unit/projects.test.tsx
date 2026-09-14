import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceContextProvider } from '../../src/app/WorkspaceContext';
import { WorkspaceShell } from '../../src/app/WorkspaceShell';

const { project, repository, projectApi } = vi.hoisted(() => {
  const mockedProject = {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    name: 'Zeko',
    rootPath: '/workspace/zeko',
    repositories: [],
  };
  const mockedRepository = {
    id: '9f3b4e10-4f89-41d3-9a0c-0305e82c3301',
    projectId: mockedProject.id,
    path: '/workspace/zeko/backend',
    accessState: 'AVAILABLE' as const,
  };

  return {
    project: mockedProject,
    repository: mockedRepository,
    projectApi: {
      listProjects: vi.fn().mockResolvedValue([mockedProject]),
      createProject: vi.fn().mockResolvedValue(mockedProject),
      addRepository: vi.fn().mockResolvedValue(mockedRepository),
    },
  };
});

vi.mock('../../src/features/projects/projectApi', () => ({
  ...projectApi,
}));

afterEach(() => {
  cleanup();
});

describe('project workspace', () => {
  it('opens a project and keeps its selection in the workspace context', async () => {
    renderShell();

    const select = await screen.findByRole('combobox', { name: 'Abrir proyecto' });
    fireEvent.change(select, { target: { value: project.id } });

    await waitFor(() => expect(screen.getByLabelText('Estado del workspace').textContent).toContain('Zeko'));
  });

  it('associates repositories and keeps the active project visible', async () => {
    renderShell();
    const select = await screen.findByRole('combobox', { name: 'Abrir proyecto' });
    fireEvent.change(select, { target: { value: project.id } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Ruta del repositorio' }), {
      target: { value: repository.path },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Asociar repositorio' }));

    await screen.findByRole('button', { name: repository.path });
    expect(screen.getByLabelText('Estado del workspace').textContent).toContain(repository.path);
  });
});

function renderShell() {
  return render(
    <WorkspaceContextProvider>
      <WorkspaceShell />
    </WorkspaceContextProvider>,
  );
}
