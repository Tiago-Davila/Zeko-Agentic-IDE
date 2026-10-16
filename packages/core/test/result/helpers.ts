import type { AgentReport, ProcessOutcome } from "@zeko/contracts";
import type { ResolveNodeResultInput } from "../../src/result/resolve-node-result.js";

export const successfulOutcome: ProcessOutcome = { kind: "exited", exitCode: 0, durationMs: 10 };
export const completedReport: AgentReport = { status: "COMPLETED", summary: "done", filesChanged: [], checks: [], blockers: [], findings: [] };
export const baseInput = (overrides: Partial<ResolveNodeResultInput> = {}): ResolveNodeResultInput => ({
  cancelledByUser: false,
  outcome: successfulOutcome,
  reportState: "valid",
  report: completedReport,
  capabilities: { reportsDenials: true, supportsTurnLimit: true },
  denials: [],
  observedFiles: [],
  writeScope: ["**"],
  ...overrides,
});
