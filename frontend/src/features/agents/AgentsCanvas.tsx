import { useEffect, useMemo, useState } from 'react';
import type { Edge, NodeTypes } from '@xyflow/react';

import { Badge } from '../../design/Badge';
import { Button } from '../../design/Button';
import { EmptyState } from '../../design/EmptyState';
import { Field } from '../../design/Field';
import { Panel } from '../../design/Panel';
import { StatePill } from '../../design/StatePill';
import { InspectorPanel } from '../../app/shell/InspectorPanel';
import { FlowCanvas } from '../canvas/FlowCanvas';
import { useNodeLayout } from '../canvas/useNodeLayout';
import type { LayoutNode } from '../canvas/layout';
import { AgentTemplateEditor } from './AgentTemplateEditor';
import { createInstance, instances, templates, type AgentInstanceDto, type AgentTemplateDto } from './agentApi';
import { ModeSettings } from './ModeSettings';
import { AgentInstanceNode } from './nodes/AgentInstanceNode';
import { AgentTemplateNode } from './nodes/AgentTemplateNode';
import { SkillNode } from './nodes/SkillNode';
import { SkillPanel } from '../skills/SkillPanel';
import { skills, type SkillBindingDto, type SkillDto } from '../skills/skillApi';

const nodeTypes: NodeTypes = {
  agentTemplate: AgentTemplateNode,
  agentInstance: AgentInstanceNode,
  skill: SkillNode,
};

const TEMPLATE_PREFIX = 'template-';
const INSTANCE_PREFIX = 'instance-';
const SKILL_PREFIX = 'skill-';

export function AgentsCanvas({ projectId }: { readonly projectId: string | null }) {
  const [templatesList, setTemplatesList] = useState<readonly AgentTemplateDto[]>([]);
  const [instancesList, setInstancesList] = useState<readonly AgentInstanceDto[]>([]);
  const [skillsList, setSkillsList] = useState<readonly SkillDto[]>([]);
  const [pickedInstanceId, setPickedInstanceId] = useState<string | null>(null);
  const [boundSkillIds, setBoundSkillIds] = useState<ReadonlySet<string>>(new Set());
  const [identity, setIdentity] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (projectId === null) return;
    const loadInstances = typeof instances === 'function' ? instances(projectId) : Promise.resolve<readonly AgentInstanceDto[]>([]);
    const loadSkills = typeof skills === 'function' ? skills(projectId) : Promise.resolve<readonly SkillDto[]>([]);
    void Promise.allSettled([templates(projectId), loadInstances, loadSkills]).then(
      ([templateResult, instanceResult, skillResult]) => {
        setTemplatesList(templateResult.status === 'fulfilled' ? templateResult.value : []);
        const loaded = instanceResult.status === 'fulfilled' ? instanceResult.value : [];
        setInstancesList(loaded);
        setSkillsList(skillResult.status === 'fulfilled' ? skillResult.value : []);
        setBoundSkillIds(new Set());
        setPickedInstanceId(loaded[0]?.id ?? null);
      },
    );
  }, [projectId]);

  const source = useMemo<readonly LayoutNode[]>(() => [
    ...templatesList.map((template) => ({
      id: `${TEMPLATE_PREFIX}${template.id}`,
      type: 'agentTemplate',
      column: 0,
      data: { name: template.name, version: template.version, column: 0 },
    })),
    ...instancesList.map((instance) => ({
      id: `${INSTANCE_PREFIX}${instance.id}`,
      type: 'agentInstance',
      column: 1,
      data: {
        identity: instance.identity,
        state: instance.state,
        version: instance.selectedTemplateVersion,
        column: 1,
      },
    })),
    ...skillsList.map((skill) => ({
      id: `${SKILL_PREFIX}${skill.id}`,
      type: 'skill',
      column: 2,
      data: {
        name: skill.name,
        skillPath: skill.skillPath,
        scope: skill.scope,
        bound: boundSkillIds.has(skill.id),
        column: 2,
      },
    })),
  ], [boundSkillIds, instancesList, skillsList, templatesList]);

  const { nodes, onNodesChange, resetLayout } = useNodeLayout(source);

  /*
   * La instancia enfocada se deriva del canvas: si hay un nodo de instancia seleccionado,
   * manda ese; si no, el ultimo elegido desde la lista. Elegir desde la lista limpia la
   * seleccion del canvas para que las dos vias no se contradigan.
   */
  const canvasSelection = nodes.find((node) => node.selected === true && node.type === 'agentInstance');
  const selectedInstanceId = canvasSelection === undefined
    ? pickedInstanceId
    : canvasSelection.id.slice(INSTANCE_PREFIX.length);

  function pickInstance(instanceId: string) {
    setPickedInstanceId(instanceId);
    const selectedNodes = nodes.filter((node) => node.selected === true);
    if (selectedNodes.length > 0) {
      onNodesChange(selectedNodes.map((node) => ({ id: node.id, type: 'select' as const, selected: false })));
    }
  }

  const edges = useMemo<Edge[]>(() => [
    ...instancesList.map((instance) => ({
      id: `template-to-instance-${instance.id}`,
      source: `${TEMPLATE_PREFIX}${instance.templateId}`,
      target: `${INSTANCE_PREFIX}${instance.id}`,
      type: 'config',
      label: `usa versión ${String(instance.selectedTemplateVersion)}`,
    })),
    ...(selectedInstanceId === null
      ? []
      : skillsList
          .filter((skill) => boundSkillIds.has(skill.id))
          .map((skill) => ({
            id: `instance-to-skill-${selectedInstanceId}-${skill.id}`,
            source: `${INSTANCE_PREFIX}${selectedInstanceId}`,
            target: `${SKILL_PREFIX}${skill.id}`,
            type: 'config',
            label: 'aporta contexto',
          }))),
  ], [boundSkillIds, instancesList, selectedInstanceId, skillsList]);

  async function addInstance(template: AgentTemplateDto) {
    if (projectId === null) return;
    try {
      const created = await createInstance(projectId, template.versionId, identity.trim() || `${template.name} principal`);
      setInstancesList((current) => [...current, created]);
      setPickedInstanceId(created.id);
      setIdentity('');
      setError('');
    } catch {
      setError('No se pudo crear la instancia.');
    }
  }

  function bound(binding: SkillBindingDto) {
    setBoundSkillIds((current) => new Set(current).add(binding.skillDefinitionId));
  }

  if (projectId === null) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <EmptyState
          title="Seleccioná un proyecto."
        />
      </div>
    );
  }

  return (
    <section aria-label="Diseño de agentes" className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <FlowCanvas
          label="Grafo de agentes"
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onResetLayout={resetLayout}
          fallback={
            <div role="img" aria-label="Relaciones de agentes">
              <ul>
                {edges.map((edge) => (
                  <li key={edge.id}>{edge.label}</li>
                ))}
              </ul>
            </div>
          }
          emptyState={
            <EmptyState title="Sin plantillas ni instancias." />
          }
        />
      </div>

      <InspectorPanel
        label="Inspector de agentes"
        heading="Inspector"
        subheading={
          selectedInstanceId === null
            ? 'Sin instancia seleccionada'
            : `Instancia ${instancesList.find((item) => item.id === selectedInstanceId)?.identity ?? selectedInstanceId}`
        }
      >
        <Panel heading="Nueva plantilla">
          <AgentTemplateEditor
            projectId={projectId}
            onCreated={(item) => setTemplatesList((current) => [...current, item])}
          />
        </Panel>

        <Panel heading="Plantillas">
          <Field
            label="Identidad de la instancia"
            aria-label="Identidad de la instancia"
            value={identity}
            onChange={(event) => setIdentity(event.target.value)}
            placeholder="Revisor de contratos"
          />
          {templatesList.length === 0 ? (
            <p className="mt-3 text-xs text-chalk-400">Sin plantillas.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {templatesList.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-ink-700 bg-ink-850 px-2 py-1.5"
                >
                  <span className="min-w-0 truncate text-xs text-chalk-200">
                    {item.name} · versión {item.version}
                  </span>
                  <Button size="sm" variant="primary" onClick={() => void addInstance(item)}>
                    Crear instancia
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel heading="Instancias">
          {instancesList.length === 0 ? (
            <p className="text-xs text-chalk-400">Sin instancias.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {instancesList.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={selectedInstanceId === item.id}
                    onClick={() => pickInstance(item.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border px-2 py-1.5 text-left transition-colors ${
                      selectedInstanceId === item.id
                        ? 'border-spray-lime/50 bg-spray-lime/10'
                        : 'border-ink-700 bg-ink-850 hover:border-ink-600'
                    }`}
                  >
                    <span className="min-w-0 truncate text-xs text-chalk-100">{item.identity}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      <Badge tone="muted">v{item.selectedTemplateVersion}</Badge>
                      <StatePill state={item.state} dense />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <ModeSettings instanceId={selectedInstanceId} />
        <SkillPanel
          projectId={projectId}
          instanceId={selectedInstanceId}
          boundSkillIds={boundSkillIds}
          onBound={bound}
        />
        {error ? (
          <p role="alert" className="text-xs text-state-failed">
            {error}
          </p>
        ) : null}
      </InspectorPanel>
    </section>
  );
}
