import type { NodeProps } from '@xyflow/react';

import { StatePill } from '../../../design/StatePill';
import { NodeShell } from '../../canvas/nodes/NodeShell';
import { AgentIcon } from '../../canvas/nodes/icons';

export function AgentInstanceNode({ data, selected }: NodeProps) {
  const identity = typeof data.identity === 'string' ? data.identity : 'Instancia';
  const state = typeof data.state === 'string' ? data.state : '';
  const version = typeof data.version === 'number' ? data.version : null;

  return (
    <NodeShell
      kind="Instancia"
      accent="lime"
      icon={<AgentIcon />}
      title={identity}
      subtitle={version === null ? undefined : `versión ${String(version)}`}
      state={state}
      selected={selected === true}
      hasTarget
      hasSource
      badges={state === '' ? undefined : <StatePill state={state} dense />}
      ariaLabel={`Instancia ${identity}`}
    />
  );
}
