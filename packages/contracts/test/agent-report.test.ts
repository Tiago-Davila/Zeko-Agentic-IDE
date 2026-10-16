import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AgentReportSchema, toAgentReportJsonSchema, WorkReportSchema } from "../src/agent-report.js";

const generatedPath = resolve(import.meta.dirname, "../generated/agent-report.schema.json");

describe("AgentReportSchema", () => {
  it("is strict and accepts all report statuses", () => {
    for (const status of ["COMPLETED", "BLOCKED", "FAILED"] as const) {
      expect(AgentReportSchema.safeParse({ status, summary: "", filesChanged: [], checks: [], blockers: [], findings: [] }).success).toBe(true);
    }
    expect(WorkReportSchema).toBe(AgentReportSchema);
    expect(AgentReportSchema.safeParse({ status: "COMPLETED", summary: "", filesChanged: [], checks: [], blockers: [], findings: [], extra: true }).success).toBe(false);
  });

  it("matches the generated schema and its strict output subset", async () => {
    const jsonSchema = JSON.parse(await readFile(generatedPath, "utf8")) as Record<string, unknown>;
    expect(jsonSchema).toEqual(toAgentReportJsonSchema());
    expect(jsonSchema).toMatchSnapshot();
    const allowed = new Set(["type", "enum", "properties", "required", "items", "additionalProperties", "description"]);
    const visit = (value: unknown, propertyMap = false): void => {
      if (Array.isArray(value)) return value.forEach((entry) => visit(entry));
      if (typeof value === "object" && value !== null) {
        for (const [key, child] of Object.entries(value)) {
          if (!propertyMap) expect(allowed.has(key)).toBe(true);
          visit(child, key === "properties");
        }
      }
    };
    visit(jsonSchema);
    expect(jsonSchema["additionalProperties"]).toBe(false);
    expect(jsonSchema["required"]).toEqual(["status", "summary", "filesChanged", "checks", "blockers", "findings"]);
  });

  it("requires every object property and leaves array lengths unconstrained", async () => {
    const schema = JSON.parse(await readFile(generatedPath, "utf8")) as {
      properties: Record<string, { required?: string[]; items?: { properties?: Record<string, unknown>; required?: string[]; additionalProperties?: boolean }; minItems?: number; maxItems?: number }>;
      required: string[];
      additionalProperties: boolean;
    };
    expect(schema.required).toEqual(Object.keys(schema.properties));
    expect(schema.additionalProperties).toBe(false);
    for (const field of ["filesChanged", "checks", "blockers", "findings"]) {
      expect(schema.properties[field]?.minItems).toBeUndefined();
      expect(schema.properties[field]?.maxItems).toBeUndefined();
    }
    const checks = schema.properties["checks"]?.items;
    expect(checks?.additionalProperties).toBe(false);
    expect(checks?.required).toEqual(Object.keys(checks?.properties ?? {}));
  });
});
