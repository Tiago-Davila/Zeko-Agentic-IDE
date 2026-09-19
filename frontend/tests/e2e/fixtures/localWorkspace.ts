import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test as base } from '@playwright/test';

export type ProviderMode = 'simulated' | 'real';

export interface LocalRepository {
  readonly name: string;
  readonly path: string;
}

export interface LocalWorkspace {
  readonly provider: ProviderMode;
  readonly root: string;
  readonly repositories: readonly LocalRepository[];
  repository(name: string): LocalRepository;
}

const SUITE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Todo dato de prueba vive dentro de la suite; nunca se tocan repos del usuario.
export const WORKSPACE_ROOT = join(SUITE_ROOT, '.tmp', 'workspaces');

const REPOSITORY_NAMES = ['repo-a', 'repo-b'] as const;

export function assertInsideSuite(candidate: string): string {
  const target = resolve(candidate);
  const boundary = resolve(WORKSPACE_ROOT) + sep;

  if (!target.startsWith(boundary)) {
    throw new Error(`Ruta fuera del directorio de la suite: ${target}`);
  }

  return target;
}

function git(repositoryPath: string, args: readonly string[]): void {
  execFileSync(
    'git',
    ['-c', 'user.name=Zeko E2E', '-c', 'user.email=e2e@localhost', '-c', 'commit.gpgsign=false', ...args],
    { cwd: repositoryPath, stdio: 'pipe' },
  );
}

function createRepository(root: string, name: string): LocalRepository {
  const path = assertInsideSuite(join(root, name));
  mkdirSync(path, { recursive: true });

  git(path, ['init', '--quiet', '--initial-branch=main']);
  writeFileSync(join(path, 'README.md'), `# ${name}\n\nContenido de prueba sin secretos.\n`, 'utf8');
  git(path, ['add', 'README.md']);
  git(path, ['commit', '--quiet', '--no-gpg-sign', '-m', `chore: estado inicial de ${name}`]);

  return { name, path };
}

export function createLocalWorkspace(provider: ProviderMode): LocalWorkspace {
  mkdirSync(WORKSPACE_ROOT, { recursive: true });
  const root = assertInsideSuite(mkdtempSync(join(WORKSPACE_ROOT, 'workspace-')));
  const repositories = REPOSITORY_NAMES.map((name) => createRepository(root, name));

  return {
    provider,
    root,
    repositories,
    repository(name: string): LocalRepository {
      const found = repositories.find((repository) => repository.name === name);

      if (found === undefined) {
        throw new Error(`Repositorio de prueba desconocido: ${name}`);
      }

      return found;
    },
  };
}

export function disposeLocalWorkspace(workspace: LocalWorkspace): void {
  rmSync(assertInsideSuite(workspace.root), { recursive: true, force: true });
}

export function headCommitSubject(repository: LocalRepository): string {
  return execFileSync('git', ['log', '-1', '--pretty=%s'], {
    cwd: assertInsideSuite(repository.path),
    encoding: 'utf8',
  }).trim();
}

export const test = base.extend<{ localWorkspace: LocalWorkspace }>({
  // Playwright exige el patron de desestructuracion como primer argumento del fixture.
  localWorkspace: async ({}, runTest, testInfo) => {
    const provider = testInfo.project.metadata.provider as ProviderMode;
    const workspace = createLocalWorkspace(provider);

    await runTest(workspace);

    disposeLocalWorkspace(workspace);
  },
});

export { expect } from '@playwright/test';
