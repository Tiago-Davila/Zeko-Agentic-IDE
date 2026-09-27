import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CodexBinaryError, resolveCodexBinary } from "../../src/codex/binary.ts";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("resolveCodexBinary", () => {
  it("finds the native binary in the npm package tree instead of its shim", () => {
    const root = mkdtempSync(join(tmpdir(), "zeko-codex-binary-")); roots.push(root);
    const bin = join(root, "npm");
    const native = join(bin, "node_modules", "@openai", "codex", "node_modules", "@openai", "codex-win32-x64", "vendor", "x86_64-pc-windows-msvc", "bin", "codex.exe");
    mkdirSync(dirname(native), { recursive: true });
    writeFileSync(native, "native fixture");
    writeFileSync(join(bin, "codex.cmd"), "node shim fixture");

    expect(resolveCodexBinary({ platform: "win32", env: { PATH: bin, ZEKO_TEST: "0" } })).toBe(native);
  });

  it("rejects a shim when no native package binary is present", () => {
    const root = mkdtempSync(join(tmpdir(), "zeko-codex-shim-")); roots.push(root);
    writeFileSync(join(root, "codex.cmd"), "node shim fixture");
    try {
      resolveCodexBinary({ platform: "win32", env: { PATH: root, ZEKO_TEST: "0" } });
      expect.fail("expected native Codex lookup to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(CodexBinaryError);
      expect((error as CodexBinaryError).code).toBe("CODEX_NATIVE_BINARY_NOT_FOUND");
    }
  });

  it("accepts an injected native executable and rejects injected command shims", () => {
    expect(resolveCodexBinary({ binaryPath: process.execPath, platform: "win32" })).toBe(process.execPath);
    expect(captureError(() => resolveCodexBinary({ binaryPath: "codex.cmd", platform: "win32", exists: () => true })))
      .toMatchObject({ code: "CODEX_SHIM_UNSUPPORTED" });
  });

  it("requires injection under ZEKO_TEST", () => {
    expect(captureError(() => resolveCodexBinary({ platform: "win32", env: { PATH: "C:/codex", ZEKO_TEST: "1" } })))
      .toMatchObject({ code: "CODEX_BINARY_NOT_INJECTED" });
  });
});

function captureError(action: () => unknown): unknown {
  try { action(); } catch (error) { return error; }
  throw new Error("Expected operation to throw");
}
