import { useState, type ReactNode } from 'react';
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeChange,
  type NodeTypes,
} from '@xyflow/react';

import { toneOf } from '../../design/stateTone';
import { CanvasToolbar } from './CanvasToolbar';
import { ConfigEdge } from './edges/ConfigEdge';

interface FlowCanvasProps {
  readonly label: string;
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly nodeTypes: NodeTypes;
  readonly onNodesChange: (changes: NodeChange[]) => void;
  readonly onResetLayout: () => void;
  // Alternativa accesible para entornos sin ReactFlow, como jsdom.
  readonly fallback: ReactNode;
  readonly emptyState?: ReactNode | undefined;
  readonly overlay?: ReactNode | undefined;
  /*
   * Solo se habilita donde la arista es estado local de presentación. En Agents y Runtime
   * queda apagado porque una arista ahí implicaría un binding o una dependencia real.
   */
  readonly connectable?: boolean | undefined;
  readonly onConnect?: ((connection: Connection) => void) | undefined;
}

const defaultEdgeTypes: EdgeTypes = { config: ConfigEdge };

const minimapTones: Record<string, string> = {
  pending: 'var(--color-state-pending)',
  running: 'var(--color-state-running)',
  waiting: 'var(--color-state-waiting)',
  completed: 'var(--color-state-completed)',
  failed: 'var(--color-state-failed)',
  cancelled: 'var(--color-state-cancelled)',
  blocked: 'var(--color-state-blocked)',
};

export function FlowCanvas({
  label,
  nodes,
  edges,
  nodeTypes,
  onNodesChange,
  onResetLayout,
  fallback,
  emptyState,
  overlay,
  connectable = false,
  onConnect,
}: FlowCanvasProps) {
  const [minimapVisible, setMinimapVisible] = useState(true);

  // jsdom no implementa ResizeObserver y ReactFlow no puede medir el contenedor.
  // El sustituto conserva el overlay: es texto explicativo, no cromo decorativo.
  if (typeof ResizeObserver === 'undefined') {
    return (
      <div aria-label={label} className="flex-1">
        {overlay}
        {fallback}
      </div>
    );
  }

  return (
    <div aria-label={label} className="relative min-h-0 flex-1 bg-ink-950">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes as Node[]}
          edges={edges as Edge[]}
          nodeTypes={nodeTypes}
          edgeTypes={defaultEdgeTypes}
          onNodesChange={onNodesChange}
          fitView
          fitViewOptions={{ padding: 0.24 }}
          minZoom={0.25}
          maxZoom={2}
          snapToGrid
          snapGrid={[16, 16]}
          panOnScroll
          selectionOnDrag
          nodesDraggable
          nodesConnectable={connectable}
          {...(onConnect === undefined ? {} : { onConnect })}
          elementsSelectable
          deleteKeyCode={null}
          proOptions={{ hideAttribution: false }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
          {minimapVisible ? (
            <MiniMap
              pannable
              zoomable
              ariaLabel="Minimapa del canvas"
              maskColor="var(--xy-minimap-mask-background-color)"
              style={{ width: 168, height: 112 }}
              nodeColor={(node) =>
                minimapTones[toneOf(typeof node.data.state === 'string' ? node.data.state : '')] ??
                'var(--color-ink-600)'
              }
              className="!bottom-3 !right-3 !m-0 overflow-hidden !rounded-[var(--radius-panel)] !border !border-ink-700"
            />
          ) : null}
          <div className="absolute top-3 left-3 z-10">
            <CanvasToolbar
              nodeCount={nodes.length}
              onResetLayout={onResetLayout}
              minimapVisible={minimapVisible}
              onToggleMinimap={() => setMinimapVisible((visible) => !visible)}
            />
          </div>
          {overlay === undefined ? null : <div className="absolute top-3 right-3 z-10">{overlay}</div>}
        </ReactFlow>
      </ReactFlowProvider>

      {nodes.length === 0 && emptyState !== undefined ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto">{emptyState}</div>
        </div>
      ) : null}
    </div>
  );
}
