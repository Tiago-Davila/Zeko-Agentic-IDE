/*
 * Iconos propios en SVG: el MVP no incorpora una libreria de iconos y la app corre
 * sin red, asi que se dibujan los pocos que hacen falta.
 */
const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function TemplateIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 9v12" />
    </svg>
  );
}

export function AgentIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 8V4M8 14h.01M16 14h.01M9 18h6" />
    </svg>
  );
}

export function SkillIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M12 3l2.6 5.6 6.4.7-4.8 4.2 1.4 6.1L12 16.6 6.4 19.6l1.4-6.1L3 9.3l6.4-.7z" />
    </svg>
  );
}

export function TaskIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  );
}

export function ExecutionIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 8.5l6 3.5-6 3.5z" />
    </svg>
  );
}

export function ApprovalIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M12 3l7.5 3v5.5c0 4.4-3 8.2-7.5 9.5-4.5-1.3-7.5-5.1-7.5-9.5V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function FitIcon() {
  return (
    <svg {...base} width={15} height={15} aria-hidden="true">
      <path d="M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4" />
    </svg>
  );
}

export function ZoomInIcon() {
  return (
    <svg {...base} width={15} height={15} aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M11 8.5v5M8.5 11h5M15.8 15.8L20 20" />
    </svg>
  );
}

export function ZoomOutIcon() {
  return (
    <svg {...base} width={15} height={15} aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M8.5 11h5M15.8 15.8L20 20" />
    </svg>
  );
}

export function ResetLayoutIcon() {
  return (
    <svg {...base} width={15} height={15} aria-hidden="true">
      <path d="M4 5v5h5" />
      <path d="M4.6 14a7.5 7.5 0 103-8.4L4 10" />
    </svg>
  );
}

export function MinimapIcon() {
  return (
    <svg {...base} width={15} height={15} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <rect x="12" y="11" width="7" height="6" rx="1" />
    </svg>
  );
}
