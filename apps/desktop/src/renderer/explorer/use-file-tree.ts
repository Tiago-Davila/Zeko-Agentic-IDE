import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ipc, type ProjectDirEntry } from "../ipc/client.js";
import { flattenTree, type TreeRow } from "./explorer-rows.js";

export interface FileTree {
  rows: TreeRow[];
  expanded: ReadonlySet<string>;
  rootLoaded: boolean;
  error: boolean;
  toggle: (relativePath: string) => void;
  expand: (relativePath: string) => void;
  collapse: (relativePath: string) => void;
  collapseAll: () => void;
  refresh: () => Promise<void>;
  reveal: (relativePath: string) => Promise<void>;
}

/** Lazily loads one directory level at a time, like Orca's explorer, so large repositories open instantly. */
export function useFileTree(projectId: string): FileTree {
  const [dirCache, setDirCache] = useState<ReadonlyMap<string, readonly ProjectDirEntry[]>>(new Map());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState(false);
  const cacheRef = useRef(dirCache);
  cacheRef.current = dirCache;
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const generation = useRef(0);

  const loadDir = useCallback(async (relativePath: string): Promise<boolean> => {
    const requested = generation.current;
    setLoading((current) => new Set(current).add(relativePath));
    try {
      const entries = await ipc.request("files.readDir", { projectId, path: relativePath });
      if (generation.current !== requested) return false;
      setDirCache((current) => new Map(current).set(relativePath, entries));
      if (relativePath === "") setError(false);
      return true;
    } catch {
      if (generation.current === requested && relativePath === "") setError(true);
      return false;
    } finally {
      if (generation.current === requested) setLoading((current) => { const next = new Set(current); next.delete(relativePath); return next; });
    }
  }, [projectId]);

  useEffect(() => {
    generation.current += 1;
    setDirCache(new Map());
    setExpanded(new Set());
    setLoading(new Set());
    setError(false);
    void loadDir("");
  }, [loadDir]);

  const expand = useCallback((relativePath: string) => {
    setExpanded((current) => current.has(relativePath) ? current : new Set(current).add(relativePath));
    if (!cacheRef.current.has(relativePath)) void loadDir(relativePath);
  }, [loadDir]);

  const collapse = useCallback((relativePath: string) => {
    setExpanded((current) => {
      if (!current.has(relativePath)) return current;
      const next = new Set(current);
      next.delete(relativePath);
      return next;
    });
  }, []);

  const toggle = useCallback((relativePath: string) => {
    if (expandedRef.current.has(relativePath)) collapse(relativePath);
    else expand(relativePath);
  }, [collapse, expand]);

  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  const refresh = useCallback(async () => {
    const open = [...expandedRef.current];
    const results = await Promise.all(["", ...open].map(async (path) => [path, await loadDir(path)] as const));
    // Folders deleted on disk since they were opened simply fall out of the expanded set.
    const failed = new Set(results.filter(([, ok]) => !ok).map(([path]) => path));
    if (failed.size > 0) setExpanded((current) => new Set([...current].filter((path) => !failed.has(path))));
  }, [loadDir]);

  const reveal = useCallback(async (relativePath: string) => {
    const parts = relativePath.split("/");
    const ancestors = parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join("/"));
    for (const ancestor of ancestors) {
      if (!cacheRef.current.has(ancestor) && !(await loadDir(ancestor))) return;
    }
    setExpanded((current) => new Set([...current, ...ancestors]));
  }, [loadDir]);

  const rows = useMemo(() => flattenTree(dirCache, expanded, loading), [dirCache, expanded, loading]);
  return { rows, expanded, rootLoaded: dirCache.has(""), error, toggle, expand, collapse, collapseAll, refresh, reveal };
}
