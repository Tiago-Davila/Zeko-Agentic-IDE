import { access, rm } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { GitCommandError, runGit } from "./git-cli.js";

export interface CleanupRunWorktreesInput {
  repoPath: string;
  runId: string;
  workspaces: Array<{ path: string; branch: string }>;
  confirmed?: boolean;
  worktreeRoot: string;
}

export interface CleanupRunWorktreesResult {
  removed: string[];
  confirmationRequired: boolean;
}

function runKey(runId: string): string {
  return runId.replaceAll("-", "").slice(0, 8);
}

function isInside(root: string, path: string): boolean {
  const normalizedRoot = resolve(root).toLowerCase();
  const normalizedPath = resolve(path).toLowerCase();
  return normalizedPath.startsWith(`${normalizedRoot}${sep.toLowerCase()}`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Removes only explicitly selected node worktrees from this run after user confirmation. */
export async function cleanupRunWorktrees(input: CleanupRunWorktreesInput): Promise<CleanupRunWorktreesResult> {
  if (!input.confirmed) return { removed: [], confirmationRequired: true };
  const key = runKey(input.runId);
  if (!/^[a-zA-Z0-9_-]{8}$/.test(key)) {
    throw new Error("Invalid runId for workspace cleanup");
  }

  const root = resolve(input.worktreeRoot);
  const repoPath = resolve(input.repoPath);
  const removed: string[] = [];
  const branches = new Set<string>();
  for (const workspace of input.workspaces) {
    const path = resolve(workspace.path);
    if (!isInside(root, path) || path === root || path === repoPath || isInside(repoPath, path)) {
      throw new Error("Refusing to clean a path outside the selected run worktree root");
    }
    if (!isInside(join(root, key), path) || workspace.branch !== workspace.branch.trim() || !workspace.branch.startsWith(`zeko/${key}/`)) {
      throw new Error("Refusing to clean a workspace or branch outside the selected run");
    }
    const branch = workspace.branch;
    if (await exists(path)) await runGit("worktree", ["remove", "--force", path], { cwd: repoPath });
    await rm(join(root, key, `${basename(path)}.zeko.json`), { force: true });
    if (!branches.has(branch)) {
      try {
        await runGit("branch", ["-D", branch], { cwd: repoPath });
      } catch (error) {
        if (!(error instanceof GitCommandError) || ![1, 128].includes(error.context.exitCode ?? -1)) throw error;
      }
      branches.add(branch);
    }
    removed.push(path);
  }
  return { removed, confirmationRequired: false };
}

export function runWorktreePath(worktreeRoot: string, runId: string, nodeId: string): string {
  return join(worktreeRoot, runKey(runId), nodeId);
}
