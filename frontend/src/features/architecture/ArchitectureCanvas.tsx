import { useMemo, useState, type FormEvent } from 'react';
import type { Edge, NodeTypes } from '@xyflow/react';

import { Button } from '../../design/Button';
import { EmptyState } from '../../design/EmptyState';
import { Field } from '../../design/Field';
import { Panel } from '../../design/Panel';
import { Select } from '../../design/Select';
import { InspectorPanel } from '../../app/shell/InspectorPanel';
import { FlowCanvas } from '../canvas/FlowCanvas';
import { useNodeLayout } from '../canvas/useNodeLayout';
import type { LayoutNode } from '../canvas/layout';
import type { ProjectDto, RepositoryDto } from '../projects/projectApi';
import { ModuleNode } from './nodes/ModuleNode';
import { RepositoryNode } from './nodes/RepositoryNode';

const nodeTypes: NodeTypes = {
  architectureRepository: RepositoryNode,
  architectureModule: ModuleNode,
};

const REPOSITORY_PREFIX = 'repo-';
const MODULE_PREFIX = 'module-';

const layers = ['domain', 'application', 'infrastructure', 'api'] as const;

// Identidad estable: un `[]` literal por render invalidaria los useMemo de nodos y aristas.
const NO_REPOSITORIES: readonly RepositoryDto[] = [];

interface ModuleDraft {
  readonly id: string;
  readonly name: string;
  readonly layer: string;
  readonly repositoryId: string;
}

interface ArchitectureCanvasProps {
  readonly project: ProjectDto | null;
}

/*
 * Superficie de arquitectura. Dibuja los repositorios reales del proyecto y deja declarar
 * modulos y dependencias entre ellos.
 *
 * Todo lo declarado vive solo en memoria: no existe endpoint para persistir un diagrama y
 * la UI no simula que lo haya. Tampoco genera codigo a partir del diagrama.
 */
export function ArchitectureCanvas({ project }: ArchitectureCanvasProps) {
  const [modules, setModules] = useState<readonly ModuleDraft[]>([]);
  const [dependencies, setDependencies] = useState<readonly Edge[]>([]);
  const [name, setName] = useState('');
  const [layer, setLayer] = useState<string>(layers[0]);
  const [repositoryId, setRepositoryId] = useState('');

  const repositories = project?.repositories ?? NO_REPOSITORIES;

  const source = useMemo<readonly LayoutNode[]>(() => [
    ...repositories.map((repository) => ({
      id: `${REPOSITORY_PREFIX}${repository.id}`,
      type: 'architectureRepository',
      column: 0,
      data: {
        name: basename(repository.path),
        path: repository.path,
        accessState: repository.accessState,
        column: 0,
      },
    })),
    ...modules.map((item) => ({
      id: `${MODULE_PREFIX}${item.id}`,
      type: 'architectureModule',
      column: 1,
      data: {
        name: item.name,
        layer: item.layer,
        repository: basename(repositories.find((repo) => repo.id === item.repositoryId)?.path ?? ''),
        column: 1,
      },
    })),
  ], [modules, repositories]);

  const { nodes, onNodesChange, resetLayout } = useNodeLayout(source);

  const edges = useMemo<Edge[]>(() => [
    ...modules
      .filter((item) => repositories.some((repo) => repo.id === item.repositoryId))
      .map((item) => ({
        id: `repo-to-module-${item.id}`,
        source: `${REPOSITORY_PREFIX}${item.repositoryId}`,
        target: `${MODULE_PREFIX}${item.id}`,
        type: 'config',
        label: 'contiene',
      })),
    ...dependencies,
  ], [dependencies, modules, repositories]);

  function addModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0 || repositoryId === '') return;
    setModules((current) => [
      ...current,
      { id: `${String(current.length + 1)}-${trimmed}`, name: trimmed, layer, repositoryId },
    ]);
    setName('');
  }

  if (project === null) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <EmptyState
          title="Seleccioná un proyecto."
        />
      </div>
    );
  }

  return (
    <section aria-label="Arquitectura del proyecto" className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <FlowCanvas
          label="Grafo de arquitectura"
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onResetLayout={resetLayout}
          connectable
          onConnect={(connection) => {
            if (connection.source === null || connection.target === null) return;
            setDependencies((current) => [
              ...current,
              {
                id: `dependency-${connection.source ?? ''}-${connection.target ?? ''}`,
                source: connection.source ?? '',
                target: connection.target ?? '',
                type: 'config',
                label: 'depende de',
              },
            ]);
          }}
          fallback={
            <div role="img" aria-label="Relaciones de arquitectura">
              <ul>
                {edges.map((edge) => (
                  <li key={edge.id}>{edge.label}</li>
                ))}
              </ul>
            </div>
          }
          emptyState={
            <EmptyState title="Sin repositorios." />
          }
          overlay={
            <span className="rounded-full border border-spray-magenta/50 bg-spray-magenta/10 px-2.5 py-1 text-[11px] text-spray-magenta">
              El diagrama no se guarda.
            </span>
          }
        />
      </div>

      <InspectorPanel
        label="Inspector de arquitectura"
        heading="Arquitectura"
        subheading={`${String(repositories.length)} repositorios · ${String(modules.length)} módulos declarados`}
      >
        <Panel heading="Declarar módulo">
          <form onSubmit={addModule} className="flex flex-col gap-3">
            <Field
              label="Nombre del módulo"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="executioncontrol"
              required
            />
            <Select label="Capa" value={layer} onChange={(event) => setLayer(event.target.value)}>
              {layers.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <Select
              label="Repositorio"
              value={repositoryId}
              onChange={(event) => setRepositoryId(event.target.value)}
              required
            >
              <option value="" disabled>
                Elegí un repositorio
              </option>
              {repositories.map((repository) => (
                <option key={repository.id} value={repository.id}>
                  {basename(repository.path)}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="primary" disabled={repositories.length === 0}>
              Agregar módulo
            </Button>
          </form>
        </Panel>

        <Panel heading="Dependencias">
          <p className="text-[11px] leading-relaxed text-chalk-400">
            Arrastrá entre nodos para declarar una dependencia.
          </p>
          {dependencies.length === 0 ? (
            <p className="mt-2 text-[11px] text-chalk-600">Sin dependencias.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {dependencies.map((edge) => (
                <li
                  key={edge.id}
                  className="flex items-center gap-2 rounded-[var(--radius-control)] border border-ink-700 bg-ink-850 px-2 py-1 text-[11px]"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-chalk-400">
                    {labelOf(edge.source)} → {labelOf(edge.target)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Quitar dependencia ${labelOf(edge.source)} a ${labelOf(edge.target)}`}
                    onClick={() => setDependencies((current) => current.filter((item) => item.id !== edge.id))}
                    className="shrink-0 text-chalk-600 hover:text-state-failed"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

      </InspectorPanel>
    </section>
  );
}

function basename(path: string): string {
  const parts = path.split('/').filter((part) => part.length > 0);
  return parts[parts.length - 1] ?? path;
}

function labelOf(nodeId: string): string {
  if (nodeId.startsWith(MODULE_PREFIX)) return nodeId.slice(MODULE_PREFIX.length).replace(/^\d+-/, '');
  if (nodeId.startsWith(REPOSITORY_PREFIX)) return nodeId.slice(REPOSITORY_PREFIX.length);
  return nodeId;
}
