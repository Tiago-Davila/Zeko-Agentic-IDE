import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  WORKSPACE_ROOT,
  assertInsideSuite,
  expect,
  headCommitSubject,
  test,
} from './fixtures/localWorkspace';

test.describe('harness E2E local', () => {
  test('sirve la UI local desde loopback', async ({ page }) => {
    await page.route('/api/session/bootstrap', async (route) => route.fulfill({
      json: {},
      headers: { 'X-Correlation-Id': route.request().headers()['x-correlation-id'] ?? '' },
    }));
    await page.route('/api/projects', async (route) => route.fulfill({
      json: [],
      headers: { 'X-Correlation-Id': route.request().headers()['x-correlation-id'] ?? '' },
    }));
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Zeko Agentic IDE' })).toBeVisible();
    expect(new URL(page.url()).hostname).toBe('127.0.0.1');
  });

  test('prepara repositorios temporales dentro del directorio de la suite', async ({
    localWorkspace,
  }) => {
    expect(localWorkspace.repositories).toHaveLength(2);

    for (const repository of localWorkspace.repositories) {
      expect(() => assertInsideSuite(repository.path)).not.toThrow();
      expect(repository.path.startsWith(WORKSPACE_ROOT)).toBe(true);
      expect(existsSync(join(repository.path, '.git'))).toBe(true);
      expect(headCommitSubject(repository)).toBe(`chore: estado inicial de ${repository.name}`);
    }

    const paths = localWorkspace.repositories.map((repository) => repository.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  test('rechaza rutas fuera del directorio de la suite', async () => {
    expect(() => assertInsideSuite(join(WORKSPACE_ROOT, '..', '..', '..', 'src'))).toThrow();
    expect(() => assertInsideSuite('/tmp/repo-del-usuario')).toThrow();
  });

  test('reporta el proveedor del comando en ejecucion', async ({ localWorkspace }, testInfo) => {
    expect(localWorkspace.provider).toBe(testInfo.project.metadata.provider);
    expect(['simulated', 'real']).toContain(localWorkspace.provider);
  });
});
