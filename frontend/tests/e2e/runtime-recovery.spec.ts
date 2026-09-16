import type { Page, Route } from '@playwright/test';

import { expect, test } from './fixtures/localWorkspace';

const PROJECT_ID = '6f2504e0-4f89-41d3-9a0c-0305e82c3301';
const TASK_ID = '7f2504e0-4f89-41d3-9a0c-0305e82c3301';
const EXECUTION_ID = '8f2504e0-4f89-41d3-9a0c-0305e82c3301';

test('muestra proveedor y proceso fallidos, y reconectar no reanuda la ejecución', async ({ page }) => {
  let failureSent = false;
  let snapshotRequests = 0;
  let unexpectedMutationRequests = 0;

  await installRoutes(page, () => {
    snapshotRequests += 1;
    return failureSent;
  }, (path) => {
    if (path.includes('/retries') || path.includes('/cancel-requests')) {
      unexpectedMutationRequests += 1;
    }
  }, () => { failureSent = true; });

  await page.goto('/');
  await page.getByRole('combobox', { name: 'Abrir proyecto' }).selectOption(PROJECT_ID);
  await page.getByRole('tab', { name: 'Runtime Canvas' }).click();

  await expect(page.getByRole('article', { name: 'Ejecución 1' }))
    .toContainText('Estado: RUNNING');
  await expect(page.getByText(/Docker.*no disponible/i)).toBeVisible();
  await expect(page.getByRole('article', { name: 'Ejecución 1' }))
    .toContainText('Estado: FAILED');
  await expect(page.getByRole('article', { name: 'Ejecución 1' }))
    .toContainText('último estado: EXIT_1');

  await page.getByRole('button', { name: 'Reintentar conexión local' }).click();
  await expect.poll(() => snapshotRequests).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('article', { name: 'Ejecución 1' }))
    .toContainText('Estado: FAILED');
  expect(unexpectedMutationRequests).toBe(0);
});

async function installRoutes(
  page: Page,
  snapshotState: () => boolean,
  onRequest: (path: string) => void,
  markFailure: () => void,
): Promise<void> {
  await page.routeWebSocket('/api/ws/events', (socket) => {
    socket.onMessage(async (message) => {
      if (typeof message !== 'string' || !message.includes('subscribe')) return;
      await new Promise((resolve) => setTimeout(resolve, 120));
      socket.send(JSON.stringify({
        eventId: 'provider-unavailable', eventType: 'provider.unavailable', sequence: 1,
        payload: { executionId: EXECUTION_ID, provider: 'docker', knownState: 'UNAVAILABLE', error: 'true' },
        execution: execution('RUNNING', 'RUNNING'),
      }));
      markFailure();
      socket.send(JSON.stringify({
        eventId: 'process-failed', eventType: 'execution.failed', sequence: 2,
        payload: { executionId: EXECUTION_ID, state: 'FAILED', knownState: 'EXIT_1' },
        execution: execution('FAILED', 'EXIT_1'),
      }));
    });
  });
  await page.route('**/api/session/bootstrap', async (route) => json(route, {}));
  await page.route('**/api/projects', async (route) => json(route, [project()]));
  await page.route(`**/api/projects/${PROJECT_ID}/agent-templates`, async (route) => json(route, []));
  await page.route(`**/api/projects/${PROJECT_ID}/agent-instances`, async (route) => json(route, []));
  await page.route(`**/api/projects/${PROJECT_ID}/skills`, async (route) => json(route, []));
  await page.route(`**/api/projects/${PROJECT_ID}/runtime-snapshot`, async (route) => {
    await json(route, {
      projectId: PROJECT_ID,
      executions: [snapshotState() ? execution('FAILED', 'EXIT_1') : execution('RUNNING', 'RUNNING')],
      tasks: [{ id: TASK_ID, repositoryId: 'repo-a', state: snapshotState() ? 'FAILED' : 'RUNNING', title: 'Proceso local' }],
    });
  });
  await page.route(`**/api/projects/${PROJECT_ID}/approvals`, async (route) => json(route, []));
  await page.route(`**/api/executions/${EXECUTION_ID}/result`, async (route) => json(route, {
    ...execution(snapshotState() ? 'FAILED' : 'RUNNING', snapshotState() ? 'EXIT_1' : 'RUNNING'),
    attributableDiff: '', previousChanges: '',
  }));
  await page.route(`**/api/traces/${EXECUTION_ID}`, async (route) => json(route, []));
  await page.route(`**/api/executions/${EXECUTION_ID}/retries`, async (route) => {
    onRequest(new URL(route.request().url()).pathname);
    await json(route, { ...execution('RUNNING', 'RUNNING'), attempt: 2 });
  });
  await page.route(`**/api/executions/${EXECUTION_ID}/cancel-requests`, async (route) => {
    onRequest(new URL(route.request().url()).pathname);
    await json(route, execution('FAILED', 'EXIT_1'));
  });
}

function project() {
  return { id: PROJECT_ID, name: 'Zeko recovery', rootPath: '/tmp/zeko-recovery', repositories: [{ id: 'aa000000-0000-4000-8000-000000000001', projectId: PROJECT_ID, path: '/tmp/zeko-repo', accessState: 'AVAILABLE' }] };
}

function execution(state: 'RUNNING' | 'FAILED', knownState: string) {
  return {
    id: EXECUTION_ID, taskId: TASK_ID, attempt: 1, state, knownState,
    templateId: '6a1b5678-1234-4a5b-9cde-123456789abc', templateVersion: 1,
    retryOfExecutionId: null, cancellationRequested: false, effects: [],
  };
}

async function json(route: Route, body: unknown): Promise<void> {
  const correlationId = route.request().headers()['x-correlation-id'] ?? '';
  await route.fulfill({ status: 200, json: body, headers: { 'X-Correlation-Id': correlationId } });
}
