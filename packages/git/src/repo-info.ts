import { GitCommandError, runGit } from "./git-cli.js";

export type RepositoryDiagnosticCode = "NOT_A_GIT_REPO" | "NO_COMMITS";

export class RepositoryInfoError extends Error {
  readonly name = "RepositoryInfoError";
  readonly code: RepositoryDiagnosticCode;
  readonly path: string;

  constructor(
    code: RepositoryDiagnosticCode,
    path: string,
    options?: ErrorOptions,
  ) {
    super(code === "NOT_A_GIT_REPO" ? "Path is not inside a git repository" : "Repository has no commits", options);
    this.code = code;
    this.path = path;
  }
}

export interface RepositoryInfo {
  root: string;
  head: string;
  uncommittedChanges: boolean;
  filesAtHead: string[];
}

/** Reads the immutable HEAD snapshot and current worktree status of a repository. */
export async function getRepositoryInfo(path: string): Promise<RepositoryInfo> {
  let root: string;
  try {
    ({ stdout: root } = await runGit("rev-parse", ["--show-toplevel"], { cwd: path }));
  } catch (error) {
    if (error instanceof GitCommandError) {
      throw new RepositoryInfoError("NOT_A_GIT_REPO", path, { cause: error });
    }
    throw error;
  }

  let head: string;
  try {
    ({ stdout: head } = await runGit("rev-parse", ["--verify", "HEAD"], { cwd: root.trim() }));
  } catch (error) {
    if (error instanceof GitCommandError) {
      throw new RepositoryInfoError("NO_COMMITS", root.trim(), { cause: error });
    }
    throw error;
  }

  const [status, files] = await Promise.all([
    runGit("status", ["--porcelain", "--untracked-files=normal"], { cwd: root.trim() }),
    runGit("ls-tree", ["-r", "--name-only", "-z", "HEAD"], { cwd: root.trim() }),
  ]);
  return {
    root: root.trim(),
    head: head.trim(),
    uncommittedChanges: status.stdout.length > 0,
    filesAtHead: files.stdout.split("\0").filter(Boolean).map((file) => file.replaceAll("\\", "/")),
  };
}
