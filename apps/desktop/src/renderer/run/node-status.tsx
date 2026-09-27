import { useState } from "react";
import type { LiveNodeState } from "./run-state-store.js";
import { useT } from "../i18n/use-t.js";
import { toneOf } from "../canvas/state-tone.js";

interface NodeStatusProps { state: LiveNodeState | null | undefined }

export function NodeStatus({ state }: NodeStatusProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  if (!state) return null;
  const key = `status.${state.status}` as const;
  const expandable = Boolean(state.reason || state.hold);
  return <>
    <button type="button" className={`state-pill state-pill--${toneOf(state.status)} nodrag`} aria-expanded={expandable ? expanded : undefined} onClick={() => setExpanded((value) => !value)}>
      <span className="state-pill__dot" aria-hidden="true" />{t(key)}
      {expandable && <span className="state-pill__chevron" aria-hidden="true">{expanded ? "−" : "+"}</span>}
    </button>
    {state.hold && <span className="canvas-badge canvas-badge--warn">{t("status.usageHold")}</span>}
    {expanded && expandable && <p className="node-shell__reason">
      {state.reason ? t(state.reason.code, state.reason.params as Record<string, string | number>) : t("status.usageHoldReason")}
    </p>}
  </>;
}
