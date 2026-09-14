import { expect, test } from './fixtures/localWorkspace';
test('keeps agents and skills local without starting execution from canvas edges', async ({ page }) => {
  await page.route('/api/session/bootstrap', async (route) => route.fulfill({ json: {}, headers: { 'X-Correlation-Id': route.request().headers()['x-correlation-id'] ?? '' } }));
  await page.route('/api/projects', async (route) => route.fulfill({ json: [], headers: { 'X-Correlation-Id': route.request().headers()['x-correlation-id'] ?? '' } }));
  await page.goto('/');
  await expect(page.getByText(/skills locales/i)).toBeVisible();
  await expect(page.getByText(/no concede permisos/i)).toBeVisible();
});
