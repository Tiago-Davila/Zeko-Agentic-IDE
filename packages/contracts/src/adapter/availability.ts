import { z } from "zod";
import { AgentIdSchema } from "./capabilities.js";

export const AgentAvailabilitySchema = z.object({
  agentId: AgentIdSchema,
  installed: z.boolean(),
  version: z.string().optional(),
  auth: z.object({
    state: z.enum(["authenticated", "not_authenticated", "unknown"]),
    mode: z.enum(["subscription", "api_key", "detect"]).optional(),
    verified: z.boolean(),
  }).strict(),
  problems: z.array(z.string()),
}).strict();

export type AgentAvailability = z.infer<typeof AgentAvailabilitySchema>;
