import type { ReactNode } from "react";

function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return <svg className={className ?? "explorer-icon"} viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor"
    strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

export const ChevronIcon = ({ open }: { open: boolean }) =>
  <Icon className={`explorer-icon explorer-chevron${open ? " explorer-chevron--open" : ""}`}><path d="m6 4 4 4-4 4" /></Icon>;
export const FolderIcon = ({ open }: { open: boolean }) => open
  ? <Icon><path d="M1.8 12.5V4a1 1 0 0 1 1-1h3.1l1.4 1.5h5.4a1 1 0 0 1 1 1v1.2" /><path d="M1.8 12.5 3.6 7.2a1 1 0 0 1 .95-.7h9.6a.6.6 0 0 1 .57.8l-1.6 4.6a.9.9 0 0 1-.85.6H1.8Z" /></Icon>
  : <Icon><path d="M1.8 4a1 1 0 0 1 1-1h3.1l1.4 1.5h5.9a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1Z" /></Icon>;
export const FileIcon = () => <Icon><path d="M4 1.8h5l3 3v9.4H4Z" /><path d="M9 1.8v3h3" /></Icon>;
export const LinkIcon = () => <Icon><path d="M6.7 9.3a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.6.6" /><path d="M9.3 6.7a2.6 2.6 0 0 0-3.7 0L3.4 8.9a2.6 2.6 0 0 0 3.7 3.7l.6-.6" /></Icon>;
export const RefreshIcon = () => <Icon><path d="M13.2 8A5.2 5.2 0 1 1 11.6 4.3" /><path d="M13.2 2.6v3.2H10" /></Icon>;
export const CollapseIcon = () => <Icon><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" /><path d="M5.5 8h5" /></Icon>;
export const FilterIcon = () => <Icon><path d="M2.5 4h11M4.5 8h7M6.5 12h3" /></Icon>;
export const SearchIcon = () => <Icon><circle cx="7" cy="7" r="4.3" /><path d="m10.2 10.2 3.3 3.3" /></Icon>;
export const CloseIcon = () => <Icon><path d="m4.5 4.5 7 7M11.5 4.5l-7 7" /></Icon>;
export const DetailsIcon = () => <Icon><circle cx="4" cy="8" r=".6" /><circle cx="8" cy="8" r=".6" /><circle cx="12" cy="8" r=".6" /></Icon>;
