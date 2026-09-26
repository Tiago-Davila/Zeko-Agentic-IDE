import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowNode } from "@zeko/contracts";
import { useT } from "../i18n/use-t.js";

export interface FlowNodeData extends Record<string, unknown> { flowNode: FlowNode }

export function InputCanvasNode({ data, selected }: NodeProps<import("@xyflow/react").Node<FlowNodeData>>) {
  return <NodeFrame kind="input" titleKey="canvas.inputNode" node={data.flowNode} selected={selected} />;
}

export function AgentCanvasNode({ data, selected }: NodeProps<import("@xyflow/react").Node<FlowNodeData>>) {
  return <NodeFrame kind="agent" titleKey="canvas.agentNode" node={data.flowNode} selected={selected} />;
}

export function ApprovalCanvasNode({ data, selected }: NodeProps<import("@xyflow/react").Node<FlowNodeData>>) {
  return <NodeFrame kind="approval" titleKey="canvas.approvalNode" node={data.flowNode} selected={selected} />;
}

function NodeFrame({ kind, titleKey, node, selected }: { kind: FlowNode["type"]; titleKey: "canvas.inputNode" | "canvas.agentNode" | "canvas.approvalNode"; node: FlowNode; selected: boolean }) {
  const t = useT();
  const detail = node.type === "agent" ? node.agent : node.type === "input" ? node.objective : t("canvas.approvalDetail");
  return <div className={`flow-node flow-node--${kind}${selected ? " flow-node--selected" : ""}`}>
    <Handle className="flow-handle" type="target" position={Position.Left} />
    <div className="flow-node__top"><span className="flow-node__type">{t(titleKey)}</span><span className={`flow-node__glyph flow-node__glyph--${kind}`} aria-hidden="true">{kind === "input" ? "↳" : kind === "agent" ? "◇" : "✓"}</span></div>
    <strong className="flow-node__name">{node.label || t(titleKey)}</strong>
    <span className="flow-node__detail">{detail}</span>
    <Handle className="flow-handle" type="source" position={Position.Right} />
  </div>;
}
