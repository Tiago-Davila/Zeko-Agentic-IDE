import type { NodeProps } from '@xyflow/react';

import { Badge } from '../../../design/Badge';
import { NodeShell } from '../../canvas/nodes/NodeShell';
import { TemplateIcon } from '../../canvas/nodes/icons';

export function AgentTemplateNode({ data, selected }: NodeProps) {
  const name = typeof data.name === 'string' ? data.name : 'Plantilla';
  const version = typeof data.version === 'number' ? data.version : null;
  const role = typeof data.role === 'string' && data.role.length > 0 ? data.role : undefined;

  return (
    <NodeShell
      kind="Plantilla"
      accent="violet"
      icon={<TemplateIcon />}
      title={name}
      subtitle={role}
      selected={selected === true}
      hasSource
      badges={version === null ? undefined : <Badge tone="muted">v{version}</Badge>}
      ariaLabel={`Plantilla ${name}`}
    />
  );
}
