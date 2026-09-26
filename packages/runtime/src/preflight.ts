import type { AgentAdapter, AgentAvailability, AgentId, FlowFile, WarningCode } from "@zeko/contracts";

export interface NodeAuthStatus {
  readonly nodeId: string;
  readonly agentId: AgentId;
  readonly state: AgentAvailability["auth"]["state"];
  readonly mode?: AgentAvailability["auth"]["mode"];
  readonly verified: boolean;
  readonly installed: boolean;
}

export interface PreflightResult {
  readonly ok: boolean;
  readonly agents: AgentAvailability[];
  readonly perNodeAuth: NodeAuthStatus[];
  readonly warnings: WarningCode[];
  readonly missing: Array<{ nodeId: string; agentId: AgentId; reason: "not_installed" | "not_authenticated" }>;
}

/** Detect each distinct provider once, then report only the auth shape used per node. */
export async function preflight(flow: FlowFile, adapters: Partial<Record<AgentId, AgentAdapter>>): Promise<PreflightResult> {
  const nodes = flow.nodes.filter((node) => node.type === "agent");
  const ids = [...new Set(nodes.map((node) => node.agent))];
  const detected: Array<[AgentId, AgentAvailability]> = await Promise.all(ids.map(async (agentId): Promise<[AgentId, AgentAvailability]> => {
    const adapter = adapters[agentId];
    if (!adapter) return [agentId, { agentId, installed: false, auth: { state: "unknown", verified: false }, problems: [] }];
    try {
      const availability = await adapter.detect();
      return [agentId, sanitizeAvailability(availability)];
    } catch {
      return [agentId, { agentId, installed: false, auth: { state: "unknown", verified: false }, problems: [] }];
    }
  }));
  const byAgent = new Map<AgentId, AgentAvailability>(detected);
  const agents = ids.map((id) => byAgent.get(id)!);
  const perNodeAuth: NodeAuthStatus[] = nodes.map((node) => {
    const availability = byAgent.get(node.agent)!;
    return {
      nodeId: node.id, agentId: node.agent, state: availability.auth.state,
      ...(availability.auth.mode ? { mode: availability.auth.mode } : {}),
      verified: availability.auth.verified, installed: availability.installed,
    };
  });
  const missing: PreflightResult["missing"][number][] = [];
  for (const item of perNodeAuth) {
    if (!item.installed) missing.push({ nodeId: item.nodeId, agentId: item.agentId, reason: "not_installed" });
    else if (item.state === "not_authenticated") missing.push({ nodeId: item.nodeId, agentId: item.agentId, reason: "not_authenticated" });
  }
  const warnings: WarningCode[] = perNodeAuth.some((item) => item.mode === "api_key" && !item.verified) ? ["AUTH_API_KEY_UNVERIFIED"] : [];
  return { ok: missing.length === 0, agents, perNodeAuth, warnings, missing };
}

function sanitizeAvailability(value: AgentAvailability): AgentAvailability {
  // Problems may contain provider account details; only status and safe, structured auth data leave preflight.
  return {
    agentId: value.agentId, installed: value.installed,
    ...(value.version ? { version: value.version } : {}),
    auth: { state: value.auth.state, ...(value.auth.mode ? { mode: value.auth.mode } : {}), verified: value.auth.verified },
    problems: [],
  };
}
