import type { FlowFile, NodeRun, PredecessorResult } from "@zeko/contracts";

export function buildPredecessorResults(flow: Pick<FlowFile, "nodes" | "edges">, nodeId: string, nodeRuns: Map<string, NodeRun>): PredecessorResult[] {
  const nodeById = new Map(flow.nodes.map((node) => [node.id, node]));
  const incoming = new Map(flow.nodes.map(({ id }) => [id, [] as string[]]));
  for (const edge of flow.edges) incoming.get(edge.to)?.push(edge.from);
  const result: PredecessorResult[] = [];
  const append = (predecessorId: string, visiting: Set<string>): void => {
    if (visiting.has(predecessorId)) return;
    const node = nodeById.get(predecessorId);
    if (node?.type === "approval") {
      const nextVisiting = new Set(visiting).add(predecessorId);
      for (const parentId of incoming.get(predecessorId) ?? []) append(parentId, nextVisiting);
      return;
    }
    const run = nodeRuns.get(predecessorId);
    if (!run || !isPredecessorStatus(run.status)) return;
    const discrepancies = run.discrepancies;
    result.push({
      nodeId: predecessorId,
      ...(run.agentId ? { agent: run.agentId } : {}),
      finalStatus: run.status,
      reason: run.reason ? { code: run.reason.code, params: run.reason.params } : null,
      report: run.report ?? null,
      observedFiles: (run.observedFiles ?? []).flatMap(({ path, change, eolOnly }) =>
        ["A", "M", "D", "R", "C", "?"].includes(change) ? [{ path, change: change as "A" | "M" | "D" | "R" | "C" | "?", eolOnly }] : []),
      discrepancies: {
        undeclared: discrepancies?.undeclared ?? [],
        declaredNotObserved: discrepancies?.declaredNotObserved ?? [],
        scopeViolations: discrepancies?.scopeViolations ?? [],
        ...(discrepancies?.historyRewritten === undefined ? {} : { historyRewritten: discrepancies.historyRewritten }),
      },
    });
  };
  for (const predecessorId of incoming.get(nodeId) ?? []) append(predecessorId, new Set());
  return result;
}

function isPredecessorStatus(status: NodeRun["status"]): status is PredecessorResult["finalStatus"] {
  return ["completed", "approved", "rejected", "blocked", "failed", "cancelled", "skipped", "interrupted"].includes(status);
}
