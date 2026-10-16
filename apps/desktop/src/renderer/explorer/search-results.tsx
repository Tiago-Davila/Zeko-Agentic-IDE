import { useMemo, useState, type MouseEvent } from "react";
import type { ContentSearchResult } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";
import { buildSearchRows, splitMatchPreview, splitRelativePath } from "./explorer-rows.js";
import { ChevronIcon, FileIcon } from "./explorer-icons.js";
import type { SearchError } from "./use-explorer-queries.js";

interface SearchResultsProps {
  query: string;
  result: ContentSearchResult | undefined;
  loading: boolean;
  error: SearchError | undefined;
  onOpenMatch: (relativePath: string) => void;
  onContextMenu: (event: MouseEvent, relativePath: string, line?: number) => void;
}

export function SearchResults({ query, result, loading, error, onOpenMatch, onContextMenu }: SearchResultsProps) {
  const t = useT();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const rows = useMemo(() => buildSearchRows(result, collapsed), [result, collapsed]);

  const toggle = (relativePath: string): void => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(relativePath)) next.delete(relativePath); else next.add(relativePath);
    return next;
  });

  if (!query) return <p className="explorer-message">{t("search.prompt")}</p>;
  if (error) return <p className="explorer-message explorer-message--error" role="alert">{t(error === "invalid-pattern" ? "search.invalidPattern" : "search.failed")}</p>;
  if (!result) return loading ? null : <p className="explorer-message">{t("search.noResults")}</p>;
  if (result.files.length === 0) return <p className="explorer-message">{t("search.noResults")}</p>;

  return <>
    <div className="search-summary">
      {t("search.summary", { matches: result.totalMatches, files: result.files.length })}
      {result.truncated && <> {t("search.truncated")}</>}
    </div>
    <div className="explorer-scroll" role="list">
      {rows.map((row) => {
        if (row.type === "file") {
          const { name, directory } = splitRelativePath(row.relativePath);
          return <button key={`file:${row.relativePath}`} type="button" role="listitem" className="search-file-row" title={row.relativePath}
            aria-expanded={!row.collapsed} onClick={() => toggle(row.relativePath)} onContextMenu={(event) => onContextMenu(event, row.relativePath)}>
            <ChevronIcon open={!row.collapsed} /><FileIcon />
            <span className="search-file-row__label"><span className="search-file-row__name">{name}</span>
              {directory && <span className="search-file-row__dir">{directory}</span>}</span>
            <span className="search-file-row__count">{row.matchCount}</span>
          </button>;
        }
        const parts = splitMatchPreview(row.match);
        return <button key={`match:${row.relativePath}:${row.match.line}:${row.index}`} type="button" role="listitem" className="search-match-row"
          onClick={() => onOpenMatch(row.relativePath)} onContextMenu={(event) => onContextMenu(event, row.relativePath, row.match.line)}>
          <span className="search-match-row__line">{row.match.line}</span>
          <span className="search-match-row__text">
            <span className="search-match-row__before">{parts.before}</span>
            {parts.match && <mark>{parts.match}</mark>}
            <span className="search-match-row__after">{parts.after}</span>
          </span>
        </button>;
      })}
    </div>
  </>;
}
