import type { NodeView } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";

interface NodeBadgesProps { nodeView: NodeView | null }

const confinementTone = { confined: "accent", write_only: "warn", unconfined: "danger" } as const;

export function NodeBadges({ nodeView }: NodeBadgesProps) {
  const t = useT();
  if (!nodeView) return null;
  const levelKey = nodeView.confinement.level === "confined" ? "confinement.confined"
    : nodeView.confinement.level === "write_only" ? "confinement.writeOnly" : "confinement.unconfined";
  const reasonKey = nodeView.confinement.reason === "CAN_READ_OUTSIDE_WORKSPACE" ? "confinement.reason.readOutside" : "confinement.reason.cannotConfine";
  return <>
    <span className={`canvas-badge canvas-badge--${confinementTone[nodeView.confinement.level]}`} aria-label={t("node.capabilities")}>
      <span className="canvas-badge__dot" aria-hidden="true" />{t(levelKey)}
    </span>
    {nodeView.confinement.reason && <span className="node-shell__note" title={t(reasonKey)}>{t(reasonKey)}</span>}
    {nodeView.warnings.map((warning) => <span className="canvas-badge canvas-badge--warn canvas-badge--clip" key={warning} title={t(warning)}>{t(warning)}</span>)}
  </>;
}
