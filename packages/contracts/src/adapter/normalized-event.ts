import { z } from "zod";
import { AgentUsageReadingSchema } from "./usage.js";
import { UuidV7Schema } from "../ids.js";

const EventBase = { ts: z.iso.datetime(), attemptId: UuidV7Schema };
const ConsumptionSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  cacheReadTokens: z.number().int().nonnegative().optional(),
  cacheCreationTokens: z.number().int().nonnegative().optional(),
}).strict();
const CostSchema = z.object({ amountUsd: z.number().nonnegative(), basis: z.enum(["billed", "list_price_estimate", "unknown"]) }).strict();

export const NormalizedEventSchema = z.discriminatedUnion("type", [
  z.object({ ...EventBase, type: z.literal("session_started"), sessionId: z.string(), model: z.string().optional(), tools: z.array(z.string()).optional(), agentVersion: z.string().optional() }).strict(),
  z.object({ ...EventBase, type: z.literal("assistant_text"), text: z.string(), subagent: z.string().optional() }).strict(),
  z.object({ ...EventBase, type: z.literal("tool_call"), toolUseId: z.string().optional(), name: z.string(), input: z.unknown() }).strict(),
  z.object({ ...EventBase, type: z.literal("tool_result"), toolUseId: z.string().optional(), ok: z.boolean(), content: z.string() }).strict(),
  z.object({ ...EventBase, type: z.literal("permission_denied"), tool: z.string(), reason: z.string(), input: z.unknown().optional() }).strict(),
  z.object({ ...EventBase, type: z.literal("inferred_denial"), source: z.enum(["os_sandbox", "agent_policy", "patch"]), message: z.string(), target: z.string().optional() }).strict(),
  z.object({ ...EventBase, type: z.literal("usage"), consumption: ConsumptionSchema.optional(), cost: CostSchema.optional() }).strict(),
  z.object({ ...EventBase, type: z.literal("subscription_usage"), ...AgentUsageReadingSchema.shape }).strict(),
  z.object({ ...EventBase, type: z.literal("model_mismatch"), requested: z.string(), effective: z.string() }).strict(),
  z.object({ ...EventBase, type: z.literal("stderr"), line: z.string() }).strict(),
  z.object({ ...EventBase, type: z.literal("raw"), data: z.unknown() }).strict(),
]);

export type NormalizedEvent = z.infer<typeof NormalizedEventSchema>;
