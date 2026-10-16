/* Offline SVG glyphs for the editor side rails; drawn to match canvas-icons.tsx. */
const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function PlusIcon() {
  return <svg {...base} aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
}

export function HomeIcon() {
  return <svg {...base} aria-hidden="true">
    <path d="M4 11l8-6.5 8 6.5" />
    <path d="M6.5 9.5V19h11V9.5" />
  </svg>;
}

export function WorkflowIcon() {
  return <svg {...base} aria-hidden="true">
    <rect x="3.5" y="4" width="6" height="5" rx="1.2" />
    <rect x="14.5" y="15" width="6" height="5" rx="1.2" />
    <path d="M9.5 6.5h3a2 2 0 012 2v6.5" />
  </svg>;
}

export function HistoryIcon() {
  return <svg {...base} aria-hidden="true">
    <path d="M4 5v5h5" />
    <path d="M4.6 14a7.5 7.5 0 103-8.4L4 10" />
    <path d="M12 8.5V12l2.5 1.5" />
  </svg>;
}

export function SettingsIcon() {
  return <svg {...base} aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </svg>;
}

export function PlayIcon() {
  return <svg {...base} width={15} height={15} aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor" /></svg>;
}

export function SaveIcon() {
  return <svg {...base} width={15} height={15} aria-hidden="true">
    <path d="M5 4h11l3 3v12a1 1 0 01-1 1H6a1 1 0 01-1-1V5a1 1 0 011-1z" />
    <path d="M8 4v5h7V4M8 20v-6h8v6" />
  </svg>;
}
