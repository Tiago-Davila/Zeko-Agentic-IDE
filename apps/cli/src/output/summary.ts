interface SummaryNode {
  nodeId: string;
  status: string;
  agentId?: string;
  reason?: { code: string };
  cost?: { amountUsd: number | undefined; basis: string };
  consumption?: { inputTokens?: number | undefined; outputTokens?: number | undefined };
}

export function summarizeRun(runId: string, run: { status: string; totals: { amountUsd?: number | undefined; partial: boolean; estimated: boolean } }, nodes: SummaryNode[]): string[] {
  const lines = ["NODE       STATUS       AGENT        COST       TOKENS"];
  for (const node of nodes) {
    const cost = node.cost?.amountUsd === undefined ? "n/a" : `${node.cost.basis === "list_price_estimate" ? "~" : ""}$${node.cost.amountUsd.toFixed(4)}`;
    const tokens = node.consumption ? `${node.consumption.inputTokens ?? 0}/${node.consumption.outputTokens ?? 0}` : "n/a";
    const reason = node.reason ? ` (${node.reason.code})` : "";
    lines.push(`${node.nodeId.padEnd(10)} ${node.status.padEnd(12)} ${(node.agentId ?? "-").padEnd(12)} ${cost.padEnd(10)} ${tokens}${reason}`);
  }
  const total = run.totals.amountUsd === undefined ? "n/a" : `$${run.totals.amountUsd.toFixed(4)}`;
  const qualifiers = [run.totals.partial ? "partial" : "", run.totals.estimated ? "estimated" : ""].filter(Boolean).join(", ");
  lines.push(`TOTAL ${total}${qualifiers ? ` (${qualifiers})` : ""}`, `Run ${runId} ${run.status}`);
  return lines;
}
