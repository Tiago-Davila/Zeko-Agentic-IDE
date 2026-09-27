import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";

// Soft bezier edge ported from the previous canvas: neutral at rest, lime while selected.
export function ConfigEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, selected, markerEnd }: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.35 });
  return <>
    <BaseEdge id={id} path={path} {...(markerEnd === undefined ? {} : { markerEnd })}
      style={{ stroke: selected ? "var(--color-spray-lime)" : "var(--color-ink-600)", strokeWidth: selected ? 2 : 1.5 }} />
    {label !== undefined && label !== null && label !== "" && <EdgeLabelRenderer>
      <div className="config-edge__label" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>{label}</div>
    </EdgeLabelRenderer>}
  </>;
}
