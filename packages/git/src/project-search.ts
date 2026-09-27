import { spawn } from "node:child_process";
import { GitCommandError } from "./git-cli.js";

// Design reference: Orca's explorer name filter and git-grep content search (MIT, Copyright (c) 2026 Lovecast Inc.).
// Zeko only opens Git repositories, so git ls-files / git grep give .gitignore-aware results without bundling ripgrep.

export const DEFAULT_FILE_LIST_LIMIT = 500;
export const DEFAULT_SEARCH_MAX_RESULTS = 2000;
export const MAX_MATCHES_PER_FILE = 100;
export const SEARCH_TIMEOUT_MS = 15_000;
const MAX_PREVIEW_LENGTH = 500;
const PREVIEW_LEADING_CONTEXT = 100;

export interface FileListResult {
  paths: string[];
  truncated: boolean;
}

export interface ContentSearchOptions {
  query: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  useRegex?: boolean;
  includePattern?: string;
  excludePattern?: string;
  maxResults?: number;
}

export interface ContentSearchMatch {
  line: number;
  /** 1-based column of the match inside `lineContent` (which may be a clipped preview of the real line). */
  column: number;
  matchLength: number;
  lineContent: string;
}

export interface ContentSearchFile {
  relativePath: string;
  matches: ContentSearchMatch[];
}

export interface ContentSearchResult {
  files: ContentSearchFile[];
  totalMatches: number;
  truncated: boolean;
}

export class SearchPatternError extends Error {
  override readonly name = "SearchPatternError";
  readonly code = "INVALID_SEARCH_PATTERN";
  readonly params: Record<string, unknown>;
  constructor(message: string) {
    super(message);
    this.params = { message };
  }
}

/** Lists tracked and untracked, non-ignored files whose path contains every whitespace-separated token. */
export async function listProjectFiles(
  cwd: string,
  options: { filter?: string; limit?: number; signal?: AbortSignal } = {},
): Promise<FileListResult> {
  const tokens = splitFilterTokens(options.filter ?? "");
  const limit = Math.max(1, options.limit ?? DEFAULT_FILE_LIST_LIMIT);
  const paths = new Set<string>();
  let truncated = false;
  await streamGit(["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd,
    separator: "\0",
    signal: options.signal,
    onRecord: (path) => {
      if (!path || paths.has(path) || !pathMatchesTokens(path, tokens)) return "continue";
      if (paths.size >= limit) { truncated = true; return "stop"; }
      paths.add(path);
      return "continue";
    },
  });
  return { paths: [...paths].sort(comparePaths), truncated };
}

/** Searches tracked and untracked, non-ignored text files with git grep and returns per-match columns. */
export async function searchProjectContents(
  cwd: string,
  options: ContentSearchOptions,
  signal?: AbortSignal,
): Promise<ContentSearchResult> {
  const maxResults = Math.max(1, Math.min(options.maxResults ?? DEFAULT_SEARCH_MAX_RESULTS, DEFAULT_SEARCH_MAX_RESULTS));
  const files = new Map<string, ContentSearchFile>();
  const result: ContentSearchResult = { files: [], totalMatches: 0, truncated: false };
  if (!options.query) return result;
  const submatch = buildSubmatchRegex(options);
  const exitCode = await streamGit(buildGitGrepArgs(options), {
    cwd,
    separator: "\n",
    signal,
    config: { "submodule.recurse": "false" },
    timeoutMs: SEARCH_TIMEOUT_MS,
    onTimeout: () => { result.truncated = true; },
    onRecord: (record) => {
      const parsed = parseGrepRecord(record);
      if (!parsed) return "continue";
      let file = files.get(parsed.path);
      for (const { start, length } of locateSubmatches(parsed.content, submatch)) {
        if (result.totalMatches >= maxResults) { result.truncated = true; return "stop"; }
        if (!file) { file = { relativePath: parsed.path, matches: [] }; files.set(parsed.path, file); }
        if (file.matches.length >= MAX_MATCHES_PER_FILE) { result.truncated = true; break; }
        file.matches.push({ line: parsed.line, ...previewLine(parsed.content, start, length) });
        result.totalMatches += 1;
      }
      return "continue";
    },
    // A malformed ERE makes git grep exit with 128 (or 2 on some builds).
    acceptExitCodes: options.useRegex ? [0, 1, 2, 128] : [0, 1],
  });
  if (options.useRegex && (exitCode === 128 || exitCode === 2)) throw new SearchPatternError("git grep rejected the search pattern");
  result.files = [...files.values()];
  return result;
}

export function buildGitGrepArgs(options: ContentSearchOptions): string[] {
  const args = ["grep", "-n", "-I", "--null", "--no-color", "--untracked", "--no-recurse-submodules"];
  if (!options.caseSensitive) args.push("-i");
  if (options.wholeWord) args.push("-w");
  args.push(options.useRegex ? "--extended-regexp" : "--fixed-strings", "-e", options.query, "--");
  const includes = splitGlobPatterns(options.includePattern ?? "").flatMap((glob) => toGitGlobPathspecs(glob, false));
  const excludes = splitGlobPatterns(options.excludePattern ?? "").flatMap((glob) => toGitGlobPathspecs(glob, true));
  // git grep needs at least one positive pathspec; "." means the whole repository.
  args.push(...(includes.length > 0 ? includes : ["."]), ...excludes);
  return args;
}

/** Splits "a, b" globs on top-level commas, keeping commas inside `{a,b}` groups. */
export function splitGlobPatterns(patterns: string): string[] {
  const out: string[] = [];
  let current = "";
  let depth = 0;
  for (const ch of patterns) {
    if (ch === "{") depth += 1;
    else if (ch === "}") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      if (current.trim()) out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** Bare globs such as `*.ts` match at any depth, and a directory glob also matches everything below it. */
export function toGitGlobPathspecs(glob: string, exclude: boolean): string[] {
  const directoryOnly = /\/+$/u.test(glob);
  const trimmed = glob.replace(/\/+$/u, "");
  if (!trimmed) return [];
  const pattern = trimmed.includes("/") ? trimmed : `**/${trimmed}`;
  const pathspec = `${exclude ? ":(exclude,glob)" : ":(glob)"}${pattern}`;
  return directoryOnly ? [`${pathspec}/**`] : [pathspec, `${pathspec}/**`];
}

export function splitFilterTokens(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/u).filter(Boolean);
}

export function pathMatchesTokens(path: string, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return true;
  const haystack = path.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

/** Parses `path\0line\0content` records emitted by `git grep --null -n`. */
export function parseGrepRecord(record: string): { path: string; line: number; content: string } | undefined {
  const first = record.indexOf("\0");
  if (first <= 0) return undefined;
  const second = record.indexOf("\0", first + 1);
  if (second === -1) return undefined;
  const lineText = record.slice(first + 1, second);
  if (!/^\d+$/u.test(lineText)) return undefined;
  return { path: record.slice(0, first), line: Number(lineText), content: record.slice(second + 1).replace(/\r$/u, "") };
}

/**
 * git grep only reports matching lines, so columns are recovered with an equivalent JS regex.
 * Returns null when the ERE is not valid JS; the whole line is then highlighted instead.
 */
export function buildSubmatchRegex(options: Pick<ContentSearchOptions, "query" | "useRegex" | "wholeWord" | "caseSensitive">): RegExp | null {
  let pattern = options.useRegex ? options.query : options.query.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  if (options.wholeWord) pattern = `\\b${pattern}\\b`;
  try {
    return new RegExp(pattern, `g${options.caseSensitive ? "" : "i"}`);
  } catch {
    return null;
  }
}

export function locateSubmatches(content: string, regex: RegExp | null): Array<{ start: number; length: number }> {
  if (!regex) return [{ start: 0, length: content.length }];
  const found: Array<{ start: number; length: number }> = [];
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    found.push({ start: match.index, length: match[0].length });
    if (match[0].length === 0) regex.lastIndex += 1;
  }
  // The JS regex can disagree with git's ERE; keep git's verdict that the line matched.
  return found.length > 0 ? found : [{ start: 0, length: content.length }];
}

/** Clips very long (minified) lines around the match so results stay small. */
export function previewLine(content: string, start: number, length: number): Omit<ContentSearchMatch, "line"> {
  if (content.length <= MAX_PREVIEW_LENGTH) return { column: start + 1, matchLength: length, lineContent: content };
  const from = Math.max(0, start - PREVIEW_LEADING_CONTEXT);
  const lineContent = content.slice(from, from + MAX_PREVIEW_LENGTH);
  return { column: start - from + 1, matchLength: Math.min(length, lineContent.length - (start - from)), lineContent };
}

function comparePaths(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
}

interface StreamGitOptions {
  cwd: string;
  separator: string;
  onRecord: (record: string) => "continue" | "stop";
  signal?: AbortSignal | undefined;
  config?: Record<string, string>;
  timeoutMs?: number;
  onTimeout?: () => void;
  acceptExitCodes?: number[];
}

/** Streams git stdout record by record so large repositories never buffer the full output. */
function streamGit(args: string[], options: StreamGitOptions): Promise<number | null> {
  const gitArgs = [
    "-c", "core.longpaths=true", "-c", "core.quotepath=false",
    ...Object.entries(options.config ?? {}).flatMap(([key, value]) => ["-c", `${key}=${value}`]),
    ...args,
  ];
  return new Promise((resolve, reject) => {
    // Stopping goes through spawn's AbortSignal, the same mechanism runGit uses for cancellation.
    const controller = new AbortController();
    const child = spawn("git", gitArgs, {
      cwd: options.cwd, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], signal: controller.signal,
    });
    let buffer = "";
    let stopped = false;
    let stderr = "";
    const stop = (): void => { if (!stopped) { stopped = true; controller.abort(); } };
    const timer = options.timeoutMs ? setTimeout(() => { options.onTimeout?.(); stop(); }, options.timeoutMs) : undefined;
    const onAbort = (): void => stop();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    const consume = (record: string): void => {
      if (!stopped && options.onRecord(record) === "stop") stop();
    };
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (stopped) return;
      buffer += chunk;
      let index: number;
      while (!stopped && (index = buffer.indexOf(options.separator)) !== -1) {
        const record = buffer.slice(0, index);
        buffer = buffer.slice(index + options.separator.length);
        consume(record);
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { if (stderr.length < 4096) stderr += chunk; });
    const cleanup = (): void => {
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    };
    child.once("error", (cause) => {
      cleanup();
      // An aborted child still emits close once it has exited; settle there so the cwd is released.
      if (stopped) return;
      reject(new GitCommandError(`Unable to start git ${args[0] ?? ""}`, { command: args[0] ?? "", args, cwd: options.cwd }, { cause }));
    });
    child.once("close", (exitCode) => {
      cleanup();
      if (!stopped && buffer) consume(buffer);
      if (stopped || exitCode === null) { resolve(exitCode); return; }
      const accepted = options.acceptExitCodes ?? [0];
      if (accepted.includes(exitCode)) { resolve(exitCode); return; }
      reject(new GitCommandError(`git ${args[0] ?? ""} failed with exit code ${String(exitCode)}`, {
        command: args[0] ?? "", args, cwd: options.cwd, exitCode, ...(stderr ? { stderr } : {}),
      }));
    });
  });
}
