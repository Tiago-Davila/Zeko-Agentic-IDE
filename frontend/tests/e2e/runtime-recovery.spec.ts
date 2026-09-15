import type { Route } from '@playwright/test';
import { expect, test } from './fixtures/localWorkspace';

const project = {
  id: 'project-a',
  name: 'Proyecto A',
  rootPath: 'C:/workspace/project-a',
  repositories: [],
};

test('keeps canvases separate and recovers runtime state without repeating an execution', async ({ page }) => {
  let snapshots = 0;
  const snapshotMethods: string[] = [];

  await page.route('http://127.0.0.1:5173/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/api/session/bootstrap') {
      await fulfill(route, {});
      return;
    }
    if (url.pathname === '/api/projects' && request.method() === 'GET') {
      await fulfill(route, [project]);
      return;
    }
    if (url.pathname === `/api/projects/${project.id}/runtime-snapshot`) {
      snapshots += 1;
      snapshotMethods.push(request.method());
      if (snapshots === 3) {
        await fulfill(route, { code: 'provider-unavailable', message: 'Ollama no disponible' }, 503);
        return;
      }
      await fulfill(route, snapshots <= 2 ? unavailableSnapshot() : recoveredSnapshot());
      return;
    }
    await fulfill(route, { code: 'not_found', message: 'Ruta local desconocida' }, 404);
  });

  await page.goto('/');
  await page.getByLabel('Abrir proyecto').selectOption(project.id);
  await page.getByRole('tab', { name: 'Runtime Canvas' }).click();

  const providers = page.getByLabel('Proveedores locales');
  await expect(providers).toContainText('Ollama: no disponible');
  await expect(page.getByRole('button', { name: 'Reintentar manualmente' })).toBeVisible();

  await page.getByRole('button', { name: 'Recargar estado' }).click();
  await expect(page.getByText('No se pudo recuperar el estado local. Se conserva el último snapshot confirmado.')).toBeVisible();
  await expect(providers).toContainText('Ollama: no disponible');

  await page.getByRole('button', { name: 'Recargar estado' }).click();
  await expect(providers).toContainText('Ollama: estado desconocido');

  await page.getByRole('tab', { name: 'Agents Canvas' }).click();
  await expect(page.getByRole('heading', { name: 'Agents Canvas', exact: true })).toBeVisible();
  await expect(page.getByLabel('Proveedores locales')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Runtime Canvas' }).click();
  await expect(page.getByRole('heading', { name: 'Runtime Canvas', exact: true })).toBeVisible();
  await expect(providers).toContainText('Ollama: estado desconocido');
  expect(snapshotMethods).toHaveLength(6);
  expect(snapshotMethods.every((method) => method === 'GET')).toBe(true);
});

function unavailableSnapshot() {
  return {
    projectId: project.id,
    tasks: [],
    executions: [{
      id: 'execution-a',
      taskId: 'task-a',
      attempt: 1,
      state: 'FAILED',
      knownState: 'UNAVAILABLE',
      templateId: 'template-a',
      templateVersion: 1,
      retryOfExecutionId: null,
      provider: 'OLLAMA',
      cancellationRequested: false,
      effects: [],
    }],
  };
}

function recoveredSnapshot() {
  return { projectId: project.id, tasks: [], executions: [] };
}

async function fulfill(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'X-Correlation-Id': route.request().headers()['x-correlation-id'] },
    body: JSON.stringify(body),
  });
}
