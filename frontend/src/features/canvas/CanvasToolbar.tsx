import { useReactFlow } from '@xyflow/react';

import { IconButton } from '../../design/IconButton';
import { Toolbar, ToolbarSeparator } from '../../design/Toolbar';
import { FitIcon, MinimapIcon, ResetLayoutIcon, ZoomInIcon, ZoomOutIcon } from './nodes/icons';

interface CanvasToolbarProps {
  readonly nodeCount: number;
  readonly onResetLayout: () => void;
  readonly minimapVisible: boolean;
  readonly onToggleMinimap: () => void;
}

// Debe renderizarse dentro de ReactFlow: usa useReactFlow.
export function CanvasToolbar({
  nodeCount,
  onResetLayout,
  minimapVisible,
  onToggleMinimap,
}: CanvasToolbarProps) {
  const flow = useReactFlow();

  return (
    <Toolbar label="Controles del canvas" floating>
      <IconButton label="Ajustar a la vista" onClick={() => void flow.fitView({ padding: 0.2, duration: 200 })}>
        <FitIcon />
      </IconButton>
      <IconButton label="Acercar" onClick={() => void flow.zoomIn({ duration: 150 })}>
        <ZoomInIcon />
      </IconButton>
      <IconButton label="Alejar" onClick={() => void flow.zoomOut({ duration: 150 })}>
        <ZoomOutIcon />
      </IconButton>
      <ToolbarSeparator />
      <IconButton label="Reordenar nodos" onClick={onResetLayout}>
        <ResetLayoutIcon />
      </IconButton>
      <IconButton label="Mostrar minimapa" active={minimapVisible} onClick={onToggleMinimap}>
        <MinimapIcon />
      </IconButton>
      <ToolbarSeparator />
      <span className="px-1.5 text-[11px] text-chalk-400">
        {nodeCount} {nodeCount === 1 ? 'nodo' : 'nodos'}
      </span>
    </Toolbar>
  );
}
