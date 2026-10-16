import { z } from "zod";
import { AgentUsageReadingSchema } from "./adapter/usage.js";
import { NodeResultSchema, RunStatusSchema, CostTotalsSchema, NodeStatusSchema } from "./run.js";
import { PredecessorResultSchema } from "./task-assignment.js";
import { UuidV7Schema } from "./ids.js";

const uuid = UuidV7Schema;
const Base = { runId: uuid, nodeRunId: uuid.optional(), attemptId: uuid.optional(), ts: z.iso.datetime() };
const event = <T extends string, P extends z.ZodType>(type: T, payload: P) => z.object({ ...Base, type: z.literal(type), payload }).strict();

export const PersistedEventSchema = z.discriminatedUnion("type", [
  event("run.started", z.object({ origin: z.enum(["desktop", "cli"]), baseCommit: z.string(), warnings: z.array(z.string()), preflight: z.array(z.unknown()) }).strict()),
  event("run.held", z.object({ reason: z.string() }).strict()),
  event("run.resumed", z.object({ reason: z.string() }).strict()),
  event("run.cancel_requested", z.object({ origin: z.enum(["desktop", "cli"]) }).strict()),
  event("run.finished", z.object({ status: RunStatusSchema, outcome: z.enum(["all_succeeded", "some_not_succeeded"]).optional(), totals: CostTotalsSchema }).strict()),
  event("run.interrupted", z.object({ detectedAt: z.iso.datetime(), mode: z.enum(["graceful", "recovered"]) }).strict()),
  event("node.state_changed", z.object({ from: NodeStatusSchema, to: NodeStatusSchema, reason: z.unknown().optional(), hold: z.string().optional() }).strict()),
  event("node.attempt_started", z.object({ attemptId: uuid, n: z.number().int().positive(), kind: z.enum(["agent", "infra_retry", "report_request"]), workspace: z.unknown(), confinement: z.unknown() }).strict()),
  event("node.attempt_finished", z.object({ processOutcome: z.unknown() }).strict()),
  event("node.report_requested", z.object({ why: z.enum(["absent", "invalid"]), zodErrors: z.array(z.unknown()).optional() }).strict()),
  event("node.report_received", z.object({ reportState: z.enum(["valid", "invalid", "absent", "not_applicable"]) }).strict()),
  event("node.result", NodeResultSchema),
  event("node.cancel_requested", z.object({ origin: z.enum(["desktop", "cli"]), phase: z.enum(["interrupt", "tree_kill"]) }).strict()),
  event("node.process_killed", z.object({ phase: z.enum(["interrupt", "tree_kill"]), pids: z.array(z.number().int().positive()), verifiedClean: z.boolean() }).strict()),
  event("agent.session_started", z.object({ sessionId: z.string(), model: z.string().optional(), tools: z.array(z.string()).optional(), agentVersion: z.string().optional() }).strict()),
  event("agent.text", z.object({ text: z.string(), subagent: z.string().optional() }).strict()),
  event("agent.tool_call", z.object({ toolUseId: z.string().optional(), name: z.string(), input: z.unknown() }).strict()),
  event("agent.tool_result", z.object({ toolUseId: z.string().optional(), ok: z.boolean(), content: z.string() }).strict()),
  event("agent.permission_denied", z.object({ tool: z.string(), reason: z.string(), input: z.unknown().optional() }).strict()),
  event("agent.inferred_denial", z.object({ source: z.enum(["os_sandbox", "agent_policy", "patch"]), message: z.string(), target: z.string().optional() }).strict()),
  event("agent.usage", z.object({ consumption: z.unknown(), cost: z.unknown().optional() }).strict()),
  event("agent.subscription_usage", AgentUsageReadingSchema),
  event("agent.stderr", z.object({ line: z.string() }).strict()),
  event("approval.requested", z.object({ summary: z.array(PredecessorResultSchema) }).strict()),
  event("approval.decided", z.object({ decision: z.enum(["approved", "rejected"]), origin: z.enum(["desktop", "cli"]) }).strict()),
  z.object({ ...Base, type: z.enum(["workspace.created", "workspace.committed", "workspace.marked_untrusted", "workspace.deleted"]), payload: z.object({ path: z.string(), branch: z.string(), commit: z.string().optional() }).strict() }).strict(),
  event("error", z.object({ code: z.string(), context: z.record(z.string(), z.unknown()) }).strict()),
]);

export type PersistedEvent = z.infer<typeof PersistedEventSchema>;
