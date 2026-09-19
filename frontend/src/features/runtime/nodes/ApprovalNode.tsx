import type { NodeProps } from '@xyflow/react';

import { StatePill } from '../../../design/StatePill';
import { NodeShell } from '../../canvas/nodes/NodeShell';
import { ApprovalIcon } from '../../canvas/nodes/icons';

export function ApprovalNode({ data, selected }: NodeProps) {
  const action = typeof data.action === 'string' ? data.action : 'Acción';
  const resource = typeof data.resource === 'string' ? data.resource : undefined;
  const state = typeof data.state === 'string' ? data.state : '';

  return (
    <NodeShell
      kind="Aprobación"
      accent="magenta"
      icon={<ApprovalIcon />}
      title={action}
      subtitle={resource}
      state={state}
      selected={selected === true}
      hasTarget
      badges={state === '' ? undefined : <StatePill state={state} dense />}
      ariaLabel={`Aprobación ${action}`}
    />
  );
}
