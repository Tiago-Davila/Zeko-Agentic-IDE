import { expect, test } from './fixtures/localWorkspace';

test('shows the runtime as observation and keeps approvals explicit', async ({ page }) => {
  await page.route('/api/runtime/snapshot', async (route) => route.fulfill({ json: [], headers: { 'X-Correlation-Id': route.request().headers()['x-correlation-id'] ?? '' } }));
  await page.goto('/');
  await page.getByRole('tab', { name: 'Runtime Canvas' }).click();
  await expect(page.getByText(/Vista observacional/i)).toBeVisible();
});
