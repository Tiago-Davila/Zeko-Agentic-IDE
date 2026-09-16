import type { NodeProps } from '@xyflow/react';

import { Badge } from '../../../design/Badge';
import { NodeShell } from '../../canvas/nodes/NodeShell';
import { SkillIcon } from '../../canvas/nodes/icons';

export function SkillNode({ data, selected }: NodeProps) {
  const name = typeof data.name === 'string' ? data.name : 'Skill';
  const skillPath = typeof data.skillPath === 'string' ? data.skillPath : undefined;
  const scope = typeof data.scope === 'string' ? data.scope : null;
  const bound = data.bound === true;

  return (
    <NodeShell
      kind="Skill"
      accent="cyan"
      icon={<SkillIcon />}
      title={name}
      subtitle={skillPath}
      selected={selected === true}
      hasTarget
      badges={
        <>
          {scope === null ? null : <Badge tone="muted">{scope}</Badge>}
          {bound ? <Badge tone="info">Asociada</Badge> : null}
        </>
      }
      ariaLabel={`Skill ${name}`}
    />
  );
}
