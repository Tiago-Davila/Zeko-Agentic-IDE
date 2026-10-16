import { z } from "zod";
import { CodexModelSchema, ModelSchema } from "../flow-file.js";
import { AgentIdSchema, PlatformSchema } from "./capabilities.js";
import { UuidV7Schema } from "../ids.js";

export const LaunchSpecSchema = z.object({
  agentId: AgentIdSchema,
  runId: UuidV7Schema,
  nodeRunId: UuidV7Schema,
  attemptId: UuidV7Schema,
  workspacePath: z.string().min(1),
  model: z.union([ModelSchema, CodexModelSchema]),
  prompt: z.string(),
  reportSchema: z.record(z.string(), z.unknown()),
  writeScope: z.array(z.string()),
  terminal: z.object({ enabled: z.boolean(), allowedCommands: z.array(z.string()) }).strict(),
  maxTurns: z.number().int().min(1).max(500).optional(),
  platform: PlatformSchema,
}).strict().superRefine(({ agentId, model }, context) => {
  if (agentId === "codex" && !("reasoningEffort" in model)) {
    context.addIssue({ code: "custom", path: ["model", "reasoningEffort"], message: "Codex launches require reasoningEffort" });
  }
  if (agentId === "claude-code" && "reasoningEffort" in model) {
    context.addIssue({ code: "custom", path: ["model", "reasoningEffort"], message: "Claude Code launches do not accept reasoningEffort" });
  }
});

export type LaunchSpec = z.infer<typeof LaunchSpecSchema>;
