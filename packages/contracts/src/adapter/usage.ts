import { z } from "zod";
import { AgentIdSchema } from "./capabilities.js";

export const AgentUsageReadingSchema = z.object({
  agentId: AgentIdSchema,
  authMode: z.enum(["subscription", "api_key", "detect"]),
  windows: z.array(z.object({
    name: z.string(),
    utilization: z.number().min(0).max(1),
    resetsAt: z.iso.datetime().optional(),
  }).strict()),
  readAt: z.iso.datetime(),
  live: z.boolean(),
  source: z.string(),
}).strict();

export type AgentUsageReading = z.infer<typeof AgentUsageReadingSchema>;
