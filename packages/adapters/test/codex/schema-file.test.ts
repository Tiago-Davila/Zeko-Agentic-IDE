import { readFile } from "node:fs/promises";
import { AgentReportSchema, toAgentReportJsonSchema } from "@zeko/contracts";
import { describe, expect, it } from "vitest";
import { assertStrictSchema, createCodexSchemaFile } from "../../src/codex/schema-file.ts";

describe("Codex output schema", () => {
  it("writes the strict report schema outside the worktree and cleans it", async () => {
    const file = await createCodexSchemaFile(toAgentReportJsonSchema(), "018f0000-0000-7000-8000-000000000003");
    try {
      expect(file.path).not.toContain(process.cwd());
      expect(JSON.parse(await readFile(file.path, "utf8"))).toEqual(toAgentReportJsonSchema());
    } finally { await file.cleanup(); }
    await expect(readFile(file.path, "utf8")).rejects.toThrow();
  });
  it("accepts the Zod AgentReport schema", () => expect(() => assertStrictSchema(toAgentReportJsonSchema())).not.toThrow());
  it("rejects permissive objects and optional schema properties", () => {
    expect(() => assertStrictSchema({ type: "object", properties: { name: { type: "string" } }, required: ["name"] })).toThrow(/additionalProperties/u);
    expect(() => assertStrictSchema({ type: "object", properties: { name: { type: "string" } }, required: [], additionalProperties: false })).toThrow(/every property/u);
  });
  it("keeps the validated report schema parseable", () => {
    expect(AgentReportSchema.safeParse({ status: "COMPLETED", summary: "ok", filesChanged: [], checks: [], blockers: [], findings: [] }).success).toBe(true);
  });
});
