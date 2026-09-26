import type { NodeView } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";

interface NodeBadgesProps { nodeView: NodeView | null }

export function NodeBadges({ nodeView }: NodeBadgesProps) {
  const t = useT();
  if (!nodeView) return null;
  const levelKey = nodeView.confinement.level === "confined" ? "confinement.confined"
    : nodeView.confinement.level === "write_only" ? "confinement.writeOnly" : "confinement.unconfined";
  return <div className="node-badges" aria-label={t("node.capabilities")}>
    <span className={`confinement-badge confinement-badge--${nodeView.confinement.level}`}>
      <span className="confinement-badge__dot" aria-hidden="true" />{t(levelKey)}
    </span>
    {nodeView.confinement.reason && <span className="confinement-reason" title={t(nodeView.confinement.reason === "CAN_READ_OUTSIDE_WORKSPACE" ? "confinement.reason.readOutside" : "confinement.reason.cannotConfine")}>
      {t(nodeView.confinement.reason === "CAN_READ_OUTSIDE_WORKSPACE" ? "confinement.reason.readOutside" : "confinement.reason.cannotConfine")}
    </span>}
    {nodeView.warnings.map((warning) => <span className="capability-warning" key={warning} title={t(warning)}>{t(warning)}</span>)}
  </div>;
}
