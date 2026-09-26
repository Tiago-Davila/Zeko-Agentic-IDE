import { z } from "zod";
import { AgentUsageReadingSchema } from "./adapter/usage.js";
import { DIAGNOSTIC_CODES, WARNING_CODES } from "./codes.js";
import { DiagnosticSchema } from "./diagnostic.js";
import { ModelResolutionSchema, NodeResultSchema, RunSchema } from "./run.js";
import { UuidV7Schema } from "./ids.js";

const requestMethods = [
  "project.open", "flow.list", "flow.load", "flow.create", "flow.save", "flow.delete", "flow.validate", "flow.validateEdge",
  "agents.status", "run.preflight", "run.start", "run.cancel", "node.cancel", "approval.decide", "run.list", "run.get",
  "node.output.page", "node.diff", "workspaces.delete", "settings.get", "settings.set",
] as const;

export const IpcRequestSchema = z.object({
  kind: z.literal("request"), id: z.uuid(), method: z.enum(requestMethods), params: z.record(z.string(), z.unknown()),
}).strict();

export const IpcErrorSchema = z.object({
  code: z.string(),
  params: z.record(z.string(), z.unknown()),
}).strict().superRefine((value, context) => {
  if (value.code === "FILE_CHANGED_ON_DISK" && typeof value.params["currentHash"] !== "string") {
    context.addIssue({ code: "custom", path: ["params", "currentHash"], message: "FILE_CHANGED_ON_DISK requires currentHash" });
  }
});

export const IpcResponseSchema = z.discriminatedUnion("ok", [
  z.object({ kind: z.literal("response"), id: z.uuid(), ok: z.literal(true), result: z.unknown() }).strict(),
  z.object({ kind: z.literal("response"), id: z.uuid(), ok: z.literal(false), error: IpcErrorSchema }).strict(),
]);

export const IpcEventSchema = z.object({
  kind: z.literal("event"),
  type: z.enum(["run.started", "node.state", "node.output", "node.result", "approval.requested", "agent.usage", "run.held", "run.resumed", "run.finished", "flow.fileChanged", "runs.recovered", "engine.error"]),
  runId: UuidV7Schema.optional(),
  payload: z.unknown(),
  seq: z.number().int().nonnegative().optional(),
}).strict();

export const NodeViewSchema = z.object({
  nodeId: z.string(),
  model: ModelResolutionSchema.nullable(),
  warnings: z.array(z.enum(WARNING_CODES)),
  confinement: z.object({ level: z.enum(["confined", "write_only", "unconfined"]), reason: z.string().optional() }).strict(),
  notApplicable: z.array(z.string()),
}).strict();

export const FlowSummarySchema = z.object({ id: z.string(), name: z.string(), valid: z.boolean(), errorCount: z.number().int().nonnegative() }).strict();
export const RunSummarySchema = z.object({ id: UuidV7Schema, flowId: z.string(), status: RunSchema.shape.status, startedAt: z.iso.datetime(), endedAt: z.iso.datetime().optional() }).strict();
export const IpcValidationSchema = z.object({ diagnostics: z.array(DiagnosticSchema), nodeViews: z.array(NodeViewSchema) }).strict();
export const IpcPreflightSchema = z.object({ ok: z.boolean(), diagnostics: z.array(DiagnosticSchema), agents: z.array(z.unknown()), perNodeAuth: z.array(z.unknown()), warnings: z.array(z.enum(WARNING_CODES)) }).strict();
export const IpcNodeResultSchema = NodeResultSchema;
export const IpcUsageSchema = AgentUsageReadingSchema;
export const DiagnosticCodeSchema = z.enum(DIAGNOSTIC_CODES);
