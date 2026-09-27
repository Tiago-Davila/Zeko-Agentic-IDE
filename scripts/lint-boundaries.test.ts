import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

async function hasBoundaryError(filePath: string, source: string): Promise<boolean> {
  const [result] = await eslint.lintText(source, { filePath });
  return (result?.messages.length ?? 0) > 0;
}

describe("package import boundaries", () => {
  it("rejects filesystem imports in core", async () => {
    expect(await hasBoundaryError("packages/core/src/leak.ts", 'import "node:fs";')).toBe(true);
  }, 15_000);

  it("rejects core imports from adapters", async () => {
    expect(await hasBoundaryError("packages/adapters/src/leak.ts", 'import "@zeko/core";')).toBe(true);
  });

  it("rejects peer infrastructure imports", async () => {
    expect(await hasBoundaryError("packages/git/src/leak.ts", 'import "@zeko/storage";')).toBe(true);
  });

  it("rejects testing helpers from source", async () => {
    expect(await hasBoundaryError("packages/core/src/leak.ts", 'import "@zeko/testing";')).toBe(true);
  });

  it("rejects Node imports from the renderer", async () => {
    expect(await hasBoundaryError("apps/desktop/src/renderer/leak.ts", 'import "node:fs";')).toBe(true);
  });
});
