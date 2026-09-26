import { useState } from "react";
import type { LiveNodeState } from "./run-state-store.js";
import { useT } from "../i18n/use-t.js";

interface NodeStatusProps { state: LiveNodeState | null | undefined }

export function NodeStatus({ state }: NodeStatusProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  if (!state) return null;
  const key = `status.${state.status}` as const;
  return <div className={`live-node-status live-node-status--${state.status}`}>
    <button type="button" className="live-node-status__button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
      <span className="live-node-status__dot" aria-hidden="true" />{t(key)}{state.hold && <span className="live-node-status__hold">{t("status.usageHold")}</span>}
      {(state.reason || state.hold) && <span className="live-node-status__chevron" aria-hidden="true">{expanded ? "−" : "+"}</span>}
    </button>
    {expanded && (state.reason || state.hold) && <p className="live-node-status__reason">
      {state.reason ? t(state.reason.code, state.reason.params as Record<string, string | number>) : t("status.usageHoldReason")}
    </p>}
  </div>;
}
