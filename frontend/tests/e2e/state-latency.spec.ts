import { expect, test } from './fixtures/localWorkspace';

const TARGET_MILLISECONDS = 5_000;
const PROJECT_ID = '5f2504e0-4f89-41d3-9a0c-0305e82c3301';

test('measures the local-confirmation-to-visible-state path with its correlation id', async ({ page }, testInfo) => {
  let confirmationAt = 0;
  let correlationId = '';

  await page.route('/api/session/bootstrap', async (route) => route.fulfill({
    json: {},
    headers: { 'X-Correlation-Id': route.request().headers()['x-correlation-id'] ?? '' },
  }));
  await page.route('/api/projects', async (route) => route.fulfill({
    json: [{
      id: PROJECT_ID,
      name: 'Zeko latency',
      rootPath: '/tmp/zeko-latency',
      repositories: [{
        id: 'aa000000-0000-4000-8000-00000000000c',
        projectId: PROJECT_ID,
        path: '/tmp/zeko-latency/repo',
        accessState: 'AVAILABLE',
      }],
    }],
    headers: { 'X-Correlation-Id': route.request().headers()['x-correlation-id'] ?? '' },
  }));
  for (const path of ['agent-templates', 'agent-instances', 'skills', 'approvals']) {
    await page.route(`**/api/projects/${PROJECT_ID}/${path}`, async (route) => route.fulfill({
      json: [],
      headers: { 'X-Correlation-Id': route.request().headers()['x-correlation-id'] ?? '' },
    }));
  }
  await page.route(`**/api/projects/${PROJECT_ID}/runtime-snapshot`, async (route) => {
    confirmationAt = performance.now();
    correlationId = route.request().headers()['x-correlation-id'] ?? '';
    await route.fulfill({
      json: { projectId: PROJECT_ID, executions: [runningExecution()], tasks: [] },
      headers: { 'X-Correlation-Id': correlationId },
    });
  });
  await page.route('/api/executions/4f1a5678-1234-4a5b-9cde-123456789abc/result', async (route) => {
    await route.fulfill({
      json: { ...runningExecution(), attributableDiff: '', previousChanges: '' },
      headers: { 'X-Correlation-Id': route.request().headers()['x-correlation-id'] ?? '' },
    });
  });
  await page.route('/api/traces/4f1a5678-1234-4a5b-9cde-123456789abc', async (route) => {
    await route.fulfill({
      json: [],
      headers: { 'X-Correlation-Id': route.request().headers()['x-correlation-id'] ?? '' },
    });
  });

  await page.goto('/');
  // El launcher es la pantalla inicial y solo deja abrir un proyecto ya configurado.
  await page.getByRole('combobox', { name: 'Abrir proyecto' }).selectOption(PROJECT_ID);
  await page.getByRole('tab', { name: 'Runtime Canvas' }).click();
  await expect(page.getByRole('article', { name: 'Ejecución 1' }).getByText(/Estado: RUNNING/)).toBeVisible();

  const visibleAfterMilliseconds = performance.now() - confirmationAt;
  await testInfo.attach('state-latency-simulated.json', {
    body: JSON.stringify({
      correlationId,
      visibleAfterMilliseconds,
      targetMilliseconds: TARGET_MILLISECONDS,
      modelGenerationIncluded: false,
      environment: 'simulated-ui-path',
    }, null, 2),
    contentType: 'application/json',
  });

  expect(correlationId).not.toBe('');
  expect(visibleAfterMilliseconds).toBeLessThan(TARGET_MILLISECONDS);
});

function runningExecution() {
  return {
    id: '4f1a5678-1234-4a5b-9cde-123456789abc',
    taskId: '2d8c5678-1234-4a5b-9cde-123456789abc',
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
