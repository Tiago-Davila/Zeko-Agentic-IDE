import type { AgentAvailability } from "./availability.js";
import type { AgentCapabilities, AgentId, Platform } from "./capabilities.js";
import type { LaunchSpec } from "./launch-spec.js";
import type { NormalizedEvent } from "./normalized-event.js";
import type { ProcessOutcome } from "./process-outcome.js";
import type { ReportCandidate } from "./report-candidate.js";
import type { AgentUsageReading } from "./usage.js";

export interface AgentExecution {
  readonly events: AsyncIterable<NormalizedEvent>;
  readonly completion: Promise<{ outcome: ProcessOutcome; report: ReportCandidate }>;
  cancel(reason: "user" | "timeout" | "shutdown"): Promise<void>;
  readonly rootPid: { pid: number; creationTime: number };
  readonly sensitiveValues: readonly string[];
}

export interface AgentAdapter {
  readonly id: AgentId;
  capabilities(platform: Platform): AgentCapabilities;
  detect(): Promise<AgentAvailability>;
  readUsage(): Promise<AgentUsageReading | undefined>;
  launch(spec: LaunchSpec): AgentExecution;
  requestReport(previous: AgentExecution, spec: LaunchSpec): AgentExecution;
}
