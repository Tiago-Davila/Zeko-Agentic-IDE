import { describe, expect, it } from "vitest";
import { PredecessorResultSchema, TaskAssignmentSchema } from "../src/task-assignment.js";

describe("task handoff contracts", () => {
  it("validates assignment data and rejects unknown fields", () => {
    const assignment = { objective: "Build", instructions: "Implement", acceptanceCriteria: [], predecessorResults: [] };
    expect(TaskAssignmentSchema.safeParse(assignment).success).toBe(true);
    expect(TaskAssignmentSchema.safeParse({ ...assignment, apiKey: "secret" }).success).toBe(false);
  });

  it("accepts predecessor report and observed files", () => {
    expect(PredecessorResultSchema.safeParse({
      nodeId: "build", agent: "claude-code", finalStatus: "completed", reason: null,
      report: { status: "COMPLETED", summary: "Built", filesChanged: [], checks: [], blockers: [], findings: [] },
      observedFiles: [{ path: "src/a.ts", change: "M", eolOnly: false }],
      discrepancies: { undeclared: [], declaredNotObserved: [], scopeViolations: [] },
    }).success).toBe(true);
  });
});
