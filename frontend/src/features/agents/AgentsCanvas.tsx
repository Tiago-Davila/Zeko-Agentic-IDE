import { useEffect, useMemo, useState } from 'react';
import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { AgentTemplateEditor } from './AgentTemplateEditor';
import { createInstance, instances, templates, type AgentInstanceDto, type AgentTemplateDto } from './agentApi';
import { ModeSettings } from './ModeSettings';
import { SkillPanel } from '../skills/SkillPanel';
import type { SkillBindingDto } from '../skills/skillApi';

export function AgentsCanvas({ projectId }: { readonly projectId: string | null }) {
  const [templatesList, setTemplatesList] = useState<readonly AgentTemplateDto[]>([]);
  const [instancesList, setInstancesList] = useState<readonly AgentInstanceDto[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [boundSkillIds, setBoundSkillIds] = useState<ReadonlySet<string>>(new Set());
  const [identity, setIdentity] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (projectId === null) return;
    const loadInstances = typeof instances === 'function' ? instances(projectId) : Promise.resolve<readonly AgentInstanceDto[]>([]);
    void Promise.allSettled([templates(projectId), loadInstances]).then(([templateResult, instanceResult]) => {
      setTemplatesList(templateResult.status === 'fulfilled' ? templateResult.value : []);
      const loaded = instanceResult.status === 'fulfilled' ? instanceResult.value : [];
      setInstancesList(loaded);
      setBoundSkillIds(new Set());
      setSelectedInstanceId(loaded[0]?.id ?? null);
    });
  }, [projectId]);

  const nodes = useMemo<Node[]>(() => [
    ...templatesList.map((template, index) => ({
      id: `template-${template.id}`,
      position: { x: 40, y: index * 130 + 30 },
      data: { label: `Plantilla: ${template.name}\nVersión ${template.version}` },
      type: 'default',
    })),
    ...instancesList.map((instance, index) => ({
      id: `instance-${instance.id}`,
      position: { x: 380, y: index * 130 + 30 },
      data: { label: `Instancia: ${instance.identity}\nEstado ${instance.state}` },
      type: 'default',
    })),
  ], [instancesList, templatesList]);

  const edges = useMemo<Edge[]>(() => instancesList.map((instance) => ({
    id: `template-to-instance-${instance.id}`,
    source: `template-${instance.templateId}`,
    target: `instance-${instance.id}`,
    label: `usa versión ${instance.selectedTemplateVersion}`,
    animated: false,
  })), [instancesList]);

  async function addInstance(template: AgentTemplateDto) {
    if (projectId === null) return;
    try {
      const created = await createInstance(projectId, template.versionId, identity.trim() || `${template.name} principal`);
      setInstancesList((current) => [...current, created]);
      setSelectedInstanceId(created.id);
      setIdentity('');
      setError('');
    } catch {
      setError('No se pudo crear la instancia local de la plantilla.');
    }
  }

  function bound(binding: SkillBindingDto) {
    setBoundSkillIds((current) => new Set(current).add(binding.skillDefinitionId));
  }

  if (projectId === null) return <p>Seleccioná un proyecto para diseñar agentes.</p>;
  return <section aria-label="Diseño de agentes">
    <h3>Agents Canvas</h3>
    <p>Las relaciones muestran configuración entre plantilla e instancia; ninguna arista ejecuta un workflow.</p>
    <div aria-label="Grafo de agentes" style={{ height: 360 }}>
      {typeof ResizeObserver === 'undefined' ? <div role="img" aria-label="Relaciones de agentes"><ul>{edges.map((edge) => <li key={edge.id}>{edge.label}</li>)}</ul></div> : <ReactFlow nodes={nodes} edges={edges} fitView nodesConnectable={false} nodesDraggable={false} elementsSelectable>
        <Background />
        <Controls />
      </ReactFlow>}
    </div>
    <section aria-label="Plantillas de agente">
      <h4>Plantillas de agente</h4>
      <AgentTemplateEditor projectId={projectId} onCreated={(item) => setTemplatesList((current) => [...current, item])} />
      <label>Identidad de la instancia<input aria-label="Identidad de la instancia" value={identity} onChange={(event) => setIdentity(event.target.value)} /></label>
      <ul>{templatesList.map((item) => <li key={item.id}><span>{item.name} · versión {item.version}</span><button type="button" onClick={() => void addInstance(item)}>Crear instancia</button></li>)}</ul>
    </section>
    <section aria-label="Instancias de agente">
      <h4>Instancias</h4>
      {instancesList.length === 0 ? <p>Aún no hay instancias en este proyecto.</p> : <ul>{instancesList.map((item) => <li key={item.id}><button type="button" aria-pressed={selectedInstanceId === item.id} onClick={() => setSelectedInstanceId(item.id)}>{item.identity}</button> · versión {item.selectedTemplateVersion} · {item.state}</li>)}</ul>}
    </section>
    <ModeSettings instanceId={selectedInstanceId} />
    <SkillPanel projectId={projectId} instanceId={selectedInstanceId} boundSkillIds={boundSkillIds} onBound={bound} />
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
