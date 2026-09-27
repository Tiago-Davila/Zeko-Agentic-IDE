import { useEffect, useRef, useState } from "react";
import { IpcClientError, ipc, type ContentSearchOptions, type ContentSearchResult } from "../ipc/client.js";

export const NAME_FILTER_LIMIT = 500;
const NAME_FILTER_DEBOUNCE_MS = 150;
const SEARCH_DEBOUNCE_MS = 300;

export interface NameFilterState { paths: string[]; truncated: boolean; loading: boolean; failed: boolean }

/** Matches every whitespace-separated word against .gitignore-aware project paths. */
export function useNameFilter(projectId: string, query: string, enabled: boolean): NameFilterState {
  const [state, setState] = useState<NameFilterState>({ paths: [], truncated: false, loading: false, failed: false });
  const latest = useRef(0);
  const trimmed = query.trim();

  useEffect(() => {
    const token = ++latest.current;
    if (!enabled || !trimmed) { setState({ paths: [], truncated: false, loading: false, failed: false }); return; }
    setState((current) => ({ ...current, loading: true }));
    const timer = setTimeout(() => {
      ipc.request("files.list", { projectId, query: trimmed, limit: NAME_FILTER_LIMIT })
        .then((result) => { if (latest.current === token) setState({ ...result, loading: false, failed: false }); })
        .catch(() => { if (latest.current === token) setState({ paths: [], truncated: false, loading: false, failed: true }); });
    }, NAME_FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, projectId, trimmed]);

  return state;
}

export type SearchError = "invalid-pattern" | "failed";
export interface ContentSearchState { result: ContentSearchResult | undefined; loading: boolean; error: SearchError | undefined }

/** Debounced content search; responses from superseded queries are dropped. */
export function useContentSearch(projectId: string, options: ContentSearchOptions, enabled: boolean, runNow: number): ContentSearchState {
  const [state, setState] = useState<ContentSearchState>({ result: undefined, loading: false, error: undefined });
  const latest = useRef(0);
  const lastRunNow = useRef(runNow);
  const { query, caseSensitive, wholeWord, useRegex, includePattern, excludePattern } = options;

  useEffect(() => {
    const token = ++latest.current;
    // Enter bumps runNow to skip the debounce for that one search.
    const immediate = lastRunNow.current !== runNow;
    lastRunNow.current = runNow;
    if (!enabled) return;
    if (!query) { setState({ result: undefined, loading: false, error: undefined }); return; }
    setState((current) => ({ ...current, loading: true }));
    const timer = setTimeout(() => {
      ipc.request("files.search", { projectId, options: { query, caseSensitive, wholeWord, useRegex, includePattern, excludePattern } })
        .then((result) => { if (latest.current === token) setState({ result, loading: false, error: undefined }); })
        .catch((cause: unknown) => {
          if (latest.current !== token) return;
          const error = cause instanceof IpcClientError && cause.code === "INVALID_SEARCH_PATTERN" ? "invalid-pattern" : "failed";
          setState({ result: undefined, loading: false, error });
        });
    }, immediate ? 0 : SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, projectId, query, caseSensitive, wholeWord, useRegex, includePattern, excludePattern, runNow]);

  return state;
}
