import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Diagnostic, FlowNode } from "@zeko/contracts";
import type { NodeView } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";
import { NodeBadges } from "./node-badges.js";

export interface FlowNodeData extends Record<string, unknown> { flowNode: FlowNode; diagnostics?: Diagnostic[]; nodeView?: NodeView | null }

export function InputCanvasNode({ data, selected }: NodeProps<import("@xyflow/react").Node<FlowNodeData>>) {
  return <NodeFrame kind="input" titleKey="canvas.inputNode" node={data.flowNode} selected={selected} diagnostics={data.diagnostics ?? []} nodeView={data.nodeView ?? null} />;
}

export function AgentCanvasNode({ data, selected }: NodeProps<import("@xyflow/react").Node<FlowNodeData>>) {
  return <NodeFrame kind="agent" titleKey="canvas.agentNode" node={data.flowNode} selected={selected} diagnostics={data.diagnostics ?? []} nodeView={data.nodeView ?? null} />;
}

export function ApprovalCanvasNode({ data, selected }: NodeProps<import("@xyflow/react").Node<FlowNodeData>>) {
  return <NodeFrame kind="approval" titleKey="canvas.approvalNode" node={data.flowNode} selected={selected} diagnostics={data.diagnostics ?? []} nodeView={data.nodeView ?? null} />;
}

function NodeFrame({ kind, titleKey, node, selected, diagnostics = [], nodeView }: { kind: FlowNode["type"]; titleKey: "canvas.inputNode" | "canvas.agentNode" | "canvas.approvalNode"; node: FlowNode; selected: boolean; diagnostics?: Diagnostic[]; nodeView: NodeView | null }) {
  const t = useT();
  const detail = node.type === "agent" ? node.agent : node.type === "input" ? node.objective : t("canvas.approvalDetail");
  return <div className={`flow-node flow-node--${kind}${selected ? " flow-node--selected" : ""}${diagnostics.some((item) => item.severity === "error") ? " flow-node--invalid" : diagnostics.length ? " flow-node--warning" : ""}`}>
    <Handle className="flow-handle" type="target" position={Position.Left} />
    <div className="flow-node__top"><span className="flow-node__type">{t(titleKey)}</span><span className={`flow-node__glyph flow-node__glyph--${kind}`} aria-hidden="true">{kind === "input" ? "↳" : kind === "agent" ? "◇" : "✓"}</span></div>
    <strong className="flow-node__name">{node.label || t(titleKey)}</strong>
    <span className="flow-node__detail">{detail}</span>
    {diagnostics.length > 0 && <span className="flow-node__diagnostics" title={diagnostics.map((item) => t(item.code)).join(" · ")}>
      <span aria-hidden="true">{diagnostics.some((item) => item.severity === "error") ? "!" : "i"}</span>{t("validation.nodeCount", { count: diagnostics.length })}
    </span>}
    <NodeBadges nodeView={nodeView} />
    <Handle className="flow-handle" type="source" position={Position.Right} />
  </div>;
}
