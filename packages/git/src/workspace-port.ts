import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { WorkspacePort } from "@zeko/contracts";
import { commitWorkspaceChanges } from "./engine-commit.js";
import { runGit } from "./git-cli.js";
import { createWorktree, getWorktreeRoot } from "./worktree.js";

interface WorkspaceMetadata {
  runId: string;
  nodeId: string;
  branch: string;
  baseCommit: string;
  trust: "trusted" | "untrusted";
}

function runKey(runId: string): string {
  return runId.replaceAll("-", "").slice(0, 8);
}

function metadataPath(path: string, nodeKey: string): string {
  return join(dirname(path), `${nodeKey}.zeko.json`);
}

async function persistMetadata(path: string, metadata: WorkspaceMetadata): Promise<void> {
  const target = metadataPath(path, metadata.nodeId);
  const temporary = `${target}.tmp`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(metadata)}\n`, { encoding: "utf8" });
  await rename(temporary, target);
}

export class GitWorkspacePort implements WorkspacePort {
  readonly #root: string;
  readonly #metadata = new Map<string, WorkspaceMetadata>();

  constructor(
    readonly repoPath: string,
    worktreeRoot = getWorktreeRoot(),
  ) {
    this.#root = resolve(worktreeRoot);
  }

  async create(input: {
    runId: string;
    nodeId: string;
    baseCommit: string;
  }): Promise<{ path: string; branch: string }> {
    const attempt = /^(.*)-attempt-\d+$/.exec(input.nodeId);
    const nodeId = attempt?.[1] ?? input.nodeId;
    const key = `${input.nodeId}`;
    const workspace = await createWorktree({
      repoPath: this.repoPath,
      runId: input.runId,
      nodeId,
      nodeKey: key,
      baseCommit: input.baseCommit,
      worktreeRoot: this.#root,
    });
    const metadata: WorkspaceMetadata = {
      runId: input.runId,
      nodeId: key,
      branch: workspace.branch,
      baseCommit: input.baseCommit,
      trust: "trusted",
    };
    await persistMetadata(workspace.path, metadata);
    this.#metadata.set(workspace.path, metadata);
    return workspace;
  }

  async remove(path: string): Promise<void> {
    const metadata = this.#metadata.get(path);
    if (!metadata) throw new Error("Cannot remove a workspace that was not created by this port");
    await runGit("worktree", ["remove", "--force", path], { cwd: this.repoPath });
    await runGit("branch", ["-D", metadata.branch], { cwd: this.repoPath });
    await rm(metadataPath(path, metadata.nodeId), { force: true });
    this.#metadata.delete(path);
  }

  async commit(input: {
    path: string;
    baseCommit: string;
    cancelled: boolean;
  }): Promise<{ resultCommit?: string; historyRewritten: boolean }> {
    const metadata = this.#metadata.get(input.path);
    if (!metadata) throw new Error("Cannot commit a workspace that was not created by this port");
    const result = await commitWorkspaceChanges({
      workspacePath: input.path,
      baseCommit: input.baseCommit,
      cancelled: input.cancelled,
    });
    return {
      ...(result.resultCommit ? { resultCommit: result.resultCommit } : {}),
      historyRewritten: result.historyRewritten,
    };
  }

  async markUntrusted(path: string): Promise<void> {
    const metadata = this.#metadata.get(path);
    if (!metadata)
      throw new Error("Cannot change trust for a workspace that was not created by this port");
    metadata.trust = "untrusted";
    await persistMetadata(path, metadata);
  }
}

export function workspaceMetadataPath(worktreePath: string, nodeKey: string): string {
  return metadataPath(worktreePath, nodeKey);
}

export function workspaceRunDirectory(worktreeRoot: string, runId: string): string {
  return join(worktreeRoot, runKey(runId));
}
