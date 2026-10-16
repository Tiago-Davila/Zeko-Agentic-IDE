import type { Diagnostic, FlowFile } from "@zeko/contracts";

export interface CodeLineage {
  codeSource: Map<string, Set<string>>;
  inputSources: Map<string, Set<string>>;
  diagnostics: Diagnostic[];
}

export function analyzeCodeLineage(flow: Pick<FlowFile, "nodes" | "edges">): CodeLineage {
  const nodes = new Map(flow.nodes.map((node) => [node.id, node]));
  const predecessors = new Map(flow.nodes.map(({ id }) => [id, [] as string[]]));
  const successors = new Map(flow.nodes.map(({ id }) => [id, [] as string[]]));
  for (const edge of flow.edges) {
    predecessors.get(edge.to)?.push(edge.from);
    successors.get(edge.from)?.push(edge.to);
  }

  const codeSource = new Map<string, Set<string>>();
  const inputSources = new Map<string, Set<string>>();
  const pending = new Set(nodes.keys());
  while (pending.size > 0) {
    let progressed = false;
    for (const id of pending) {
      const parents = predecessors.get(id) ?? [];
      if (parents.some((parent) => pending.has(parent))) continue;
      const node = nodes.get(id);
      const incoming = new Set(parents.flatMap((parent) => [...(codeSource.get(parent) ?? [])]));
      inputSources.set(id, incoming);
      const output = node?.type === "agent" && node.writeScope.length > 0 ? new Set([id])
        : node?.type === "approval" ? new Set(incoming)
        : new Set<string>();
      codeSource.set(id, output);
      pending.delete(id);
      progressed = true;
    }
    if (!progressed) {
      // A cyclic graph is diagnosed separately; stop propagation without hanging.
      for (const id of pending) { inputSources.set(id, new Set()); codeSource.set(id, new Set()); }
      break;
    }
  }

  const diagnostics: Diagnostic[] = [];
  for (const [id, sources] of inputSources) {
    const node = nodes.get(id);
    if (sources.size <= 1 || !node || node.type === "input") continue;
    if (node.type === "agent" || (node.type === "approval" && hasAgentDescendant(id, successors, nodes))) {
      diagnostics.push({ code: "MULTIPLE_CODE_SOURCES", severity: "error", nodeId: id, params: { sourceNodeIds: [...sources].sort() } });
    }
  }
  return { codeSource, inputSources, diagnostics };
}

function hasAgentDescendant(id: string, successors: Map<string, string[]>, nodes: Map<string, FlowFile["nodes"][number]>): boolean {
  const visited = new Set<string>();
  const queue = [...(successors.get(id) ?? [])];
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next || visited.has(next)) continue;
    visited.add(next);
    if (nodes.get(next)?.type === "agent") return true;
    queue.push(...(successors.get(next) ?? []));
  }
  return false;
}
