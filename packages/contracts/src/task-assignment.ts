import { z } from "zod";
import { AgentReportSchema } from "./agent-report.js";
import { REASON_CODES } from "./codes.js";

export const ObservedFileSchema = z.object({
  path: z.string(),
  change: z.enum(["A", "M", "D", "R", "C", "?"]),
  eolOnly: z.boolean(),
}).strict();

export const PredecessorResultSchema = z.object({
  nodeId: z.string(),
  agent: z.string().optional(),
  finalStatus: z.enum(["completed", "approved", "rejected", "blocked", "failed", "cancelled", "skipped", "interrupted"]),
  reason: z.object({ code: z.enum(REASON_CODES), params: z.record(z.string(), z.unknown()) }).strict().nullable(),
  report: AgentReportSchema.nullable(),
  observedFiles: z.array(ObservedFileSchema),
  discrepancies: z.object({
    undeclared: z.array(z.string()),
    declaredNotObserved: z.array(z.string()),
    scopeViolations: z.array(z.string()),
    historyRewritten: z.boolean().optional(),
  }).strict(),
}).strict();

export const TaskAssignmentSchema = z.object({
  objective: z.string(),
  instructions: z.string(),
  acceptanceCriteria: z.array(z.string()),
  predecessorResults: z.array(PredecessorResultSchema),
}).strict();

export type TaskAssignment = z.infer<typeof TaskAssignmentSchema>;
export type PredecessorResult = z.infer<typeof PredecessorResultSchema>;
