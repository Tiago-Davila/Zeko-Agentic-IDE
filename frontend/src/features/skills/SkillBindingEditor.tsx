import { bindSkill, type SkillBindingDto, type SkillDto } from './skillApi';

interface SkillBindingEditorProps {
  readonly instanceId: string | null;
  readonly skills: readonly SkillDto[];
  readonly boundSkillIds: ReadonlySet<string>;
  readonly onBound: (binding: SkillBindingDto) => void;
}

export function SkillBindingEditor({ instanceId, skills, boundSkillIds, onBound }: SkillBindingEditorProps) {
  async function bind(skill: SkillDto) {
    if (instanceId === null || boundSkillIds.has(skill.id)) return;
    const binding = await bindSkill(instanceId, skill.id);
    onBound(binding);
  }

  if (instanceId === null) return <p>Seleccioná una instancia para asociar skills.</p>;
  return <section aria-label="Asociaciones de skills">
    <h4>Skills de la instancia</h4>
    <ul>{skills.map((skill) => <li key={skill.id}><span>{skill.name}</span>{boundSkillIds.has(skill.id) ? <strong> Asociada</strong> : <button type="button" onClick={() => void bind(skill)}>Asociar</button>}</li>)}</ul>
  </section>;
}
