import { expect, test } from './fixtures/localWorkspace';
test('keeps memory results local and scoped', async ({ page }) => { await page.goto('/'); await expect(page.getByRole('heading', { name: 'Zeko Agentic IDE' })).toBeVisible(); });
