import { z } from "zod";
import { AgentAvailabilitySchema } from "./adapter/availability.js";
import { NodeResultSchema, NodeStatusSchema, RunStatusSchema, CostTotalsSchema } from "./run.js";
import { DiagnosticSchema } from "./diagnostic.js";
import { PredecessorResultSchema } from "./task-assignment.js";
import { WARNING_CODES } from "./codes.js";
import { ReasonSchema } from "./run.js";
import { UuidV7Schema } from "./ids.js";

const runId = UuidV7Schema;
const nodeId = z.string();

export const CliEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("validation"), diagnostics: z.array(DiagnosticSchema) }).strict(),
  z.object({ type: z.literal("preflight"), ok: z.boolean(), diagnostics: z.array(DiagnosticSchema), agents: z.array(AgentAvailabilitySchema), warnings: z.array(z.enum(WARNING_CODES)) }).strict(),
  z.object({ type: z.literal("run.started"), runId, flowId: z.string(), origin: z.literal("cli"), warnings: z.array(z.enum(WARNING_CODES)) }).strict(),
  z.object({ type: z.literal("node.state"), runId, nodeId, status: NodeStatusSchema, reason: ReasonSchema.optional(), hold: z.string().optional(), attempt: z.number().int().positive().optional() }).strict(),
  z.object({ type: z.literal("approval.requested"), runId, nodeId, summary: z.array(PredecessorResultSchema) }).strict(),
  z.object({ type: z.literal("node.result"), runId, nodeId, result: NodeResultSchema }).strict(),
  z.object({ type: z.literal("run.finished"), runId, status: RunStatusSchema, outcome: z.enum(["all_succeeded", "some_not_succeeded"]).optional(), totals: CostTotalsSchema, nodes: z.array(z.unknown()).optional() }).strict(),
]);

export type CliEvent = z.infer<typeof CliEventSchema>;
