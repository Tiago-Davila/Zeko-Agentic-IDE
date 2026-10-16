import { isAbsolute, win32 } from "node:path";
import { runGit } from "./git-cli.js";

export interface FileDiffPage {
  path: string;
  patch: string;
  offset: number;
  nextOffset?: number;
  complete: boolean;
}

function normalizeRepoPath(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    isAbsolute(path) ||
    win32.isAbsolute(path) ||
    normalized.split("/").some((part) => part === ".." || part === ".")
  ) {
    throw new Error("Diff path must be a relative repository path");
  }
  return normalized;
}

/** Returns one file's patch in bounded line pages. `offset` is a zero-based line cursor. */
export async function getFileDiff(input: {
  cwd: string;
  baseCommit: string;
  resultCommit: string;
  path: string;
  offset?: number;
  limit?: number;
}): Promise<FileDiffPage> {
  const path = normalizeRepoPath(input.path);
  const offset = input.offset ?? 0;
  const limit = input.limit ?? 256;
  if (!Number.isInteger(offset) || offset < 0) throw new RangeError("offset must be a non-negative integer");
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new RangeError("limit must be between 1 and 1000 lines");

  const { stdout } = await runGit("diff", ["--no-ext-diff", "--no-color", "--unified=3", input.baseCommit, input.resultCommit, "--", path], { cwd: input.cwd });
  const lines = stdout.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const page = lines.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  return {
    path,
    patch: page.join(""),
    offset,
    ...(nextOffset < lines.length ? { nextOffset } : {}),
    complete: nextOffset >= lines.length,
  };
}
