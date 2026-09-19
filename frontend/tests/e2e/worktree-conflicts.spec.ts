import type { Page, Route } from '@playwright/test';

import { expect, test } from './fixtures/localWorkspace';

const PROJECT_ID = '4f2504e0-4f89-41d3-9a0c-0305e82c3301';
const FIRST_TASK_ID = '1d8c5678-1234-4a5b-9cde-123456789abc';
const BLOCKED_TASK_ID = '2d8c5678-1234-4a5b-9cde-123456789abc';
const EXECUTION_ID = '3d8c5678-1234-4a5b-9cde-123456789abc';

test('reproduce un conflicto de worktree y registra una recuperación manual', async ({ page, localWorkspace }) => {
  let resolution: { resolution: string; note: string } | undefined;
  const sharedWorktree = `${localWorkspace.repository('repo-a').path}/.zeko-worktrees/shared`;
  await installRoutes(page, sharedWorktree, (value) => { resolution = value; });

  await page.goto('/');
  await page.getByRole('combobox', { name: 'Abrir proyecto' }).selectOption(PROJECT_ID);
  await page.getByRole('tab', { name: 'Runtime Canvas' }).click();

  await expect(page.getByRole('article', { name: 'Ejecución 1' }))
    .toContainText('Estado: RUNNING');
  await expect(page.getByText('Writer B · BLOCKED')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Conflicto bloqueante' })).toBeVisible();
  await expect(page.getByText(sharedWorktree)).toBeVisible();

  await page.getByLabel('Nota manual').fill('Cambios de Writer A preservados');
  await page.getByRole('button', { name: 'Registrar resolución manual' }).click();

  await expect(page.getByRole('status')).toContainText('Resolución registrada localmente.');
  await expect(page.getByRole('heading', { name: 'Conflicto bloqueante' })).toHaveCount(0);
  expect(resolution).toEqual({
    resolution: 'RESOLVED_MANUALLY',
    note: 'Cambios de Writer A preservados',
  });
});

async function installRoutes(
  page: Page,
  sharedWorktree: string,
  onResolution: (value: { resolution: string; note: string }) => void,
): Promise<void> {
  await page.routeWebSocket('/api/ws/events', (socket) => {
    socket.onMessage(() => undefined);
  });
  await page.route('**/api/session/bootstrap', async (route) => json(route, {}));
  await page.route('**/api/projects', async (route) => json(route, [project()]));
  await page.route(`**/api/projects/${PROJECT_ID}/agent-templates`, async (route) => json(route, []));
  await page.route(`**/api/projects/${PROJECT_ID}/agent-instances`, async (route) => json(route, []));
  await page.route(`**/api/projects/${PROJECT_ID}/skills`, async (route) => json(route, []));
  await page.route(`**/api/projects/${PROJECT_ID}/runtime-snapshot`, async (route) => json(route, {
    projectId: PROJECT_ID,
    executions: [execution()],
    tasks: [
      { id: FIRST_TASK_ID, repositoryId: 'repo-a', state: 'RUNNING', title: 'Writer A' },
      { id: BLOCKED_TASK_ID, repositoryId: 'repo-a', state: 'BLOCKED', title: 'Writer B' },
    ],
  }));
  await page.route(`**/api/projects/${PROJECT_ID}/approvals`, async (route) => json(route, []));
  await page.route(`**/api/tasks/${BLOCKED_TASK_ID}/conflict-resolution`, async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, {
        id: 'conflict-1', taskId: BLOCKED_TASK_ID, type: 'WORKTREE_OWNERSHIP',
        resources: [sharedWorktree], state: 'OPEN', resolution: '',
      });
      return;
    }
    const body = route.request().postDataJSON() as { resolution: string; note: string };
    expect(body.resolution).toBe('RESOLVED_MANUALLY');
    onResolution(body);
    await json(route, {
      id: 'conflict-1', taskId: BLOCKED_TASK_ID, type: 'WORKTREE_OWNERSHIP',
      resources: [sharedWorktree], state: 'RESOLVED_MANUALLY', resolution: body.note,
    });
  });
  await page.route(`**/api/executions/${EXECUTION_ID}/result`, async (route) => json(route, {
    ...execution(), attributableDiff: '', previousChanges: '+cambios de Writer A',
  }));
  await page.route(`**/api/traces/${EXECUTION_ID}`, async (route) => json(route, []));
}

function project() {
  return { id: PROJECT_ID, name: 'Zeko conflictos', rootPath: '/tmp/zeko-conflicts', repositories: [{ id: 'aa000000-0000-4000-8000-000000000001', projectId: PROJECT_ID, path: '/tmp/zeko-repo', accessState: 'AVAILABLE' }] };
}

function execution() {
  return {
    id: EXECUTION_ID, taskId: FIRST_TASK_ID, attempt: 1, state: 'RUNNING', knownState: 'RUNNING',
    templateId: '6a1b5678-1234-4a5b-9cde-123456789abc', templateVersion: 1,
    retryOfExecutionId: null, cancellationRequested: false, effects: [],
  };
}

async function json(route: Route, body: unknown): Promise<void> {
  const correlationId = route.request().headers()['x-correlation-id'] ?? '';
  await route.fulfill({ status: 200, json: body, headers: { 'X-Correlation-Id': correlationId } });
}
