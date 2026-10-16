import type { FlowFile, NodeStatus, ReasonCode } from "@zeko/contracts";

export interface SkippedNode {
  nodeId: string;
  status: "skipped";
  reason: { code: Extract<ReasonCode, "UPSTREAM_NOT_SUCCEEDED" | "REJECTED_BY_USER" | "RUN_CANCELLED">; params: { sourceNodeId: string } };
}

export function propagateSkipped(flow: Pick<FlowFile, "nodes" | "edges">, statuses: Record<string, NodeStatus>, sourceNodeId: string): SkippedNode[] {
  const sourceStatus = statuses[sourceNodeId];
  if (!sourceStatus || !["blocked", "failed", "cancelled", "rejected"].includes(sourceStatus)) return [];
  const code: SkippedNode["reason"]["code"] = sourceStatus === "rejected" ? "REJECTED_BY_USER" : sourceStatus === "cancelled" ? "RUN_CANCELLED" : "UPSTREAM_NOT_SUCCEEDED";
  const outgoing = new Map(flow.nodes.map(({ id }) => [id, [] as string[]]));
  for (const edge of flow.edges) outgoing.get(edge.from)?.push(edge.to);
  const result: SkippedNode[] = [];
  const seen = new Set<string>();
  const queue = [...(outgoing.get(sourceNodeId) ?? [])];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || seen.has(nodeId)) continue;
    seen.add(nodeId);
    if (statuses[nodeId] === "pending") {
      result.push({ nodeId, status: "skipped", reason: { code, params: { sourceNodeId } } });
    }
    queue.push(...(outgoing.get(nodeId) ?? []));
  }
  return result;
}
