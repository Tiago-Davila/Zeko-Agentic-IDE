import { z } from "zod";
import { AgentReportSchema } from "../agent-report.js";

export const ReportCandidateSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("valid"), report: AgentReportSchema }).strict(),
  z.object({
    state: z.literal("invalid"),
    zodErrors: z.array(z.object({ path: z.array(z.union([z.string(), z.number()])), code: z.string(), message: z.string() }).strict()),
  }).strict(),
  z.object({ state: z.literal("absent") }).strict(),
]);

export type ReportCandidate = z.infer<typeof ReportCandidateSchema>;
