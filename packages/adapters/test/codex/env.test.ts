import { describe, expect, it } from "vitest";
import { buildCodexEnvironment, codexSensitiveValues } from "../../src/codex/env.ts";

describe("Codex child environment", () => {
  it("removes inherited credential and home overrides without mutating the parent", () => {
    const parent = { PATH: "C:/bin", CODEX_API_KEY: "inherited-codex", OPENAI_API_KEY: "inherited-openai", CODEX_HOME: "C:/private/.codex" };
    const child = buildCodexEnvironment(undefined, parent);
    expect(child).toEqual({ PATH: "C:/bin" });
    expect(parent.CODEX_API_KEY).toBe("inherited-codex");
    expect(parent.OPENAI_API_KEY).toBe("inherited-openai");
    expect(parent.CODEX_HOME).toBe("C:/private/.codex");
    expect(codexSensitiveValues()).toEqual([]);
  });

  it("injects only the explicitly configured Codex API key and returns it for redaction", () => {
    const child = buildCodexEnvironment("explicit-secret", { CODEX_API_KEY: "inherited", OPENAI_API_KEY: "also-inherited", CODEX_HOME: "C:/user/.codex" });
    expect(child).toEqual({ CODEX_API_KEY: "explicit-secret" });
    expect(codexSensitiveValues("explicit-secret")).toEqual(["explicit-secret"]);
    expect(JSON.stringify(child)).not.toContain("inherited");
    expect(JSON.stringify(child)).not.toContain("also-inherited");
    expect(JSON.stringify(child)).not.toContain("C:/user");
  });
});
