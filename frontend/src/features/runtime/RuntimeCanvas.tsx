import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApprovalPrompt } from '../approvals/ApprovalPrompt';
import type { ApprovalDto } from '../approvals/approvalApi';
import { TracePanel } from '../traceability/TracePanel';
import { ExecutionCard } from './ExecutionCard';
import { ExecutionControls } from './ExecutionControls';
import { ExecutionResultPanel } from './ExecutionResultPanel';
import { ProviderStatusPanel, type ProviderStatus } from './ProviderStatusPanel';
import { runtimeProjectSnapshot, type RuntimeExecution } from './runtimeApi';

interface RuntimeCanvasProps {
  readonly projectId: string | null;
  readonly approvals?: readonly ApprovalDto[];
}

export function RuntimeCanvas({ projectId, approvals = [] }: RuntimeCanvasProps) {
  const [snapshot, setSnapshot] = useState<{ projectId: string; executions: readonly RuntimeExecution[] } | null>(null);
  const [error, setError] = useState('');
  const executions = useMemo(
    () => snapshot?.projectId === projectId ? snapshot.executions : [],
    [snapshot, projectId],
  );

  const reload = useCallback(async () => {
    if (projectId === null) {
      setError('');
      return;
    }
    try {
      const next = await runtimeProjectSnapshot(projectId);
      setSnapshot({ projectId: next.projectId, executions: next.executions });
      setError('');
    } catch {
      setError('No se pudo recuperar el estado local. Se conserva el último snapshot confirmado.');
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId === null) {
      return undefined;
    }
    let current = true;
    void runtimeProjectSnapshot(projectId)
      .then((next) => {
        if (current) {
          setSnapshot({ projectId: next.projectId, executions: next.executions });
          setError('');
        }
      })
      .catch(() => {
        if (current) {
          setError('No se pudo recuperar el estado local. Se conserva el último snapshot confirmado.');
        }
      });
    return () => {
      current = false;
    };
  }, [projectId]);

  function replace(updated: RuntimeExecution) {
    setSnapshot((current) => {
      if (current === null || current.projectId !== projectId) {
        return current;
      }
      return {
        ...current,
        executions: current.executions.map((item) => item.id === updated.id ? updated : item),
      };
    });
  }

  const providers = useMemo(() => providerStatuses(executions, projectId), [executions, projectId]);

  return (
    <section aria-label="Runtime Canvas">
      <p>Vista observacional: los nodos representan estado y no ejecutan workflows.</p>
      <button type="button" disabled={projectId === null} onClick={() => void reload()}>
        Recargar estado
      </button>
      {error ? <p role="alert">{error}</p> : null}
      <ProviderStatusPanel providers={providers} />
      <div role="list" aria-label="Ejecuciones">
        {executions.map((execution) => (
          <div key={execution.id} role="listitem">
            <ExecutionCard execution={execution} />
            <ExecutionControls execution={execution} onUpdated={replace} />
            <ExecutionResultPanel executionId={execution.id} />
            <TracePanel resourceId={execution.id} />
          </div>
        ))}
      </div>
      {approvals.map((approval) => <ApprovalPrompt key={approval.id} approval={approval} />)}
    </section>
  );
}

function providerStatuses(executions: readonly RuntimeExecution[], projectId: string | null): ProviderStatus[] {
  const providers: ProviderStatus['provider'][] = ['DOCKER', 'OLLAMA'];
  return providers.map((provider) => {
    const affected = executions.find((execution) => execution.provider === provider
      && (execution.state === 'FAILED' || execution.knownState === 'UNAVAILABLE'));
    if (affected) {
      return {
        provider,
        state: 'unavailable',
        detail: `Último estado confirmado: ${affected.knownState}`,
      };
    }
    return {
      provider,
      state: 'unknown',
      detail: projectId === null ? 'Seleccioná un proyecto para consultar su estado.' : 'Esperando estado confirmado.',
    };
  });
}
