import { Handle, Position } from "@xyflow/react";
import type { ReactNode } from "react";
import type { StateTone } from "./state-tone.js";

export type NodeAccent = "lime" | "cyan" | "violet" | "magenta" | "slate";

interface NodeShellProps {
  // Short type label above the title.
  kind: string;
  accent: NodeAccent;
  icon: ReactNode;
  title: string;
  subtitle?: string | undefined;
  badges?: ReactNode;
  // Live run tone; the LED only shows while the node has a state.
  tone?: StateTone | undefined;
  selected?: boolean;
  issue?: "error" | "warning" | undefined;
  hasTarget?: boolean;
  hasSource?: boolean;
  ariaLabel?: string | undefined;
}

export function NodeShell({ kind, accent, icon, title, subtitle, badges, tone, selected = false, issue, hasTarget = false, hasSource = false, ariaLabel }: NodeShellProps) {
  return <div aria-label={ariaLabel} className={`node-shell${selected ? " node-shell--selected" : ""}${issue ? ` node-shell--${issue}` : ""}`}>
    {hasTarget && <Handle type="target" position={Position.Left} className="node-shell__handle" />}
    <div className={`node-shell__tile node-shell__tile--${accent}`}>{icon}</div>
    <div className="node-shell__body">
      <span className="node-shell__kind">{kind}</span>
      <span className="node-shell__title" title={title}>{title}</span>
      {subtitle && <span className="node-shell__subtitle" title={subtitle}>{subtitle}</span>}
      {badges && <div className="node-shell__badges">{badges}</div>}
    </div>
    {tone && <span aria-hidden="true" className={`node-shell__led node-shell__led--${tone}`} />}
    {hasSource && <Handle type="source" position={Position.Right} className="node-shell__handle" />}
  </div>;
}
