import type { Route } from '@playwright/test';

import { expect, test } from './fixtures/localWorkspace';

interface RepositoryResponse {
  readonly id: string;
  readonly projectId: string;
  readonly path: string;
  readonly accessState: string;
}

interface ProjectResponse {
  readonly id: string;
  readonly name: string;
  readonly rootPath: string;
  repositories: RepositoryResponse[];
}

test('crea, reabre y conserva dos repositorios locales', async ({ page, localWorkspace }) => {
  const project: ProjectResponse = {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    name: 'Zeko',
    rootPath: localWorkspace.root,
    repositories: [],
  };
  const repositories: RepositoryResponse[] = [];

  await page.route('/api/session/bootstrap', async (route) => {
    await route.fulfill({ json: { expiresAt: '2026-09-14T12:00:00Z', loopbackOnly: true }, headers: correlation(route) });
  });
  await page.route('/api/projects', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: [project], headers: correlation(route) });
      return;
    }
    await route.fulfill({ status: 201, json: project, headers: correlation(route) });
  });
  await page.route(`/api/projects/${project.id}/repositories`, async (route) => {
    const body = route.request().postDataJSON() as { path: string };
    const repository = {
      id: `${repositories.length + 1}f2504e0-4f89-41d3-9a0c-0305e82c3301`,
      projectId: project.id,
      path: body.path,
      accessState: 'AVAILABLE',
    };
    repositories.push(repository);
    project.repositories = repositories;
    await route.fulfill({ status: 201, json: repository, headers: correlation(route) });
  });

  await page.goto('/');
  await page.getByRole('combobox', { name: 'Abrir proyecto' }).selectOption(project.id);
  for (const repository of localWorkspace.repositories) {
    await page.getByRole('textbox', { name: 'Ruta del repositorio' }).fill(repository.path);
    await page.getByRole('button', { name: 'Asociar repositorio' }).click();
  }

  await expect(page.getByRole('button', { name: localWorkspace.repositories[0]?.path ?? '' })).toBeVisible();
  await expect(page.getByRole('button', { name: localWorkspace.repositories[1]?.path ?? '' })).toBeVisible();
  await page.reload();
  await page.getByRole('combobox', { name: 'Abrir proyecto' }).selectOption(project.id);
  await expect(page.getByRole('button', { name: localWorkspace.repositories[0]?.path ?? '' })).toBeVisible();
});

test('reports an inaccessible repository path without changing the selected project', async ({ page, localWorkspace }) => {
  const project: ProjectResponse = {
    id: '4f2504e0-4f89-41d3-9a0c-0305e82c3301',
    name: 'Zeko',
    rootPath: localWorkspace.root,
    repositories: [],
  };

  await page.route('/api/session/bootstrap', async (route) => {
    await route.fulfill({ json: { expiresAt: '2026-09-14T12:00:00Z', loopbackOnly: true }, headers: correlation(route) });
  });
  await page.route('/api/projects', async (route) => {
    await route.fulfill({ json: [project], headers: correlation(route) });
  });
  await page.route(`/api/projects/${project.id}/repositories`, async (route) => {
    await route.fulfill({
      status: 422,
      json: { code: 'path-invalid', message: 'Ruta inaccesible', correlationId: route.request().headers()['x-correlation-id'] },
      headers: correlation(route),
    });
  });

  await page.goto('/');
  await page.getByRole('combobox', { name: 'Abrir proyecto' }).selectOption(project.id);
  await page.getByRole('textbox', { name: 'Ruta del repositorio' }).fill('/ruta-inaccesible');
  await page.getByRole('button', { name: 'Asociar repositorio' }).click();

  await expect(page.getByRole('alert')).toHaveText('Ruta inaccesible');
  await expect(page.getByLabel('Estado del workspace')).toContainText('Zeko');
});

function correlation(route: Route): Record<string, string> {
  const correlationId = route.request().headers()['x-correlation-id'];
  return correlationId === undefined ? {} : { 'X-Correlation-Id': correlationId };
}
