import { describe, expect, it } from "vitest";
import { DEFAULT_MODELS, ProjectConfigSchema } from "../src/project-config.js";

describe("ProjectConfigSchema", () => {
  it("provides project defaults", () => {
    expect(ProjectConfigSchema.parse({})).toEqual({
      schemaVersion: 1, concurrencyLimit: 8, usageNearLimitThreshold: 0.9, defaultModels: DEFAULT_MODELS,
    });
  });

  it("enforces concurrency and usage threshold ranges", () => {
    expect(ProjectConfigSchema.safeParse({ concurrencyLimit: 65 }).success).toBe(false);
    expect(ProjectConfigSchema.safeParse({ concurrencyLimit: 0 }).success).toBe(false);
    expect(ProjectConfigSchema.safeParse({ usageNearLimitThreshold: 0.49 }).success).toBe(false);
    expect(ProjectConfigSchema.safeParse({ usageNearLimitThreshold: 1.01 }).success).toBe(false);
  });
});
