import type { AgentUsageReading } from "./adapter/usage.js";
import type { FlowFile } from "./flow-file.js";
import type { PersistedEvent } from "./events.js";
import type { Run } from "./run.js";

export interface WorkspacePort {
  create(input: { runId: string; nodeId: string; baseCommit: string }): Promise<{ path: string; branch: string }>;
  remove(path: string): Promise<void>;
}

export interface RunStorePort {
  create(run: Run): Promise<void>;
  get(runId: string): Promise<Run | undefined>;
  append(event: PersistedEvent): Promise<void>;
  saveFlowSnapshot(runId: string, flow: FlowFile): Promise<void>;
}

export interface ClockPort {
  now(): string;
  sleep(milliseconds: number, signal?: AbortSignal): Promise<void>;
}

export interface SlotLeasePort {
  acquire(projectId: string, nodeRunId: string, limit: number): Promise<boolean>;
  heartbeat(nodeRunId: string): Promise<void>;
  release(nodeRunId: string): Promise<void>;
}

export interface UsageStorePort {
  readLatest(agentId: string, authMode: string): Promise<AgentUsageReading | undefined>;
  write(reading: AgentUsageReading): Promise<void>;
}
