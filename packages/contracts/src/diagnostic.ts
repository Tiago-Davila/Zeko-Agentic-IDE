import { z } from "zod";
import { DIAGNOSTIC_CODES, WARNING_CODES } from "./codes.js";

export const DiagnosticSchema = z.object({
  code: z.enum([...DIAGNOSTIC_CODES, ...WARNING_CODES]),
  severity: z.enum(["error", "warning", "info"]),
  params: z.record(z.string(), z.unknown()).default({}),
  nodeId: z.string().optional(),
  edgeId: z.string().optional(),
  location: z.object({ line: z.number().int().positive().optional(), column: z.number().int().positive().optional() }).strict().optional(),
}).strict();

export type Diagnostic = z.infer<typeof DiagnosticSchema>;
