import { z } from "zod";

export const ConsumptionSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  cacheReadTokens: z.number().int().nonnegative().optional(),
  cacheCreationTokens: z.number().int().nonnegative().optional(),
}).strict();
export const CostSchema = z.object({
  amountUsd: z.number().nonnegative(),
  basis: z.enum(["billed", "list_price_estimate", "unknown"]),
}).strict();
export const DenialSchema = z.object({ tool: z.string(), reason: z.string(), input: z.unknown().optional() }).strict();

const CommonOutcomeShape = {
  durationMs: z.number().int().nonnegative(),
  sessionId: z.string().optional(),
  consumption: ConsumptionSchema.optional(),
  cost: CostSchema.optional(),
  turns: z.number().int().nonnegative().optional(),
  denials: z.array(DenialSchema).optional(),
};

export const ProcessOutcomeSchema = z.discriminatedUnion("kind", [
  z.object({ ...CommonOutcomeShape, kind: z.literal("exited"), exitCode: z.literal(0) }).strict(),
  z.object({ ...CommonOutcomeShape, kind: z.literal("agent_error"), exitCode: z.number().int(), terminalReason: z.string().optional(), errors: z.array(z.string()).optional(), stderrCode: z.string().optional() }).strict(),
  z.object({ ...CommonOutcomeShape, kind: z.literal("turn_limit"), limit: z.number().int().positive() }).strict(),
  z.object({ ...CommonOutcomeShape, kind: z.literal("killed"), by: z.enum(["user", "timeout", "shutdown"]), phase: z.enum(["interrupt", "tree_kill"]) }).strict(),
  z.object({ ...CommonOutcomeShape, kind: z.literal("crashed"), exitCode: z.number().int().optional(), signal: z.string().optional() }).strict(),
  z.object({ ...CommonOutcomeShape, kind: z.literal("infra_failure"), cause: z.enum(["process_create", "session_lock"]), detail: z.string() }).strict(),
  z.object({ ...CommonOutcomeShape, kind: z.literal("spawn_failed"), cause: z.enum(["not_found", "not_authenticated", "other"]), detail: z.string() }).strict(),
]);

export type ProcessOutcome = z.infer<typeof ProcessOutcomeSchema>;
