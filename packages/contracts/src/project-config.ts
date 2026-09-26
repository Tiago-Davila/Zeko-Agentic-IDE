import { z } from "zod";
import { ModelsSchema } from "./flow-file.js";

export const DEFAULT_MODELS = {
  "claude-code": { model: "sonnet" },
  codex: { model: "gpt-6-luna", reasoningEffort: "low" },
} as const;

export const ProjectConfigSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  concurrencyLimit: z.number().int().min(1).max(64).default(8),
  usageNearLimitThreshold: z.number().min(0.5).max(1).default(0.9),
  defaultModels: ModelsSchema.default(DEFAULT_MODELS),
}).strict();

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
