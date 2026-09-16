import type { Page, Route } from '@playwright/test';

import { expect, test } from './fixtures/localWorkspace';

const PROJECT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const TASK_ID = '2d8c5678-1234-4a5b-9cde-123456789abc';
const EXECUTION_ID = '4f1a5678-1234-4a5b-9cde-123456789abc';
const APPROVAL_ID = '5f2a5678-1234-4a5b-9cde-123456789abc';

test.describe('flujo local de autorización y ejecución', () => {
  test('aprueba una acción, observa el efecto y conserva sus IDs en el resultado', async ({ page }) => {
    let approved = false;
    await installWorkspaceRoutes(page, () => approved, (decision) => { approved = decision === 'APPROVE'; });

    await selectProjectAndOpenRuntime(page);
    await expect(page.getByRole('heading', { name: 'Aprobación requerida' })).toBeVisible();
    await expect(page.getByText('Revisión: 1 · estado PENDING')).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();
    await expect(page.getByText('Revisión: 1 · estado APPROVED')).toBeVisible();

    await page.getByRole('tab', { name: 'Agents Canvas' }).click();
    await page.getByRole('tab', { name: 'Runtime Canvas' }).click();
    await expect(page.getByRole('article', { name: 'Ejecución 1' }))
      .toContainText('Estado: COMPLETED');
    await expect(page.getByRole('article', { name: 'Ejecución 1' }))
      .toContainText('Efectos confirmados: 1');
    await expect(page.getByRole('heading', { name: 'Diff atribuible a la tarea' })).toBeVisible();
    await expect(page.locator('pre').first()).toContainText('allowed.txt');
  });

  test('deniega una acción sin crear efectos ni cambiar el estado de ejecución', async ({ page }) => {
    let approved = false;
    await installWorkspaceRoutes(page, () => approved, (decision) => { approved = decision === 'APPROVE'; });

    await selectProjectAndOpenRuntime(page);
    await page.getByRole('button', { name: 'Denegar' }).click();
    await expect(page.getByText('Revisión: 1 · estado DENIED')).toBeVisible();

    await page.getByRole('tab', { name: 'Agents Canvas' }).click();
    await page.getByRole('tab', { name: 'Runtime Canvas' }).click();
    await expect(page.getByRole('article', { name: 'Ejecución 1' }))
      .toContainText('Estado: RUNNING');
    await expect(page.getByRole('article', { name: 'Ejecución 1' }))
      .toContainText('Efectos confirmados: 0');
    await expect(page.locator('pre').first())
      .toContainText('No hay cambios atribuibles confirmados.');
  });
});

async function selectProjectAndOpenRuntime(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Abrir proyecto' }).selectOption(PROJECT_ID);
  await page.getByRole('tab', { name: 'Runtime Canvas' }).click();
}

async function installWorkspaceRoutes(page: Page, state: () => boolean, onDecision: (decision: string) => void): Promise<void> {
  await page.routeWebSocket('/api/ws/events', (socket) => {
    socket.onMessage(() => undefined);
  });
  await page.route('**/api/session/bootstrap', async (route) => json(route, {}));
  await page.route('**/api/projects', async (route) => json(route, [project()]));
  await page.route(`**/api/projects/${PROJECT_ID}/agent-templates`, async (route) => json(route, []));
  await page.route(`**/api/projects/${PROJECT_ID}/agent-instances`, async (route) => json(route, []));
  await page.route(`**/api/projects/${PROJECT_ID}/skills`, async (route) => json(route, []));
  await page.route(`**/api/projects/${PROJECT_ID}/runtime-snapshot`, async (route) => {
    await json(route, {
      projectId: PROJECT_ID,
      executions: [state() ? completedExecution() : runningExecution()],
      tasks: [{ id: TASK_ID, repositoryId: '7f3a5678-1234-4a5b-9cde-123456789abc', state: state() ? 'COMPLETED' : 'RUNNING', title: 'Escritura local' }],
    });
  });
  await page.route(`**/api/projects/${PROJECT_ID}/approvals`, async (route) => {
    await json(route, state() ? [] : [approval('PENDING')]);
  });
  await page.route(`**/api/approvals/${APPROVAL_ID}/decisions`, async (route) => {
    const body = route.request().postDataJSON() as { actionRevision: number; decision: string };
    expect(body.actionRevision).toBe(1);
    expect(['APPROVE', 'DENY']).toContain(body.decision);
    onDecision(body.decision);
    await json(route, approval(body.decision === 'APPROVE' ? 'APPROVED' : 'DENIED'));
  });
  await page.route(`**/api/executions/${EXECUTION_ID}/result`, async (route) => {
    await json(route, state()
      ? { ...completedExecution(), attributableDiff: '+allowed.txt', previousChanges: '' }
      : { ...runningExecution(), attributableDiff: '', previousChanges: '' });
  });
  await page.route(`**/api/traces/${EXECUTION_ID}`, async (route) => json(route, [
    { sourceId: TASK_ID, targetId: EXECUTION_ID, relation: 'EXECUTES', detail: { scope: 'local' } },
  ]));
}

function project() {
  return { id: PROJECT_ID, name: 'Zeko', rootPath: '/tmp/zeko-e2e', repositories: [{ id: 'aa000000-0000-4000-8000-000000000001', projectId: PROJECT_ID, path: '/tmp/zeko-repo', accessState: 'AVAILABLE' }] };
}

function runningExecution() {
  return {
    id: EXECUTION_ID,
    taskId: TASK_ID,
    attempt: 1,
    state: 'RUNNING',
    knownState: 'RUNNING',
    templateId: '6a1b5678-1234-4a5b-9cde-123456789abc',
    templateVersion: 1,
    retryOfExecutionId: null,
    cancellationRequested: false,
    effects: [],
  };
}

function completedExecution() {
  return {
    ...runningExecution(),
    state: 'COMPLETED',
    knownState: 'WRITTEN',
    effects: [{ id: 'effect-1', type: 'WRITE_LOCAL', resource: 'allowed.txt', confirmed: true, detail: 'Archivo actualizado' }],
  };
}

function approval(state: 'PENDING' | 'APPROVED' | 'DENIED') {
  return {
    id: APPROVAL_ID,
    actionRevision: 1,
    state,
    actionProposalId: '6f2a5678-1234-4a5b-9cde-123456789abc',
    agentInstanceId: null,
    taskId: TASK_ID,
    executionId: EXECUTION_ID,
    action: 'WRITE_LOCAL',
    resource: 'allowed.txt',
    scope: 'worktree',
    effects: ['write:allowed.txt'],
    reason: state === 'DENIED' ? 'Acción denegada' : '',
  };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  const correlationId = route.request().headers()['x-correlation-id'] ?? '';
  await route.fulfill({ status, json: body, headers: { 'X-Correlation-Id': correlationId } });
}
