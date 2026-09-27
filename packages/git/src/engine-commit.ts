import { GitCommandError, runGit } from "./git-cli.js";

export interface EngineCommitResult {
  committed: boolean;
  resultCommit?: string;
  historyRewritten: boolean;
}

/** Commits only engine-owned workspace state; user-cancelled attempts stay uncommitted. */
export async function commitWorkspaceChanges(input: {
  workspacePath: string;
  baseCommit: string;
  cancelled?: boolean;
}): Promise<EngineCommitResult> {
  if (input.cancelled) return { committed: false, historyRewritten: false };

  try {
    await runGit("merge-base", ["--is-ancestor", input.baseCommit, "HEAD"], { cwd: input.workspacePath });
  } catch (error) {
    if (error instanceof GitCommandError && error.context.exitCode === 1) {
      return { committed: false, historyRewritten: true };
    }
    throw error;
  }

  await runGit("add", ["-A"], { cwd: input.workspacePath });
  await runGit("commit", ["--no-verify", "--allow-empty", "-m", "Zeko agent result"], {
    cwd: input.workspacePath,
    config: {
      "user.name": "Zeko",
      "user.email": "zeko@localhost",
      "core.hooksPath": "",
    },
  });
  const { stdout } = await runGit("rev-parse", ["HEAD"], { cwd: input.workspacePath });
  return { committed: true, resultCommit: stdout.trim(), historyRewritten: false };
}
