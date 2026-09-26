import { z } from "zod";

export const SlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
export const PositionSchema = z.object({ x: z.number().int(), y: z.number().int() }).strict();
export const ModelSchema = z.object({ model: z.string().min(1) }).strict();
export const CodexModelSchema = z.object({ model: z.string().min(1), reasoningEffort: z.string().min(1) }).strict();
export const ModelsSchema = z.object({
  "claude-code": ModelSchema.optional(),
  codex: CodexModelSchema.optional(),
}).strict();

const CommonNodeShape = {
  id: SlugSchema,
  label: z.string().optional(),
  position: PositionSchema,
};

export const InputNodeSchema = z.object({
  ...CommonNodeShape,
  type: z.literal("input"),
  objective: z.string().min(1),
}).strict();

export const AgentNodeSchema = z.object({
  ...CommonNodeShape,
  type: z.literal("agent"),
  agent: z.enum(["claude-code", "codex"]),
  models: ModelsSchema.optional(),
  instructions: z.string().min(1),
  acceptanceCriteria: z.array(z.string()),
  writeScope: z.array(z.string().min(1).refine((scope) => {
    if (scope.includes("\\")) return false;
    if (/^(?:\/|[a-zA-Z]:|\\\\)/.test(scope)) return false;
    return !scope.split("/").includes("..");
  }, "writeScope must be a relative slash-separated glob without '..'")),
  terminal: z.object({ enabled: z.boolean(), allowedCommands: z.array(z.string().min(1)) }).strict(),
  limits: z.object({
    timeoutMinutes: z.number().int().min(1).max(1440),
    maxTurns: z.number().int().min(1).max(500),
    maxRetries: z.number().int().min(0).max(5),
  }).strict(),
}).strict();

export const ApprovalNodeSchema = z.object({
  ...CommonNodeShape,
  type: z.literal("approval"),
}).strict();

export const FlowNodeSchema = z.discriminatedUnion("type", [InputNodeSchema, AgentNodeSchema, ApprovalNodeSchema]);
export const EdgeSchema = z.object({ from: SlugSchema, to: SlugSchema }).strict();
export const FlowFileSchema = z.object({
  schemaVersion: z.literal(1),
  id: SlugSchema,
  name: z.string().min(1),
  nodes: z.array(FlowNodeSchema),
  edges: z.array(EdgeSchema),
}).strict();

export function validateFlowFile(value: unknown) {
  const result = FlowFileSchema.safeParse(value);
  if (result.success) return result;
  return {
    success: false as const,
    code: "SCHEMA_ERROR" as const,
    issues: result.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
  };
}

export type InputNode = z.infer<typeof InputNodeSchema>;
export type AgentNode = z.infer<typeof AgentNodeSchema>;
export type ApprovalNode = z.infer<typeof ApprovalNodeSchema>;
export type FlowNode = z.infer<typeof FlowNodeSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type FlowFile = z.infer<typeof FlowFileSchema>;
