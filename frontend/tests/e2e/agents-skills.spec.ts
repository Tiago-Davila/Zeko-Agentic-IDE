import { expect, test } from './fixtures/localWorkspace';

const PROJECT_ID = '9f2504e0-4f89-41d3-9a0c-0305e82c3301';

test('mantiene las skills locales dentro del diseño y sin iniciar ejecuciones', async ({ page }) => {
  await page.route('**/api/session/bootstrap', async (route) => json(route, {}));
  await page.route('**/api/projects', async (route) => json(route, [
    { id: PROJECT_ID, name: 'Zeko skills', rootPath: '/tmp/zeko-skills', repositories: [{ id: 'aa000000-0000-4000-8000-000000000001', projectId: PROJECT_ID, path: '/tmp/zeko-repo', accessState: 'AVAILABLE' }] },
  ]));
  await page.route(`**/api/projects/${PROJECT_ID}/agent-templates`, async (route) => json(route, []));
  await page.route(`**/api/projects/${PROJECT_ID}/agent-instances`, async (route) => json(route, []));
  await page.route(`**/api/projects/${PROJECT_ID}/skills`, async (route) => json(route, []));

  await page.goto('/');
  await page.getByRole('combobox', { name: 'Abrir proyecto' }).selectOption(PROJECT_ID);
  await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();
  await expect(page.getByText(/no concede permisos/i)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Runtime Canvas' })).toBeVisible();
});

async function json(route: import('@playwright/test').Route, body: unknown): Promise<void> {
  const correlationId = route.request().headers()['x-correlation-id'] ?? '';
  await route.fulfill({ json: body, headers: { 'X-Correlation-Id': correlationId } });
}
