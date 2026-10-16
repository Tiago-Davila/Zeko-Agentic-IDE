import type { ContentSearchMatch, ContentSearchResult, ProjectDirEntry } from "../ipc/client.js";

// Design reference: Orca's file explorer row projection and search result rows (MIT, Copyright (c) 2026 Lovecast Inc.).

export interface TreeRow {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  isSymlink: boolean;
  depth: number;
  expanded: boolean;
  loading: boolean;
}

/** Flattens the lazily loaded directory cache into the rows currently visible in the tree. */
export function flattenTree(
  dirCache: ReadonlyMap<string, readonly ProjectDirEntry[]>,
  expanded: ReadonlySet<string>,
  loading: ReadonlySet<string> = new Set(),
): TreeRow[] {
  const rows: TreeRow[] = [];
  const visit = (directory: string, depth: number): void => {
    for (const entry of dirCache.get(directory) ?? []) {
      const isOpen = entry.isDirectory && expanded.has(entry.relativePath);
      rows.push({ ...entry, depth, expanded: isOpen, loading: loading.has(entry.relativePath) });
      if (isOpen) visit(entry.relativePath, depth + 1);
    }
  };
  visit("", 0);
  return rows;
}

interface FilterNode { name: string; relativePath: string; children: Map<string, FilterNode> | undefined }

/**
 * Rebuilds a tree from matching file paths so the name filter keeps folder context.
 * Every folder starts expanded; `collapsed` holds the ones the user closed while filtering.
 */
export function buildFilteredRows(paths: readonly string[], collapsed: ReadonlySet<string> = new Set()): TreeRow[] {
  const root: FilterNode = { name: "", relativePath: "", children: new Map() };
  for (const path of paths) {
    const parts = path.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, index) => {
      const relativePath = parts.slice(0, index + 1).join("/");
      const isLeaf = index === parts.length - 1;
      node.children ??= new Map();
      let child = node.children.get(part);
      if (!child) {
        child = { name: part, relativePath, children: isLeaf ? undefined : new Map() };
        node.children.set(part, child);
      } else if (!isLeaf) child.children ??= new Map();
      node = child;
    });
  }
  const rows: TreeRow[] = [];
  const visit = (node: FilterNode, depth: number): void => {
    const children = [...(node.children?.values() ?? [])].sort(compareFilterNodes);
    for (const child of children) {
      const isDirectory = child.children !== undefined;
      const isOpen = isDirectory && !collapsed.has(child.relativePath);
      rows.push({ name: child.name, relativePath: child.relativePath, isDirectory, isSymlink: false, depth, expanded: isOpen, loading: false });
      if (isOpen) visit(child, depth + 1);
    }
  };
  visit(root, 0);
  return rows;
}

function compareFilterNodes(left: FilterNode, right: FilterNode): number {
  const leftDir = left.children !== undefined;
  const rightDir = right.children !== undefined;
  if (leftDir !== rightDir) return leftDir ? -1 : 1;
  return left.name.localeCompare(right.name, undefined, { sensitivity: "base", numeric: true });
}

export type SearchRow =
  | { type: "file"; relativePath: string; matchCount: number; collapsed: boolean }
  | { type: "match"; relativePath: string; match: ContentSearchMatch; index: number };

/** Flattens grouped search results into header and match rows, skipping matches of collapsed files. */
export function buildSearchRows(result: ContentSearchResult | undefined, collapsed: ReadonlySet<string>): SearchRow[] {
  if (!result) return [];
  const rows: SearchRow[] = [];
  for (const file of result.files) {
    const isCollapsed = collapsed.has(file.relativePath);
    rows.push({ type: "file", relativePath: file.relativePath, matchCount: file.matches.length, collapsed: isCollapsed });
    if (isCollapsed) continue;
    file.matches.forEach((match, index) => rows.push({ type: "match", relativePath: file.relativePath, match, index }));
  }
  return rows;
}

const BEFORE_MAX = 26;

/** Left-truncates the text before a match so the highlight stays visible in a narrow sidebar. */
export function splitMatchPreview(match: ContentSearchMatch): { before: string; match: string; after: string } {
  const content = match.lineContent;
  const start = match.column - 1;
  if (start < 0 || start + match.matchLength > content.length) return { before: content.trimStart(), match: "", after: "" };
  const rawBefore = content.slice(0, start).trimStart();
  const before = rawBefore.length > BEFORE_MAX ? `…${rawBefore.slice(rawBefore.length - BEFORE_MAX)}` : rawBefore;
  return { before, match: content.slice(start, start + match.matchLength), after: content.slice(start + match.matchLength) };
}

export function splitRelativePath(relativePath: string): { name: string; directory: string } {
  const index = relativePath.lastIndexOf("/");
  return index === -1 ? { name: relativePath, directory: "" } : { name: relativePath.slice(index + 1), directory: relativePath.slice(0, index) };
}
