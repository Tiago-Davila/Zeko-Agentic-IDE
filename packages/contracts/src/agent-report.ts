import { z } from "zod";

const CheckSchema = z.object({
  name: z.string().describe("Name of the check."),
  outcome: z.enum(["PASSED", "FAILED", "NOT_RUN"]).describe("Result of the check."),
  evidence: z.string().describe("Concrete evidence for the outcome."),
}).strict();

export const AgentReportSchema = z.object({
  status: z.enum(["COMPLETED", "BLOCKED", "FAILED"]).describe("COMPLETED: all acceptance criteria met. BLOCKED: could not proceed because something outside your control is missing or was denied. FAILED: you attempted the task and it did not meet the acceptance criteria."),
  summary: z.string().describe("What you did and the outcome, in plain language."),
  filesChanged: z.array(z.string()).describe("Paths you modified, relative to the repository root. Empty if none."),
  checks: z.array(CheckSchema).describe("Verifications you performed. Empty if none."),
  blockers: z.array(z.string()).describe("What prevented completion. Must be empty only if status is COMPLETED and nothing blocked you."),
  findings: z.array(z.string()).describe("Relevant observations for the next step. Empty if none."),
}).strict();

export const WorkReportSchema = AgentReportSchema;
export type AgentReport = z.infer<typeof AgentReportSchema>;
export type WorkReport = AgentReport;

export function toAgentReportJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(AgentReportSchema) as Record<string, unknown>;
  delete schema["$schema"];
  return schema;
}
