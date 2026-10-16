import type { Diagnostic, Edge, FlowFile } from "@zeko/contracts";

export function findCycles(flow: Pick<FlowFile, "nodes" | "edges">): string[][] {
  const adjacency = new Map(flow.nodes.map(({ id }) => [id, [] as string[]]));
  for (const edge of flow.edges) if (adjacency.has(edge.from) && adjacency.has(edge.to)) adjacency.get(edge.from)?.push(edge.to);
  const visited = new Set<string>();
  const active: string[] = [];
  const cycles: string[][] = [];
  const signatures = new Set<string>();
  const visit = (id: string): void => {
    const activeIndex = active.indexOf(id);
    if (activeIndex >= 0) {
      const cycle = active.slice(activeIndex);
      const rotations = cycle.map((_, index) => [...cycle.slice(index), ...cycle.slice(0, index)].join("\0"));
      const signature = rotations.sort()[0];
      if (signature && !signatures.has(signature)) { signatures.add(signature); cycles.push(cycle); }
      return;
    }
    if (visited.has(id)) return;
    active.push(id);
    for (const next of adjacency.get(id) ?? []) visit(next);
    active.pop();
    visited.add(id);
  };
  for (const { id } of flow.nodes) visit(id);
  return cycles;
}

export function validateCycles(flow: Pick<FlowFile, "nodes" | "edges">): Diagnostic[] {
  return findCycles(flow).map((nodeIds) => ({ code: "CYCLE", severity: "error", nodeId: nodeIds[0], params: { nodeIds } }));
}

export function validateEdge(flow: Pick<FlowFile, "nodes" | "edges">, edge: Edge): { allowed: boolean; diagnostic?: Diagnostic } {
  const nodeIds = new Set(flow.nodes.map(({ id }) => id));
  if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
    return { allowed: false, diagnostic: { code: "SCHEMA_ERROR", severity: "error", nodeId: !nodeIds.has(edge.to) ? edge.to : edge.from, params: { message: "Edge references an unknown node", from: edge.from, to: edge.to } } };
  }
  if (flow.edges.some((item) => item.from === edge.from && item.to === edge.to)) {
    return { allowed: false, diagnostic: { code: "SCHEMA_ERROR", severity: "error", nodeId: edge.to, params: { message: "Duplicate edge" } } };
  }
  const cycles = findCycles({ nodes: flow.nodes, edges: [...flow.edges, edge] });
  const cycle = cycles.find((nodes) => nodes.includes(edge.from) && nodes.includes(edge.to));
  return cycle
    ? { allowed: false, diagnostic: { code: "CYCLE", severity: "error", nodeId: edge.to, params: { nodeIds: cycle } } }
    : { allowed: true };
}
