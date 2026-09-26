import { describe, expect, it } from "vitest";
import { ClaudeCodeAdapter } from "../../src/claude-code/adapter.ts";

describe("ClaudeCodeAdapter.detect", () => {
  it("checks the injected executable version without claiming authentication was verified", async () => {
    const adapter = new ClaudeCodeAdapter({
      binaryPath: process.execPath,
      versionArgs: ["-e", "process.stdout.write('Claude Code 2.4.17\\n')"],
    });
    try {
      await expect(adapter.detect()).resolves.toEqual({
        agentId: "claude-code", installed: true, version: "2.4.17",
        auth: { state: "unknown", mode: "detect", verified: false }, problems: [],
      });
    } finally {
      await adapter.dispose();
    }
  });

  it("reports an unparseable version as unavailable without returning raw CLI output", async () => {
    const adapter = new ClaudeCodeAdapter({
      binaryPath: process.execPath,
      versionArgs: ["-e", "process.stdout.write('unexpected private output\\n')"],
    });
    try {
      const availability = await adapter.detect();
      expect(availability).toMatchObject({ installed: false, auth: { state: "unknown", verified: false }, problems: ["Claude Code installation could not be verified"] });
      expect(JSON.stringify(availability)).not.toContain("unexpected private output");
    } finally {
      await adapter.dispose();
    }
  });
});
