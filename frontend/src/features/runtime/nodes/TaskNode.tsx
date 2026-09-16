import type { NodeProps } from '@xyflow/react';

import { StatePill } from '../../../design/StatePill';
import { NodeShell } from '../../canvas/nodes/NodeShell';
import { TaskIcon } from '../../canvas/nodes/icons';

export function TaskNode({ data, selected }: NodeProps) {
  const title = typeof data.title === 'string' ? data.title : 'Tarea';
  const state = typeof data.state === 'string' ? data.state : '';

  return (
    <NodeShell
      kind="Tarea"
      accent="violet"
      icon={<TaskIcon />}
      title={title}
      state={state}
      selected={selected === true}
      hasSource
      badges={state === '' ? undefined : <StatePill state={state} dense />}
      ariaLabel={`Tarea ${title}`}
    />
  );
}
