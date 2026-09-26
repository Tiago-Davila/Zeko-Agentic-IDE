import type {
  AgentAvailability,
  AgentId,
  AgentReport,
  AgentUsageReading,
  Diagnostic,
  FlowFile,
  FlowNode,
  NodeResult,
  ProjectConfig,
  WarningCode,
} from "@zeko/contracts";
import { IpcEventSchema as EventSchema, IpcResponseSchema as ResponseSchema } from "@zeko/contracts";

export interface FlowSummary { id: string; name: string; valid: boolean; errorCount: number }
export interface NodeView {
  nodeId: string;
  model: { model: string; reasoningEffort?: string; source: "node" | "project_default"; effective?: string } | null;
  warnings: WarningCode[];
  confinement: { level: "confined" | "write_only" | "unconfined"; reason?: string };
  notApplicable: string[];
}
export interface PreflightResult {
  ok: boolean;
  agents: AgentAvailability[];
  perNodeAuth: Array<{ nodeId: string; agentId: AgentId; state: AgentAvailability["auth"]["state"]; mode?: AgentAvailability["auth"]["mode"]; verified: boolean; installed: boolean }>;
  warnings: WarningCode[];
  missing: Array<{ nodeId: string; agentId: AgentId; reason: "not_installed" | "not_authenticated" }>;
  diagnostics: Diagnostic[];
}
export interface RunSummary {
  id: string; flowId: string; status: "running" | "finished" | "cancelled" | "interrupted";
  startedAt: string; endedAt?: string; costUsd?: number; partial?: boolean; estimated?: boolean;
}
export interface RunDetail {
  run: import("@zeko/contracts").Run;
  nodeRuns: Array<{
    id: string; nodeId: string; nodeType: "input" | "agent" | "approval"; agentId?: AgentId;
    model?: { model: string; reasoningEffort?: string; source: "node" | "project_default"; effective?: string };
    report?: AgentReport; reportState: string; status: import("@zeko/contracts").NodeStatus;
    reasonCode?: string; reasonParams: Record<string, unknown>; inferredDenials: NonNullable<NodeResult["inferredDenials"]>;
    attempts: import("@zeko/contracts").Attempt[]; workspacePath?: string; cost?: { amountUsd: number; basis: string };
  }>;
  processes: Array<{ pid: number; creationTime: number; startedAt: string; endedAt?: string }>;
}
export interface IpcContract {
  "project.open": { params: { path: string }; result: { projectId: string; root: string; flows: FlowSummary[] } };
  "flow.list": { params: { projectId: string }; result: FlowSummary[] };
  "flow.load": { params: { projectId: string; flowId: string }; result: { flow?: FlowFile; fileHash: string; diagnostics: Diagnostic[] } };
  "flow.create": { params: { projectId: string; name: string }; result: { flowId: string } };
  "flow.save": { params: { projectId: string; flow: FlowFile; expectedHash: string }; result: { fileHash: string; diagnostics: Diagnostic[] } };
  "flow.delete": { params: { projectId: string; flowId: string; confirmed: true }; result: Record<string, never> };
  "flow.validate": { params: { projectId: string; flow: FlowFile }; result: { diagnostics: Diagnostic[]; nodeViews: NodeView[] } };
  "flow.validateEdge": { params: { projectId: string; flow: FlowFile; edge: FlowFile["edges"][number] }; result: { allowed: boolean; diagnostic?: Diagnostic } };
  "agents.status": { params: { projectId: string; agents?: AgentId[] }; result: { agents: AgentAvailability[]; usage: AgentUsageReading[] } };
  "run.preflight": { params: { projectId: string; flowId: string }; result: PreflightResult };
  "run.start": { params: { projectId: string; flowId: string; fileHash: string }; result: { runId: string } };
  "run.cancel": { params: { runId: string }; result: void };
  "node.cancel": { params: { runId: string; nodeId: string }; result: void };
  "approval.decide": { params: { runId: string; nodeId: string; decision: "approved" | "rejected" }; result: void };
  "run.list": { params: { projectId: string; flowId?: string; limit: number; before?: string }; result: RunSummary[] };
  "run.get": { params: { runId: string }; result: RunDetail | undefined };
  "node.output.page": { params: { runId: string; nodeId: string; afterSeq?: number; limit: number }; result: { events: Array<Record<string, unknown>>; nextSeq: number } };
  "node.diff": { params: { runId: string; nodeId: string; path?: string }; result: { files: Array<{ path: string; change: string; eolOnly: boolean }>; patch?: string } };
  "workspaces.delete": { params: { runId: string; confirmed: true }; result: { deleted: number } };
  "settings.get": { params: { projectId: string }; result: ProjectConfig };
  "settings.set": { params: { projectId: string; config: ProjectConfig }; result: ProjectConfig };
}

export type IpcMethod = keyof IpcContract;
export type ZekoEvent = typeof EventSchema._output;
type IpcResponse = typeof ResponseSchema._output;
interface ZekoBridge {
  request(message: { kind: "request"; id: string; method: IpcMethod; params: Record<string, unknown> }): Promise<IpcResponse>;
  onEvent(listener: (event: ZekoEvent) => void): () => void;
}

declare global { interface Window { zeko: ZekoBridge } }

export class IpcClientError extends Error {
  constructor(readonly code: string, readonly params: Record<string, unknown>) {
    super(code);
    this.name = "IpcClientError";
  }
}

export class IpcClient {
  async request<M extends IpcMethod>(method: M, params: IpcContract[M]["params"]): Promise<IpcContract[M]["result"]> {
    const response = await window.zeko.request({
      kind: "request", id: crypto.randomUUID(), method,
      params: params as Record<string, unknown>,
    });
    const parsed = ResponseSchema.parse(response);
    if (!parsed.ok) throw new IpcClientError(parsed.error.code, parsed.error.params);
    return parsed.result as IpcContract[M]["result"];
  }

  onEvent(listener: (event: ZekoEvent) => void): () => void {
    return window.zeko.onEvent((event) => {
      const parsed = EventSchema.safeParse(event);
      if (parsed.success) listener(parsed.data);
    });
  }
}

export const ipc = new IpcClient();
export type { FlowNode };
