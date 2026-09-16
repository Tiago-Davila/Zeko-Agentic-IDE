import type { Route } from '@playwright/test';

import { expect, test } from './fixtures/localWorkspace';

const PROJECT_A = '1f2504e0-4f89-41d3-9a0c-0305e82c3301';
const PROJECT_B = '2f2504e0-4f89-41d3-9a0c-0305e82c3301';

test('mantiene la memoria local aislada por proyecto y excluye secretos', async ({ page }) => {
  await page.route('**/api/session/bootstrap', async (route) => json(route, {}));
  await page.route('**/api/projects', async (route) => json(route, [
    { id: PROJECT_A, name: 'Proyecto A', rootPath: '/tmp/proyecto-a', repositories: [] },
    { id: PROJECT_B, name: 'Proyecto B', rootPath: '/tmp/proyecto-b', repositories: [] },
  ]));

  await mockProjectDependencies(page, PROJECT_A);
  await mockProjectDependencies(page, PROJECT_B);
  await page.route(`**/api/projects/${PROJECT_A}/memory/search**`, async (route) => {
    const query = new URL(route.request().url()).searchParams.get('query');
    await json(route, query === 'secreto'
      ? { results: [] }
      : { results: [{ sourceId: 'source-a', level: 'PROJECT', excerpt: 'Arquitectura del proyecto A' }] });
  });
  await page.route(`**/api/projects/${PROJECT_B}/memory/search**`, async (route) => json(route, {
    results: [{ sourceId: 'source-b', level: 'PROJECT', excerpt: 'Arquitectura del proyecto B' }],
  }));

  await page.goto('/');
  await page.getByRole('combobox', { name: 'Abrir proyecto' }).selectOption(PROJECT_A);
  // La búsqueda de contexto vive en la pestaña Librería del panel inferior.
  await page.getByRole('tab', { name: 'Librería' }).click();
  await page.getByRole('textbox', { name: 'Buscar contexto' }).fill('arquitectura');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByText('fuente source-a: Arquitectura del proyecto A')).toBeVisible();
  await expect(page.getByText(/source-b/)).toHaveCount(0);

  await page.getByRole('textbox', { name: 'Buscar contexto' }).fill('secreto');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByText('No hay contexto local para esta búsqueda.')).toBeVisible();
  await expect(page.getByText(/secret/i)).toHaveCount(0);

  await page.getByRole('combobox', { name: 'Abrir proyecto' }).selectOption(PROJECT_B);
  await page.getByRole('textbox', { name: 'Buscar contexto' }).fill('arquitectura');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByText('fuente source-b: Arquitectura del proyecto B')).toBeVisible();
  await expect(page.getByText(/source-a/)).toHaveCount(0);
});

async function mockProjectDependencies(page: import('@playwright/test').Page, projectId: string): Promise<void> {
  await page.route(`**/api/projects/${projectId}/agent-templates`, async (route) => json(route, []));
  await page.route(`**/api/projects/${projectId}/agent-instances`, async (route) => json(route, []));
  await page.route(`**/api/projects/${projectId}/skills`, async (route) => json(route, []));
}

async function json(route: Route, body: unknown): Promise<void> {
  const correlationId = route.request().headers()['x-correlation-id'] ?? '';
  await route.fulfill({ json: body, headers: { 'X-Correlation-Id': correlationId } });
}
