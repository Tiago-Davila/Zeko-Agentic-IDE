import type { NodeProps } from '@xyflow/react';

import { Badge } from '../../../design/Badge';
import { NodeShell } from '../../canvas/nodes/NodeShell';
import { ModuleIcon } from '../../canvas/nodes/icons';

export function ModuleNode({ data, selected }: NodeProps) {
  const name = typeof data.name === 'string' ? data.name : 'Módulo';
  const layer = typeof data.layer === 'string' ? data.layer : undefined;
  const repository = typeof data.repository === 'string' ? data.repository : null;

  return (
    <NodeShell
      kind="Módulo"
      accent="cyan"
      icon={<ModuleIcon />}
      title={name}
      subtitle={layer}
      selected={selected === true}
      hasTarget
      hasSource
      badges={repository === null ? undefined : <Badge tone="muted">{repository}</Badge>}
      ariaLabel={`Módulo ${name}`}
    />
  );
}
