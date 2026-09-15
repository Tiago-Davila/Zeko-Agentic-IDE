import type { Route } from '@playwright/test';
import { expect, test } from './fixtures/localWorkspace';

const project = {
  id: 'project-a',
  name: 'Proyecto A',
  rootPath: 'C:/workspace/project-a',
  repositories: [],
};
const otherProject = {
  id: 'project-b',
  name: 'Proyecto B',
  rootPath: 'C:/workspace/project-b',
  repositories: [],
};
const conversationId = 'conversation-a';
const syntheticSecret = 'synthetic-secret-that-must-not-appear';

test('keeps memory results local and scoped to the active conversation', async ({ page }) => {
  const memoryRequests: { projectId: string; conversationId: string; query: string }[] = [];

  await page.route('http://127.0.0.1:5173/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/api/session/bootstrap') {
      await fulfill(route, {});
      return;
    }
    if (url.pathname === '/api/projects' && request.method() === 'GET') {
      await fulfill(route, [project, otherProject]);
      return;
    }
    if (url.pathname === `/api/projects/${project.id}/conversations`) {
      await fulfill(route, {
        id: conversationId,
        projectId: project.id,
        recipientType: 'PM',
        recipientId: project.id,
      });
      return;
    }
    if (url.pathname === `/api/projects/${project.id}/memory/search`) {
      memoryRequests.push({
        projectId: project.id,
        conversationId: url.searchParams.get('conversationId') ?? '',
        query: url.searchParams.get('query') ?? '',
      });
      await fulfill(route, {
        results: [
          {
            sourceId: 'global-source',
            level: 'GLOBAL',
            ownerId: 'global',
            source: 'global-context.md',
            indexState: 'CURRENT',
            excerpt: 'Contexto permitido para esta conversación.',
          },
          {
            sourceId: 'conversation-source',
            level: 'CONVERSATION',
            ownerId: conversationId,
            source: 'conversation-context.md',
            indexState: 'STALE',
            excerpt: '',
          },
        ],
      });
      return;
    }
    await fulfill(route, { code: 'not_found', message: 'Ruta local desconocida' }, 404);
  });

  await page.goto('/');
  await page.getByLabel('Abrir proyecto').selectOption(project.id);
  await page.getByRole('button', { name: 'Abrir conversación con PM' }).click();
  await expect(page.getByRole('status')).toHaveText('Conversación activa con PM.');

  await page.getByLabel('Consulta de contexto').fill('contexto');
  await page.getByRole('button', { name: 'Buscar' }).click();

  await expect(page.getByLabel('Resultados de contexto')).toContainText('global-context.md');
  await expect(page.getByLabel('Resultados de contexto')).toContainText('conversation-context.md');
  await expect(page.locator('body')).not.toContainText(syntheticSecret);
  expect(memoryRequests).toEqual([
    { projectId: project.id, conversationId, query: 'contexto' },
  ]);
});

async function fulfill(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'X-Correlation-Id': route.request().headers()['x-correlation-id'] },
    body: JSON.stringify(body),
  });
}
