import type { Diagnostic, Edge, FlowFile, FlowNode } from "@zeko/contracts";

function diagnostic(code: Diagnostic["code"], nodeId?: string, params: Record<string, unknown> = {}): Diagnostic {
  return { code, severity: "error", params, ...(nodeId ? { nodeId } : {}) };
}

export function validateGraph(flow: FlowFile): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const nodes = new Map(flow.nodes.map((node) => [node.id, node]));
  const inputs = flow.nodes.filter((node) => node.type === "input");
  if (inputs.length === 0) diagnostics.push(diagnostic("NO_INPUT_NODE"));
  if (inputs.length > 1) diagnostics.push(diagnostic("MULTIPLE_INPUT_NODES", undefined, { nodeIds: inputs.map(({ id }) => id) }));

  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const edge of flow.edges) {
    const key = `${edge.from}\0${edge.to}`;
    if (seen.has(key)) diagnostics.push(diagnostic("SCHEMA_ERROR", edge.to, { message: "Duplicate edge", from: edge.from, to: edge.to }));
    seen.add(key);
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
      diagnostics.push(diagnostic("SCHEMA_ERROR", !nodes.has(edge.to) ? edge.to : edge.from, { message: "Edge references an unknown node", from: edge.from, to: edge.to }));
      continue;
    }
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }

  for (const node of flow.nodes) {
    if (node.type === "input" && (incoming.get(node.id) ?? 0) > 0) diagnostics.push(diagnostic("INPUT_HAS_PREDECESSOR", node.id));
    if (node.type === "approval" && (incoming.get(node.id) ?? 0) === 0) diagnostics.push(diagnostic("APPROVAL_WITHOUT_PREDECESSOR", node.id));
  }

  const root = inputs[0];
  if (root) {
    const reached = new Set<string>();
    const queue = [root.id];
    while (queue.length > 0) {
      const id = queue.shift();
      if (id === undefined || reached.has(id)) continue;
      reached.add(id);
      queue.push(...(outgoing.get(id) ?? []));
    }
    for (const node of flow.nodes) if (!reached.has(node.id)) diagnostics.push(diagnostic("DISCONNECTED_NODE", node.id));
  }
  return diagnostics;
}

export function nodeMap(nodes: FlowNode[]): Map<string, FlowNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

export function incomingEdges(edges: Edge[], nodeId: string): Edge[] {
  return edges.filter((edge) => edge.to === nodeId);
}
