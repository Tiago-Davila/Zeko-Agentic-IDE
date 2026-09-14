import { expect, test } from './fixtures/localWorkspace';

test('keeps Runtime Canvas distinct from the agent design canvas', async ({ page }) => {
  await page.route('/api/runtime/snapshot', async (route) => route.fulfill({ json: [], headers: { 'X-Correlation-Id': route.request().headers()['x-correlation-id'] ?? '' } }));
  await page.goto('/');
  await page.getByRole('tab', { name: 'Runtime Canvas' }).click();
  await expect(page.getByRole('heading', { name: 'Runtime Canvas' })).toBeVisible();
});
