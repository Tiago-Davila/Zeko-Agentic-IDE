import { useReactFlow } from "@xyflow/react";
import type { ReactNode } from "react";
import { useT } from "../i18n/use-t.js";
import { FitIcon, MinimapIcon, ResetLayoutIcon, ZoomInIcon, ZoomOutIcon } from "./canvas-icons.js";

interface CanvasToolbarProps {
  nodeCount: number;
  onResetLayout: () => void;
  minimapVisible: boolean;
  onToggleMinimap: () => void;
}

// Must render inside ReactFlow: it drives the viewport through useReactFlow.
export function CanvasToolbar({ nodeCount, onResetLayout, minimapVisible, onToggleMinimap }: CanvasToolbarProps) {
  const t = useT();
  const flow = useReactFlow();
  return <div className="canvas-controls" role="toolbar" aria-label={t("canvas.controls")} aria-orientation="horizontal">
    <IconButton label={t("canvas.fitView")} onClick={() => void flow.fitView({ padding: 0.2, duration: 200 })}><FitIcon /></IconButton>
    <IconButton label={t("canvas.zoomIn")} onClick={() => void flow.zoomIn({ duration: 150 })}><ZoomInIcon /></IconButton>
    <IconButton label={t("canvas.zoomOut")} onClick={() => void flow.zoomOut({ duration: 150 })}><ZoomOutIcon /></IconButton>
    <span className="canvas-controls__separator" aria-hidden="true" />
    <IconButton label={t("canvas.resetLayout")} onClick={onResetLayout}><ResetLayoutIcon /></IconButton>
    <IconButton label={t("canvas.showMinimap")} active={minimapVisible} onClick={onToggleMinimap}><MinimapIcon /></IconButton>
    <span className="canvas-controls__separator" aria-hidden="true" />
    <span className="canvas-controls__count">{t(nodeCount === 1 ? "canvas.nodeCountOne" : "canvas.nodeCount", { count: nodeCount })}</span>
  </div>;
}

function IconButton({ label, active = false, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={`canvas-icon-button${active ? " canvas-icon-button--active" : ""}`} aria-label={label} title={label} aria-pressed={active} onClick={onClick}>{children}</button>;
}
