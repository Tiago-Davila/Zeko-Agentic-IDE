import { homedir, tmpdir } from "node:os";
import { mkdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { runGit } from "./git-cli.js";

export interface WorktreeLocationOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
}

export interface CreateWorktreeOptions extends WorktreeLocationOptions {
  repoPath: string;
  runId: string;
  nodeId: string;
  nodeKey?: string;
  baseCommit: string;
  worktreeRoot?: string;
  tempDirectory?: string;
}

export class WorkspaceCreateError extends Error {
  readonly name = "WorkspaceCreateError";
  readonly code = "WORKSPACE_CREATE_FAILED";
  readonly workspacePath: string;

  constructor(workspacePath: string, options?: ErrorOptions) {
    super("Unable to create isolated git worktree", options);
    this.workspacePath = workspacePath;
  }
}

export function getWorktreeRoot(options: WorktreeLocationOptions = {}): string {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  if (platform === "win32") {
    const localAppData = env.LOCALAPPDATA;
    if (!localAppData || !isAbsolute(localAppData)) {
      throw new Error("LOCALAPPDATA must be an absolute path on Windows");
    }
    return join(localAppData, "Zeko", "wt");
  }
  const dataHome = env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  if (!isAbsolute(dataHome)) throw new Error("XDG_DATA_HOME must be an absolute path");
  return join(dataHome, "Zeko", "wt");
}

function isWithin(parentPath: string, candidatePath: string, windows: boolean): boolean {
  const parent = resolve(parentPath);
  const candidate = resolve(candidatePath);
  const normalizedParent = windows ? parent.toLowerCase() : parent;
  const normalizedCandidate = windows ? candidate.toLowerCase() : candidate;
  const rel = relative(normalizedParent, normalizedCandidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

export function assertSafeWorktreePath(input: {
  repoPath: string;
  worktreePath: string;
  tempDirectory?: string;
  platform?: NodeJS.Platform;
}): void {
  const windows = (input.platform ?? process.platform) === "win32";
  if (isWithin(input.repoPath, input.worktreePath, windows)) {
    throw new Error("Worktree path must be outside the original repository");
  }
  if (isWithin(input.tempDirectory ?? tmpdir(), input.worktreePath, windows)) {
    throw new Error("Worktree path must not be inside the system temporary directory");
  }
}

export async function createWorktree(options: CreateWorktreeOptions): Promise<{ path: string; branch: string }> {
  const platform = options.platform ?? process.platform;
  const repoPath = resolve(options.repoPath);
  const root = resolve(options.worktreeRoot ?? getWorktreeRoot(options));
  const runKey = options.runId.replaceAll("-", "").slice(0, 8);
  const nodeKey = options.nodeKey ?? options.nodeId;
  if (!/^[a-zA-Z0-9_-]+$/.test(runKey) || !/^[a-zA-Z0-9_-]+$/.test(options.nodeId) || !/^[a-zA-Z0-9_-]+$/.test(nodeKey)) {
    throw new WorkspaceCreateError(root, { cause: new Error("runId and nodeId must be valid path and branch segments") });
  }
  const worktreePath = resolve(root, runKey, nodeKey);
  const branch = `zeko/${runKey}/${options.nodeId}`;
  try {
    assertSafeWorktreePath({ repoPath, worktreePath, tempDirectory: options.tempDirectory, platform });
    await mkdir(join(root, runKey), { recursive: true });
  } catch (error) {
    throw new WorkspaceCreateError(worktreePath, { cause: error });
  }
  try {
    await runGit("worktree", ["add", "-b", branch, worktreePath, options.baseCommit], { cwd: repoPath });
    return { path: worktreePath, branch };
  } catch (error) {
    throw new WorkspaceCreateError(worktreePath, { cause: error });
  }
}
