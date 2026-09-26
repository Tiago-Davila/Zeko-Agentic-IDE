import { z } from "zod";
import { AgentReportSchema } from "./agent-report.js";
import { AgentIdSchema } from "./adapter/capabilities.js";
import { ProcessOutcomeSchema } from "./adapter/process-outcome.js";
import { REASON_CODES, WARNING_CODES } from "./codes.js";
import { FlowFileSchema } from "./flow-file.js";
import { UuidV7Schema } from "./ids.js";

export const NodeStatusSchema = z.enum(["pending", "running", "waiting_approval", "approved", "rejected", "completed", "blocked", "failed", "cancelled", "skipped", "interrupted"]);
export const RunStatusSchema = z.enum(["running", "finished", "cancelled", "interrupted"]);
export const ReasonSchema = z.object({ code: z.enum(REASON_CODES), params: z.record(z.string(), z.unknown()).default({}) }).strict();
export const ModelResolutionSchema = z.object({
  model: z.string(), reasoningEffort: z.string().optional(), source: z.enum(["node", "project_default"]), effective: z.string().optional(),
}).strict();
export const ConfinementSchema = z.object({ level: z.enum(["confined", "write_only", "unconfined"]), reason: z.string().optional() }).strict();
export const ApprovalDecisionSchema = z.object({ decision: z.enum(["approved", "rejected"]), decidedAt: z.iso.datetime(), origin: z.enum(["desktop", "cli"]) }).strict();
export const IsolatedWorkspaceSchema = z.object({
  path: z.string(), branch: z.string(), baseCommit: z.string(), trust: z.enum(["trusted", "untrusted"]), state: z.enum(["active", "kept", "deleted"]),
}).strict();
export const AttemptSchema = z.object({
  id: UuidV7Schema, n: z.number().int().positive(), kind: z.enum(["agent", "infra_retry", "report_request"]),
  sessionId: z.string().optional(), processOutcome: ProcessOutcomeSchema.optional(), workspacePath: z.string(),
  startedAt: z.iso.datetime(), endedAt: z.iso.datetime().optional(),
}).strict();
export const CostTotalsSchema = z.object({
  amountUsd: z.number().nonnegative().optional(), partial: z.boolean(), estimated: z.boolean(),
  consumption: z.object({
    inputTokens: z.number().int().nonnegative().optional(), outputTokens: z.number().int().nonnegative().optional(),
    cacheReadTokens: z.number().int().nonnegative().optional(), cacheCreationTokens: z.number().int().nonnegative().optional(),
  }).strict(),
}).strict();
export const NodeResultSchema = z.object({
  status: z.enum(["completed", "blocked", "failed", "cancelled"]),
  reason: ReasonSchema.optional(),
  denialCheck: z.enum(["applied", "not_available"]).optional(),
  inferredDenials: z.array(z.object({ source: z.enum(["os_sandbox", "agent_policy", "patch"]), message: z.string(), target: z.string().optional() }).strict()).optional(),
  inconsistency: z.literal("COMPLETED_WITH_BLOCKERS").optional(),
}).strict();
export const NodeRunSchema = z.object({
  id: UuidV7Schema, runId: UuidV7Schema, nodeId: z.string(), nodeType: z.enum(["input", "agent", "approval"]),
  agentId: AgentIdSchema.optional(), model: ModelResolutionSchema.optional(), status: NodeStatusSchema,
  reason: ReasonSchema.optional(), hold: z.literal("USAGE_NEAR_LIMIT").optional(), confinement: ConfinementSchema,
  warnings: z.array(z.enum(WARNING_CODES)), attempts: z.array(AttemptSchema), baseCommit: z.string().optional(),
  resultCommit: z.string().optional(), workspace: IsolatedWorkspaceSchema.optional(), report: AgentReportSchema.optional(),
  reportState: z.enum(["valid", "invalid", "absent", "not_applicable"]),
  observedFiles: z.array(z.object({ path: z.string(), change: z.string(), eolOnly: z.boolean() }).strict()).optional(),
  discrepancies: z.object({ undeclared: z.array(z.string()), declaredNotObserved: z.array(z.string()), scopeViolations: z.array(z.string()), historyRewritten: z.boolean() }).strict().optional(),
  denials: z.array(z.object({ tool: z.string(), reason: z.string(), input: z.unknown().optional() }).strict()).optional(),
  denialCheck: z.enum(["applied", "not_available"]),
  inferredDenials: NodeResultSchema.shape.inferredDenials,
  inconsistency: z.literal("COMPLETED_WITH_BLOCKERS").optional(),
  cost: z.object({ amountUsd: z.number().nonnegative(), basis: z.enum(["billed", "list_price_estimate", "unknown"]) }).strict().optional(),
  consumption: CostTotalsSchema.shape.consumption.optional(), approval: ApprovalDecisionSchema.optional(),
  startedAt: z.iso.datetime().optional(), endedAt: z.iso.datetime().optional(),
}).strict();
export const RunSchema = z.object({
  id: UuidV7Schema, projectRoot: z.string(), flowId: z.string(), flowName: z.string(), flowFile: z.string(),
  flowSnapshot: FlowFileSchema, flowHash: z.string(), origin: z.enum(["desktop", "cli"]), baseCommit: z.string(),
  warnings: z.array(z.enum(WARNING_CODES)), status: RunStatusSchema,
  outcome: z.enum(["all_succeeded", "some_not_succeeded"]).optional(), hold: z.literal("USAGE_NEAR_LIMIT").optional(),
  startedAt: z.iso.datetime(), endedAt: z.iso.datetime().optional(), durationMs: z.number().int().nonnegative().optional(),
  totals: CostTotalsSchema, hostPid: z.number().int().positive(), hostStartedAt: z.iso.datetime(), heartbeatAt: z.iso.datetime(),
}).strict();

export type NodeStatus = z.infer<typeof NodeStatusSchema>;
export type RunStatus = z.infer<typeof RunStatusSchema>;
export type Run = z.infer<typeof RunSchema>;
export type NodeRun = z.infer<typeof NodeRunSchema>;
export type Attempt = z.infer<typeof AttemptSchema>;
export type IsolatedWorkspace = z.infer<typeof IsolatedWorkspaceSchema>;
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
export type CostTotals = z.infer<typeof CostTotalsSchema>;
export type NodeResult = z.infer<typeof NodeResultSchema>;
