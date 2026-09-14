import { useEffect, useState } from 'react';
import { ApprovalPrompt } from '../approvals/ApprovalPrompt';
import type { ApprovalDto } from '../approvals/approvalApi';
import { TracePanel } from '../traceability/TracePanel';
import { ExecutionCard } from './ExecutionCard';
import { ExecutionControls } from './ExecutionControls';
import { ExecutionResultPanel } from './ExecutionResultPanel';
import { runtimeSnapshot, type RuntimeExecution } from './runtimeApi';

export function RuntimeCanvas({ approvals = [] }: { readonly approvals?: readonly ApprovalDto[] }) {
  const [executions, setExecutions] = useState<readonly RuntimeExecution[]>([]);
  useEffect(() => { void runtimeSnapshot().then(setExecutions).catch(() => setExecutions([])); }, []);
  function replace(updated: RuntimeExecution) { setExecutions((current) => current.map((item) => item.id === updated.id ? updated : item)); }
  return <section aria-label="Runtime Canvas"><p>Vista observacional: los nodos representan estado y no ejecutan workflows.</p><div role="list" aria-label="Ejecuciones">{executions.map((execution) => <div key={execution.id} role="listitem"><ExecutionCard execution={execution} /><ExecutionControls execution={execution} onUpdated={replace} /><ExecutionResultPanel executionId={execution.id} /><TracePanel resourceId={execution.id} /></div>)}</div>{approvals.map((approval) => <ApprovalPrompt key={approval.id} approval={approval} />)}</section>;
}
