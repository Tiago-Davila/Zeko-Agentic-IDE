import { describe, expect, it } from "vitest";
import { ClaudeCodeAdapter } from "../../src/claude-code/adapter.ts";

describe("ClaudeCodeAdapter.detect", () => {
  it("checks version and auth status while excluding private account details", async () => {
    const adapter = new ClaudeCodeAdapter({
      binaryPath: process.execPath,
      versionArgs: ["-e", "process.stdout.write('Claude Code 2.4.17\\n')"],
      authArgs: ["-e", "process.stdout.write(JSON.stringify({loggedIn:true,authMethod:'claude.ai',email:'private@example.test'}))"],
    });
    try {
      const availability = await adapter.detect();
      expect(availability).toEqual({
        agentId: "claude-code", installed: true, version: "2.4.17",
        auth: { state: "authenticated", mode: "subscription", verified: true }, problems: [],
      });
      expect(JSON.stringify(availability)).not.toContain("private@example.test");
    } finally {
      await adapter.dispose();
    }
  });

  it("reports an unparseable version as unavailable without returning raw CLI output", async () => {
    const adapter = new ClaudeCodeAdapter({
      binaryPath: process.execPath,
      versionArgs: ["-e", "process.stdout.write('unexpected private output\\n')"],
      authArgs: ["-e", "process.stdout.write('')"],
    });
    try {
      const availability = await adapter.detect();
      expect(availability).toMatchObject({ installed: false, auth: { state: "unknown", verified: false }, problems: ["Claude Code installation could not be verified"] });
      expect(JSON.stringify(availability)).not.toContain("unexpected private output");
    } finally {
      await adapter.dispose();
    }
  });

  it("reports a verified unauthenticated result without retaining CLI output", async () => {
    const adapter = new ClaudeCodeAdapter({
      binaryPath: process.execPath,
      versionArgs: ["-e", "process.stdout.write('Claude Code 2.4.17\\n')"],
      authArgs: ["-e", "process.stdout.write(JSON.stringify({loggedIn:false,email:'private@example.test'}))"],
    });
    try {
      const availability = await adapter.detect();
      expect(availability).toMatchObject({ installed: true, auth: { state: "not_authenticated", verified: true } });
      expect(JSON.stringify(availability)).not.toContain("private@example.test");
    } finally {
      await adapter.dispose();
    }
  });
});
