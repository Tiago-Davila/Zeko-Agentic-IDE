import type { NodeProps } from '@xyflow/react';

import { Badge } from '../../../design/Badge';
import { StatePill } from '../../../design/StatePill';
import { NodeShell } from '../../canvas/nodes/NodeShell';
import { ExecutionIcon } from '../../canvas/nodes/icons';

export function ExecutionNode({ data, selected }: NodeProps) {
  const attempt = typeof data.attempt === 'number' ? data.attempt : 1;
  const state = typeof data.state === 'string' ? data.state : '';
  const knownState = typeof data.knownState === 'string' ? data.knownState : '';
  const effects = typeof data.effects === 'number' ? data.effects : 0;
  const provider = typeof data.provider === 'string' ? data.provider : null;

  return (
    <NodeShell
      kind="Ejecución"
      accent="cyan"
      icon={<ExecutionIcon />}
      title={`Intento ${String(attempt)}`}
      subtitle={knownState === '' ? undefined : knownState}
      state={state}
      selected={selected === true}
      hasTarget
      hasSource
      badges={
        <>
          {state === '' ? null : <StatePill state={state} dense />}
          {provider === null ? null : <Badge tone="muted">{provider}</Badge>}
          <Badge tone="muted">
            {effects} {effects === 1 ? 'efecto' : 'efectos'}
          </Badge>
        </>
      }
      ariaLabel={`Nodo de ejecución, intento ${String(attempt)}`}
    />
  );
}
