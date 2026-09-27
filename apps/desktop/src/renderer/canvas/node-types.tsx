import type { Node, NodeProps } from "@xyflow/react";
import type { ReactNode } from "react";
import type { Diagnostic, FlowNode } from "@zeko/contracts";
import type { NodeView } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";
import { NodeBadges } from "./node-badges.js";
import type { LiveNodeState } from "../run/run-state-store.js";
import { NodeStatus } from "../run/node-status.js";
import { NodeShell, type NodeAccent } from "./node-shell.js";
import { toneOf } from "./state-tone.js";
import { AgentIcon, ApprovalIcon, TaskIcon } from "./canvas-icons.js";

export interface FlowNodeData extends Record<string, unknown> { flowNode: FlowNode; diagnostics?: Diagnostic[]; nodeView?: NodeView | null; liveState: LiveNodeState | null }

type TitleKey = "canvas.inputNode" | "canvas.agentNode" | "canvas.approvalNode";

// An input starts the flow, so it only exposes an outgoing handle (INPUT_HAS_PREDECESSOR).
const variants: Record<FlowNode["type"], { titleKey: TitleKey; accent: NodeAccent; icon: ReactNode; hasTarget: boolean }> = {
  input: { titleKey: "canvas.inputNode", accent: "violet", icon: <TaskIcon />, hasTarget: false },
  agent: { titleKey: "canvas.agentNode", accent: "lime", icon: <AgentIcon />, hasTarget: true },
  approval: { titleKey: "canvas.approvalNode", accent: "magenta", icon: <ApprovalIcon />, hasTarget: true },
};

export function FlowCanvasNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  const t = useT();
  const node = data.flowNode;
  const variant = variants[node.type];
  const diagnostics = data.diagnostics ?? [];
  const hasError = diagnostics.some((item) => item.severity === "error");
  const title = node.label || t(variant.titleKey);
  const subtitle = node.type === "agent" ? node.agent : node.type === "input" ? node.objective : t("canvas.approvalDetail");
  const badges = <>
    <NodeStatus state={data.liveState} />
    {diagnostics.length > 0 && <span className={`canvas-badge canvas-badge--${hasError ? "danger" : "warn"}`} title={diagnostics.map((item) => t(item.code)).join(" · ")}>
      {t("validation.nodeCount", { count: diagnostics.length })}
    </span>}
    <NodeBadges nodeView={data.nodeView ?? null} />
  </>;
  const hasBadges = Boolean(data.liveState) || diagnostics.length > 0 || Boolean(data.nodeView);
  return <NodeShell kind={t(variant.titleKey)} accent={variant.accent} icon={variant.icon} title={title} subtitle={subtitle}
    badges={hasBadges ? badges : undefined} tone={data.liveState ? toneOf(data.liveState.status) : undefined} selected={selected}
    issue={hasError ? "error" : diagnostics.length ? "warning" : undefined} hasTarget={variant.hasTarget} hasSource ariaLabel={`${t(variant.titleKey)} ${title}`} />;
}
