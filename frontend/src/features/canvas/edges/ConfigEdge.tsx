import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';

/*
 * Arista de configuracion. Representa una relacion declarada entre piezas de diseno
 * y no un paso ejecutable: por eso no se anima ni sugiere direccion de ejecucion.
 */
export function ConfigEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  selected,
  markerEnd,
}: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.35,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        {...(markerEnd === undefined ? {} : { markerEnd })}
        style={{
          stroke: selected === true ? 'var(--color-spray-lime)' : 'var(--color-ink-600)',
          strokeWidth: selected === true ? 2 : 1.5,
        }}
      />
      {label === undefined || label === null || label === '' ? null : (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${String(labelX)}px, ${String(labelY)}px)` }}
            className="pointer-events-none absolute rounded-full border border-ink-700 bg-ink-900 px-1.5 py-0.5 text-[10px] text-chalk-400"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
