import type { ReactNode } from "react";
import type { FlowNode } from "@zeko/contracts";
import { useT } from "../i18n/use-t.js";
import { AgentIcon, ApprovalIcon, TaskIcon } from "./canvas-icons.js";

/** Drag payload type; the canvas reads it on drop to place the node under the cursor. */
export const NODE_DRAG_TYPE = "application/x-zeko-node";

type Entry = { type: FlowNode["type"]; icon: ReactNode; labelKey: "canvas.addInput" | "canvas.addAgent" | "canvas.addApproval"; hintKey: "palette.inputHint" | "palette.agentHint" | "palette.approvalHint" };

const entries: Entry[] = [
  { type: "input", icon: <TaskIcon />, labelKey: "canvas.addInput", hintKey: "palette.inputHint" },
  { type: "agent", icon: <AgentIcon />, labelKey: "canvas.addAgent", hintKey: "palette.agentHint" },
  { type: "approval", icon: <ApprovalIcon />, labelKey: "canvas.addApproval", hintKey: "palette.approvalHint" },
];

/** Mirror of the workspace rail on the right edge: icons only until hovered, then the node catalogue slides out. */
export function NodePalette({ onAdd }: { onAdd: (type: FlowNode["type"]) => void }) {
  const t = useT();
  return <nav className="node-palette" aria-label={t("palette.title")}>
    <div className="node-palette__panel">
      <p className="node-palette__caption"><span className="workspace-rail__label">{t("palette.title")}</span></p>
      {entries.map((entry) => <button key={entry.type} type="button" draggable className={`node-palette__item node-palette__item--${entry.type}`}
        aria-label={t(entry.labelKey)} title={t(entry.labelKey)} onClick={() => onAdd(entry.type)}
        onDragStart={(event) => { event.dataTransfer.setData(NODE_DRAG_TYPE, entry.type); event.dataTransfer.effectAllowed = "copy"; }}>
        <span className="node-palette__tile">{entry.icon}</span>
        <span className="node-palette__text"><strong>{t(entry.labelKey)}</strong><small>{t(entry.hintKey)}</small></span>
      </button>)}
    </div>
  </nav>;
}
