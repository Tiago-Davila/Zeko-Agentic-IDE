import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useT } from "../i18n/use-t.js";
import { buildFilteredRows, type TreeRow } from "./explorer-rows.js";
import { ChevronIcon, CloseIcon, CollapseIcon, FileIcon, FilterIcon, FolderIcon, LinkIcon, RefreshIcon, SearchIcon } from "./explorer-icons.js";
import { SearchResults } from "./search-results.js";
import { NAME_FILTER_LIMIT, useContentSearch, useNameFilter } from "./use-explorer-queries.js";
import { useFileTree } from "./use-file-tree.js";

// Design reference: Orca's right-sidebar FileExplorer, Names/Contents switch and search panel (MIT, Copyright (c) 2026 Lovecast Inc.).

type ExplorerView = "files" | "search";
interface MenuState { x: number; y: number; items: Array<{ label: string; text: string }> }

interface ProjectExplorerProps { projectId: string; root: string }

export function ProjectExplorer({ projectId, root }: ProjectExplorerProps) {
  const t = useT();
  const [view, setView] = useState<ExplorerView>("files");
  const [nameQuery, setNameQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [includePattern, setIncludePattern] = useState("");
  const [excludePattern, setExcludePattern] = useState("");
  const [runNow, setRunNow] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [filterCollapsed, setFilterCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [menu, setMenu] = useState<MenuState>();
  const treeRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const tree = useFileTree(projectId);
  const hasNameFilter = view === "files" && nameQuery.trim().length > 0;
  const nameFilter = useNameFilter(projectId, nameQuery, view === "files");
  const search = useContentSearch(projectId, { query: searchQuery, caseSensitive, wholeWord, useRegex, includePattern, excludePattern }, view === "search", runNow);
  const filteredRows = useMemo(() => buildFilteredRows(nameFilter.paths, filterCollapsed), [nameFilter.paths, filterCollapsed]);
  const rows = hasNameFilter ? filteredRows : tree.rows;
  const repoName = root.split(/[\\/]/).filter(Boolean).at(-1) ?? root;
  const separator = root.includes("\\") ? "\\" : "/";

  useEffect(() => { setFilterCollapsed(new Set()); }, [nameQuery]);
  useEffect(() => {
    setView("files"); setNameQuery(""); setSearchQuery(""); setSelected(undefined);
  }, [projectId]);
  const focusedView = useRef(view);
  useEffect(() => {
    // Focus follows a mode switch only, so opening a project does not steal focus.
    if (focusedView.current === view) return;
    focusedView.current = view;
    (view === "files" ? nameInputRef : searchInputRef).current?.focus({ preventScroll: true });
  }, [view]);
  useEffect(() => {
    if (!selected) return;
    treeRef.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected, rows]);

  const selectView = (next: ExplorerView): void => {
    // Carry the typed text across modes so switching Names ↔ Contents keeps the user's query.
    if (next === "search" && !searchQuery && nameQuery.trim()) setSearchQuery(nameQuery.trim());
    if (next === "files" && !nameQuery && searchQuery.trim()) setNameQuery(searchQuery.trim());
    setView(next);
  };

  const toggleDir = useCallback((row: TreeRow) => {
    if (!hasNameFilter) { tree.toggle(row.relativePath); return; }
    setFilterCollapsed((current) => {
      const next = new Set(current);
      if (next.has(row.relativePath)) next.delete(row.relativePath); else next.add(row.relativePath);
      return next;
    });
  }, [hasNameFilter, tree]);

  const activateRow = (row: TreeRow): void => {
    setSelected(row.relativePath);
    if (row.isDirectory) toggleDir(row);
  };

  const openMatch = (relativePath: string): void => {
    // Zeko has no editor yet, so a result reveals its file in the tree.
    setNameQuery("");
    setView("files");
    setSelected(relativePath);
    void tree.reveal(relativePath);
  };

  const openMenu = (event: MouseEvent, relativePath: string, line?: number): void => {
    event.preventDefault();
    const absolute = [root.replace(/[\\/]+$/u, ""), ...relativePath.split("/")].join(separator);
    const items = [
      { label: t("explorer.copyPath"), text: absolute },
      { label: t("explorer.copyRelativePath"), text: relativePath },
      ...(line === undefined ? [] : [{ label: t("search.copyLinePath"), text: `${relativePath}#L${line}` }]),
    ];
    setMenu({ x: event.clientX, y: event.clientY, items });
  };

  const closeMenu = useCallback(() => setMenu(undefined), []);

  const onTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (rows.length === 0) return;
    const index = rows.findIndex((row) => row.relativePath === selected);
    const current = index === -1 ? undefined : rows[index];
    const move = (next: number): void => {
      const row = rows[Math.max(0, Math.min(rows.length - 1, next))];
      if (row) setSelected(row.relativePath);
    };
    switch (event.key) {
      case "ArrowDown": move(index + 1); break;
      case "ArrowUp": move(index === -1 ? rows.length - 1 : index - 1); break;
      case "Home": move(0); break;
      case "End": move(rows.length - 1); break;
      case "ArrowRight":
        if (current?.isDirectory && !current.expanded) toggleDir(current);
        else if (current?.isDirectory) move(index + 1);
        break;
      case "ArrowLeft":
        if (current?.isDirectory && current.expanded) toggleDir(current);
        else if (current) {
          const parent = current.relativePath.split("/").slice(0, -1).join("/");
          if (parent) setSelected(parent);
        }
        break;
      case "Enter": case " ":
        if (current) activateRow(current);
        break;
      default: return;
    }
    event.preventDefault();
  };

  const clearName = (): void => { setNameQuery(""); nameInputRef.current?.focus(); };
  const clearSearch = (): void => { setSearchQuery(""); searchInputRef.current?.focus(); };

  return <section className="explorer" aria-label={t("explorer.fileTree")}>
    <header className="explorer-toolbar">
      <div className="explorer-toolbar__title"><span>{t("explorer.title")}</span><strong title={root}>{repoName}</strong></div>
      <div className="explorer-toolbar__actions">
        <ToolbarButton label={t("explorer.refresh")} disabled={view !== "files"} onClick={() => void tree.refresh()}><RefreshIcon /></ToolbarButton>
        <ToolbarButton label={t("explorer.collapseAll")} disabled={view !== "files" || hasNameFilter || tree.expanded.size === 0}
          onClick={tree.collapseAll}><CollapseIcon /></ToolbarButton>
      </div>
    </header>

    <div className="explorer-query">
      {/* Both query rows stay mounted so switching modes neither remounts nor shifts the field. */}
      <div className="explorer-query__slot">
        <div className={`explorer-field${view === "files" ? "" : " explorer-hidden"}`}>
          <FilterIcon />
          <input ref={nameInputRef} type="text" value={nameQuery} spellCheck={false} placeholder={t("explorer.findFiles")}
            aria-label={t("explorer.findFiles")} onChange={(event) => setNameQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") clearName();
              if (event.key === "ArrowDown") { event.preventDefault(); treeRef.current?.focus(); if (!selected && rows[0]) setSelected(rows[0].relativePath); }
            }} />
          {nameFilter.loading && <span className="explorer-spinner" aria-hidden="true" />}
          {nameQuery && <button type="button" className="explorer-field__button" aria-label={t("explorer.clearFilter")} onClick={clearName}><CloseIcon /></button>}
        </div>
        <div className={`explorer-field${view === "search" ? "" : " explorer-hidden"}`}>
          <SearchIcon />
          <input ref={searchInputRef} type="text" value={searchQuery} spellCheck={false} placeholder={t("search.placeholder")}
            aria-label={t("explorer.modeContentsLabel")} onChange={(event) => setSearchQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setRunNow((value) => value + 1);
              if (event.key === "Escape") clearSearch();
            }} />
          {search.loading && <span className="explorer-spinner" aria-hidden="true" />}
          {searchQuery && <button type="button" className="explorer-field__button" aria-label={t("search.clear")} onClick={clearSearch}><CloseIcon /></button>}
          <SearchToggle label={t("search.matchCase")} active={caseSensitive} onClick={() => setCaseSensitive((value) => !value)}>{"Aa"}</SearchToggle>
          <SearchToggle label={t("search.wholeWord")} active={wholeWord} onClick={() => setWholeWord((value) => !value)}><u>{"ab"}</u></SearchToggle>
          <SearchToggle label={t("search.regex")} active={useRegex} onClick={() => setUseRegex((value) => !value)}>{".*"}</SearchToggle>
        </div>
      </div>
      <div className="explorer-switch" role="radiogroup" aria-label={t("explorer.modeLabel")}>
        <button type="button" role="radio" aria-checked={view === "files"} aria-label={t("explorer.modeNamesLabel")}
          onClick={() => selectView("files")}>{t("explorer.modeNames")}</button>
        <button type="button" role="radio" aria-checked={view === "search"} aria-label={t("explorer.modeContentsLabel")}
          onClick={() => selectView("search")}>{t("explorer.modeContents")}</button>
      </div>
      {view === "search" && <div className="explorer-filters">
        <label><span>{t("search.include")}</span>
          <input type="text" value={includePattern} spellCheck={false} placeholder={t("search.includePlaceholder")}
            onChange={(event) => setIncludePattern(event.currentTarget.value)} /></label>
        <label><span>{t("search.exclude")}</span>
          <input type="text" value={excludePattern} spellCheck={false} placeholder={t("search.excludePlaceholder")}
            onChange={(event) => setExcludePattern(event.currentTarget.value)} /></label>
      </div>}
    </div>

    <div className="explorer-body">
      {view === "files" ? <>
        {hasNameFilter && nameFilter.truncated && <div className="search-summary">{t("explorer.filterTruncated", { count: NAME_FILTER_LIMIT })}</div>}
        <div ref={treeRef} className="explorer-scroll" role="tree" tabIndex={0} aria-label={t("explorer.fileTree")} onKeyDown={onTreeKeyDown}>
          {rows.map((row) => <button key={row.relativePath} type="button" role="treeitem" tabIndex={-1} data-path={row.relativePath}
            aria-level={row.depth + 1} aria-expanded={row.isDirectory ? row.expanded : undefined} aria-selected={row.relativePath === selected}
            className={`explorer-row${row.relativePath === selected ? " explorer-row--selected" : ""}`}
            style={{ paddingLeft: `${row.depth * 14 + 6}px` }} title={row.relativePath}
            onClick={() => { activateRow(row); treeRef.current?.focus({ preventScroll: true }); }}
            onContextMenu={(event) => { setSelected(row.relativePath); openMenu(event, row.relativePath); }}>
            {row.isDirectory ? <ChevronIcon open={row.expanded} /> : <span className="explorer-icon-spacer" />}
            {row.isDirectory ? <FolderIcon open={row.expanded} /> : row.isSymlink ? <span title={t("explorer.symlink")}><LinkIcon /></span> : <FileIcon />}
            <span className="explorer-row__name">{row.name}</span>
            {row.loading && <span className="explorer-spinner" aria-hidden="true" />}
          </button>)}
          {tree.error && !hasNameFilter && <p className="explorer-message explorer-message--error" role="alert">{t("explorer.loadFailed")}</p>}
          {tree.rootLoaded && !hasNameFilter && tree.rows.length === 0 && <p className="explorer-message">{t("explorer.emptyFolder")}</p>}
          {hasNameFilter && !nameFilter.loading && rows.length === 0 && <p className="explorer-message">
            {nameFilter.failed ? t("explorer.loadFailed") : t("explorer.noMatchingFiles")}</p>}
        </div>
      </> : <SearchResults query={searchQuery} result={search.result} loading={search.loading} error={search.error}
        onOpenMatch={openMatch} onContextMenu={openMenu} />}
    </div>

    {menu && <CopyMenu menu={menu} onClose={closeMenu} />}
  </section>;
}

function ToolbarButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className="explorer-tool" title={label} aria-label={label} disabled={disabled} onClick={onClick}>{children}</button>;
}

function SearchToggle({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={`explorer-toggle${active ? " explorer-toggle--active" : ""}`} title={label} aria-label={label}
    aria-pressed={active} onClick={onClick}>{children}</button>;
}

function CopyMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("button")?.focus();
    const close = (event: Event): void => { if (!ref.current?.contains(event.target as Node)) onClose(); };
    const escape = (event: globalThis.KeyboardEvent): void => { if (event.key === "Escape") onClose(); };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    window.addEventListener("blur", onClose);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", escape); window.removeEventListener("blur", onClose); };
  }, [onClose]);
  return <div ref={ref} className="explorer-menu" role="menu" style={{ left: Math.min(menu.x, window.innerWidth - 200), top: Math.min(menu.y, window.innerHeight - 110) }}>
    {menu.items.map((item) => <button key={item.label} type="button" role="menuitem"
      onClick={() => { void navigator.clipboard.writeText(item.text).catch(() => undefined); onClose(); }}>{item.label}</button>)}
  </div>;
}
