import type { NodeProps } from '@xyflow/react';

import { StatePill } from '../../../design/StatePill';
import { NodeShell } from '../../canvas/nodes/NodeShell';
import { RepositoryIcon } from '../../canvas/nodes/icons';

export function RepositoryNode({ data, selected }: NodeProps) {
  const name = typeof data.name === 'string' ? data.name : 'Repositorio';
  const path = typeof data.path === 'string' ? data.path : undefined;
  const accessState = typeof data.accessState === 'string' ? data.accessState : '';

  return (
    <NodeShell
      kind="Repositorio"
      accent="violet"
      icon={<RepositoryIcon />}
      title={name}
      subtitle={path}
      state={accessState}
      selected={selected === true}
      hasSource
      badges={accessState === '' ? undefined : <StatePill state={accessState} dense />}
      ariaLabel={`Repositorio ${name}`}
    />
  );
}
