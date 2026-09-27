import { GitCommandError, runGit } from "./git-cli.js";

export interface ObservedFile {
  path: string;
  change: string;
  eolOnly: boolean;
}

function parseNameStatus(output: string): Array<{ change: string; path: string }> {
  const fields = output.split("\0");
  const files: Array<{ change: string; path: string }> = [];
  for (let index = 0; index < fields.length; ) {
    const change = fields[index++];
    if (!change) continue;
    const firstPath = fields[index++];
    if (firstPath === undefined) break;
    const status = change[0] ?? change;
    const path = status === "R" || status === "C" ? fields[index++] : firstPath;
    if (path !== undefined) files.push({ change, path: path.replaceAll("\\", "/") });
  }
  return files;
}

async function differsIgnoringCarriageReturns(input: {
  cwd: string;
  baseCommit: string;
  resultCommit: string;
  path: string;
}): Promise<boolean> {
  try {
    await runGit("diff", ["--quiet", "--ignore-cr-at-eol", input.baseCommit, input.resultCommit, "--", input.path], { cwd: input.cwd });
    return false;
  } catch (error) {
    if (error instanceof GitCommandError && error.context.exitCode === 1) return true;
    throw error;
  }
}

/** Lists committed tree changes and identifies edits that only alter CR-at-EOL bytes. */
export async function getObservedFiles(input: {
  cwd: string;
  baseCommit: string;
  resultCommit: string;
}): Promise<ObservedFile[]> {
  const { stdout } = await runGit("diff", ["--name-status", "-z", input.baseCommit, input.resultCommit], { cwd: input.cwd });
  const changes = parseNameStatus(stdout);
  return Promise.all(changes.map(async ({ change, path }) => ({
    path,
    change,
    eolOnly: change.startsWith("M") && !(await differsIgnoringCarriageReturns({ ...input, path })),
  })));
}
