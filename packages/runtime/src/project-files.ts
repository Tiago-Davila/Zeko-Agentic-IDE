import { readdir } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { listProjectFiles, searchProjectContents, type ContentSearchOptions, type ContentSearchResult, type FileListResult } from "@zeko/git";

export interface ProjectDirEntry {
  name: string;
  /** Slash-separated path relative to the project root. */
  relativePath: string;
  isDirectory: boolean;
  isSymlink: boolean;
}

export class ProjectFilesError extends Error {
  constructor(readonly code: "PATH_OUTSIDE_PROJECT" | "INVALID_FILES_REQUEST", readonly params: Record<string, unknown> = {}) {
    super(code);
    this.name = "ProjectFilesError";
  }
}

/** Read-only file access for the explorer, confined to one project root. */
export class ProjectFiles {
  private searchController: AbortController | undefined;

  constructor(private readonly root: string) {}

  async readDir(relativePath: unknown): Promise<ProjectDirEntry[]> {
    const directory = this.resolveInside(typeof relativePath === "string" ? relativePath : "");
    const base = toSlashPath(relative(this.root, directory));
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.name !== ".git")
      // Symlinks are listed but never expanded, so the tree cannot walk outside the project root.
      .map((entry) => ({
        name: entry.name,
        relativePath: base ? `${base}/${entry.name}` : entry.name,
        isDirectory: entry.isDirectory(),
        isSymlink: entry.isSymbolicLink(),
      }))
      .sort((left, right) => left.isDirectory !== right.isDirectory
        ? (left.isDirectory ? -1 : 1)
        : left.name.localeCompare(right.name, undefined, { sensitivity: "base", numeric: true }));
  }

  list(filter: unknown, limit: unknown): Promise<FileListResult> {
    return listProjectFiles(this.root, {
      filter: typeof filter === "string" ? filter : "",
      ...(typeof limit === "number" && Number.isInteger(limit) && limit > 0 ? { limit: Math.min(limit, 5000) } : {}),
    });
  }

  /** A newer search cancels the previous one so abandoned git grep processes stop immediately. */
  async search(options: unknown): Promise<ContentSearchResult> {
    const parsed = parseSearchOptions(options);
    this.searchController?.abort();
    const controller = new AbortController();
    this.searchController = controller;
    try {
      return await searchProjectContents(this.root, parsed, controller.signal);
    } finally {
      if (this.searchController === controller) this.searchController = undefined;
    }
  }

  private resolveInside(relativePath: string): string {
    const target = resolve(this.root, relativePath);
    const fromRoot = relative(this.root, target);
    if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
      throw new ProjectFilesError("PATH_OUTSIDE_PROJECT", { path: relativePath });
    }
    return target;
  }
}

function parseSearchOptions(value: unknown): ContentSearchOptions {
  if (typeof value !== "object" || value === null) throw new ProjectFilesError("INVALID_FILES_REQUEST");
  const input = value as Record<string, unknown>;
  if (typeof input["query"] !== "string" || input["query"].length > 2048) throw new ProjectFilesError("INVALID_FILES_REQUEST");
  const text = (key: string) => typeof input[key] === "string" ? input[key] : "";
  const flag = (key: string) => input[key] === true;
  return {
    query: input["query"],
    caseSensitive: flag("caseSensitive"),
    wholeWord: flag("wholeWord"),
    useRegex: flag("useRegex"),
    includePattern: text("includePattern"),
    excludePattern: text("excludePattern"),
  };
}

function toSlashPath(path: string): string {
  return path.split(sep).join("/");
}
