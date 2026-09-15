import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { ApprovalPrompt } from '../approvals/ApprovalPrompt';
import type { ApprovalDto } from '../approvals/approvalApi';
import { TracePanel } from '../traceability/TracePanel';
import { ExecutionCard } from './ExecutionCard';
import { ExecutionControls } from './ExecutionControls';
import { ExecutionResultPanel } from './ExecutionResultPanel';
import { ConflictPanel } from './ConflictPanel';
import {
  conflict,
  pendingApprovals,
  resolveConflict,
  runtimeSession,
  runtimeSnapshot,
  type RuntimeConflict,
  type RuntimeExecution,
  type RuntimeSnapshot,
  type RuntimeTask,
} from './runtimeApi';
import { createRuntimeReconciler } from './runtimeEvents';
import { ProviderStatusPanel, type ProviderStatus } from './ProviderStatusPanel';

interface RuntimeCanvasProps {
  readonly projectId?: string | null;
  readonly approvals?: readonly ApprovalDto[];
}

type SnapshotStatus = 'loading' | 'ready' | 'error';

export function RuntimeCanvas({ projectId = null, approvals }: RuntimeCanvasProps) {
  const reconciler = useMemo(
    () => createRuntimeReconciler(async () => normalizeSnapshot(await runtimeSnapshot(projectId ?? undefined), projectId)),
    [projectId],
  );
  const [executions, setExecutions] = useState<readonly RuntimeExecution[]>([]);
  const [tasks, setTasks] = useState<readonly RuntimeTask[]>([]);
  const [loadedApprovals, setLoadedApprovals] = useState<readonly ApprovalDto[]>(approvals ?? []);
  const [conflicts, setConflicts] = useState<readonly RuntimeConflict[]>([]);
  const [resolutionMessage, setResolutionMessage] = useState('');
  const [snapshotStatus, setSnapshotStatus] = useState<SnapshotStatus>('loading');
  const [snapshotError, setSnapshotError] = useState('');
  const [dataError, setDataError] = useState('');
  const [socketError, setSocketError] = useState('');
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [providers, setProviders] = useState<readonly ProviderStatus[]>(initialProviders());
  const [socketAttempt, setSocketAttempt] = useState(0);

  const loadSnapshot = useCallback(async () => {
    try {
      const snapshot = normalizeSnapshot(await runtimeSnapshot(projectId ?? undefined), projectId);
      reconciler.replace(snapshot);
      setExecutions(reconciler.executions());
      setTasks(snapshot.tasks);
      setLoadedProjectId(projectId ?? '');
      if (approvals === undefined && projectId !== null && typeof pendingApprovals === 'function') {
        try {
          setLoadedApprovals(await pendingApprovals(projectId));
        } catch {
          setDataError('No se pudieron cargar las aprobaciones pendientes.');
        }
      }
      if (projectId !== null && snapshot.tasks.length > 0 && typeof conflict === 'function') {
        const blocked = snapshot.tasks.filter((task) => task.state === 'BLOCKED');
        const results = await Promise.allSettled(blocked.map((task) => conflict(task.id)));
        setConflicts(results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []));
      } else {
        setConflicts([]);
      }
      setSnapshotError('');
      setDataError('');
      setSnapshotStatus('ready');
    } catch {
      setSnapshotStatus('error');
      setSnapshotError('No se pudo cargar el estado de Runtime local.');
    }
  }, [approvals, projectId, reconciler]);

  useEffect(() => {
    void Promise.resolve().then(loadSnapshot);
  }, [loadSnapshot]);

  useEffect(() => {
    if (projectId === null || typeof WebSocket === 'undefined') return undefined;
    let active = true;
    let socket: WebSocket | null = null;

    async function connect() {
      try {
        if (typeof runtimeSession === 'function') await runtimeSession();
        if (!active) return;
        socket = new WebSocket(webSocketUrl());
        socket.addEventListener('open', () => {
          socket?.send(JSON.stringify({ type: 'subscribe', projectId }));
          setSocketError('');
        });
        socket.addEventListener('message', (event) => {
          void acceptWireEvent(event.data);
        });
        socket.addEventListener('error', () => {
          if (active) setSocketError('El canal de eventos local no está disponible; se conserva el último snapshot.');
        });
      } catch {
        if (active) setSocketError('No se pudo abrir el canal de eventos local; reintentá manualmente.');
      }
    }

    async function acceptWireEvent(data: unknown) {
      const parsed = parseWireEvent(data);
      if (parsed === null) {
        await loadSnapshot();
        return;
      }
      updateProviderStatus(parsed.payload, setProviders);
      if (parsed.eventType.startsWith('approval.') && approvals === undefined
          && projectId !== null && typeof pendingApprovals === 'function') {
        try {
          setLoadedApprovals(await pendingApprovals(projectId));
        } catch {
          setDataError('No se pudieron actualizar las aprobaciones pendientes.');
        }
      }
      const current = reconciler.executions().find((item) => item.id === parsed.payload.executionId);
      const execution = parsed.execution ?? (current === undefined ? undefined : mergeExecution(current, parsed.payload));
      if (execution === undefined) {
        await loadSnapshot();
        return;
      }
      const accepted = await reconciler.accept({
        eventId: parsed.eventId,
        resourceId: parsed.payload.executionId ?? parsed.payload.taskId ?? execution.taskId,
        sequence: parsed.sequence,
        execution,
      });
      if (accepted) setExecutions(reconciler.executions());
    }

    void connect();
    return () => {
      active = false;
      socket?.close();
    };
  }, [approvals, loadSnapshot, projectId, reconciler, socketAttempt]);

  function replace(updated: RuntimeExecution) {
    setExecutions((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  async function resolve(item: RuntimeConflict, resolution: 'CANCELLED' | 'REASSIGNED' | 'RESOLVED_MANUALLY', note: string) {
    const updated = await resolveConflict(item.taskId, resolution, note);
    setConflicts((current) => current.filter((conflictItem) => conflictItem.id !== updated.id));
    setResolutionMessage('Resolución registrada localmente.');
  }

  const currentProjectKey = projectId ?? '';
  const projectLoaded = loadedProjectId === currentProjectKey;
  const visibleExecutions = projectLoaded ? executions : [];
  const visibleTasks = projectLoaded ? tasks : [];
  const visibleConflicts = projectLoaded ? conflicts : [];
  const displayedApprovals = approvals ?? (projectLoaded ? loadedApprovals : []);
  return <section aria-label="Runtime Canvas">
    <p>Vista observacional: los nodos representan estado y no ejecutan workflows.</p>
    <ProviderStatusPanel providers={providers} onRetry={() => { setSocketAttempt((attempt) => attempt + 1); void loadSnapshot(); }} />
    {socketError ? <p role="alert">{socketError}</p> : null}
    {snapshotStatus === 'loading' ? <p role="status">Cargando snapshot local…</p> : null}
    {snapshotError ? <p role="alert">{snapshotError} <button type="button" onClick={() => void loadSnapshot()}>Reintentar carga</button></p> : null}
    {dataError ? <p role="alert">{dataError}</p> : null}
    {resolutionMessage ? <p role="status">{resolutionMessage}</p> : null}
    {snapshotStatus === 'ready' && projectLoaded && visibleExecutions.length === 0 ? <p>No hay ejecuciones conocidas para este proyecto.</p> : null}
    <div role="list" aria-label="Ejecuciones">{visibleExecutions.map((execution) => <div key={execution.id} role="listitem"><ExecutionCard execution={execution} /><ExecutionControls execution={execution} onUpdated={replace} /><ExecutionResultPanel executionId={execution.id} /><TracePanel resourceId={execution.id} /></div>)}</div>
    {visibleTasks.length > 0 ? <section aria-label="Tareas de Runtime"><h3>Tareas del proyecto</h3><ul>{visibleTasks.map((task) => <li key={task.id}>{task.title} · {task.state}</li>)}</ul></section> : null}
    {displayedApprovals.map((approval) => <ApprovalPrompt key={approval.id} approval={approval} onUpdated={(updated) => setLoadedApprovals((current) => current.map((item) => item.id === updated.id ? updated : item))} />)}
    {visibleConflicts.map((item) => <ConflictPanel key={item.id} conflict={item} onResolve={(resolution, note) => resolve(item, resolution, note)} />)}
  </section>;
}

function normalizeSnapshot(value: RuntimeSnapshot | readonly RuntimeExecution[], projectId: string | null): RuntimeSnapshot {
  return Array.isArray(value) ? { projectId: projectId ?? '', executions: value, tasks: [] } : value as RuntimeSnapshot;
}

function initialProviders(): readonly ProviderStatus[] {
  return [
    { provider: 'DOCKER', state: 'unknown', detail: 'Sin evento confirmado' },
    { provider: 'OLLAMA', state: 'unknown', detail: 'Sin evento confirmado' },
  ];
}

function webSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/ws/events`;
}

interface WireEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly sequence: number;
  readonly payload: Readonly<Record<string, string>>;
  readonly execution?: RuntimeExecution;
}

function parseWireEvent(data: unknown): WireEvent | null {
  if (typeof data !== 'string') return null;
  try {
    const value: unknown = JSON.parse(data);
    if (!isRecord(value) || typeof value.eventId !== 'string' || typeof value.eventType !== 'string'
        || typeof value.sequence !== 'number' || !isRecord(value.payload)) return null;
    const payload = Object.fromEntries(Object.entries(value.payload).filter(([, item]) => typeof item === 'string')) as Record<string, string>;
    const execution = isRuntimeExecution(value.execution) ? value.execution : undefined;
    return execution === undefined
      ? { eventId: value.eventId, eventType: value.eventType, sequence: value.sequence, payload }
      : { eventId: value.eventId, eventType: value.eventType, sequence: value.sequence, payload, execution };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRuntimeExecution(value: unknown): value is RuntimeExecution {
  return isRecord(value) && typeof value.id === 'string' && typeof value.taskId === 'string' && typeof value.attempt === 'number'
    && typeof value.state === 'string' && typeof value.knownState === 'string' && typeof value.templateId === 'string'
    && typeof value.templateVersion === 'number' && Array.isArray(value.effects);
}

function mergeExecution(current: RuntimeExecution, payload: Readonly<Record<string, string>>): RuntimeExecution {
  const state = payload.state;
  const knownState = payload.knownState;
  return {
    ...current,
    state: isExecutionState(state) ? state : current.state,
    knownState: knownState ?? current.knownState,
  };
}

function isExecutionState(value: string | undefined): value is RuntimeExecution['state'] {
  return value === 'PENDING' || value === 'RUNNING' || value === 'WAITING_APPROVAL'
    || value === 'COMPLETED' || value === 'FAILED' || value === 'CANCELLED';
}

function updateProviderStatus(payload: Readonly<Record<string, string>>, setProviders: Dispatch<SetStateAction<readonly ProviderStatus[]>>) {
  const provider = payload.provider?.toUpperCase();
  if (provider !== 'DOCKER' && provider !== 'OLLAMA') return;
  const unavailable = payload.knownState === 'UNAVAILABLE' || payload.state === 'UNAVAILABLE' || payload.error === 'true';
  const state: ProviderStatus['state'] = unavailable ? 'unavailable' : 'available';
  setProviders((current) => current.map((item) => item.provider === provider ? { ...item, state, detail: payload.knownState ?? payload.state ?? item.detail } : item));
}
