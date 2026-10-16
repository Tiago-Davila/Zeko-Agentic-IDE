import { describe, expect, it, vi } from "vitest";
import { CodexAdapter } from "../../src/codex/adapter.ts";

describe("CodexAdapter.detect", () => {
  it("checks the CLI version and authenticated subscription by exit code without retaining output", async () => {
    const adapter = new CodexAdapter({
      binaryPath: process.execPath,
      versionArgs: ["-e", "process.stdout.write('Codex CLI 0.4.12\\n')"],
      authArgs: ["-e", "process.stdout.write('private@example.test'); process.exit(0)"],
      platform: "linux",
    });
    try {
      const result = await adapter.detect();
      expect(result).toEqual({ agentId: "codex", installed: true, version: "0.4.12", auth: { state: "authenticated", mode: "subscription", verified: true }, problems: [] });
      expect(JSON.stringify(result)).not.toContain("private@example.test");
    } finally { await adapter.dispose(); }
  });

  it("reports login status exit 1 as unauthenticated", async () => {
    const adapter = new CodexAdapter({ binaryPath: process.execPath, versionArgs: ["-e", "process.stdout.write('0.2.0')"], authArgs: ["-e", "process.exit(1)"], platform: "linux" });
    try { expect(await adapter.detect()).toMatchObject({ installed: true, auth: { state: "not_authenticated", verified: true } }); }
    finally { await adapter.dispose(); }
  });

  it("marks API-key auth unverified and detects elevated sandbox setup", async () => {
    const setup = vi.fn(async () => true);
    const adapter = new CodexAdapter({ binaryPath: process.execPath, versionArgs: ["-e", "process.stdout.write('0.2.0')"], platform: "win32", apiKey: "secret-test-key", sandboxSetup: setup });
    try {
      const result = await adapter.detect();
      expect(result).toMatchObject({ installed: true, auth: { state: "authenticated", mode: "api_key", verified: false }, problems: ["Windows sandbox mode: elevated"] });
      expect(setup).toHaveBeenCalledOnce();
      expect(JSON.stringify(result)).not.toContain("secret-test-key");
    } finally { await adapter.dispose(); }
  });

  it("returns unavailable without leaking native resolver diagnostics", async () => {
    const adapter = new CodexAdapter({ platform: "linux" });
    try {
      const result = await adapter.detect();
      expect(result).toMatchObject({ installed: false, auth: { state: "unknown", verified: false }, problems: ["Codex installation could not be verified"] });
      expect(JSON.stringify(result)).not.toContain("CODEX_NATIVE_BINARY_NOT_FOUND");
    } finally { await adapter.dispose(); }
  });
});
