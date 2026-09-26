import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { workspacesDeleteCommand } from "../src/commands/workspaces.js";

describe("zeko workspaces delete", () => {
  it("preserves workspace data and exits 64 when non-TTY confirmation is absent", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-workspace-delete-"));
    try {
      const workspace = join(root, "worktree", "sentinel.txt");
      await mkdir(join(root, "worktree"), { recursive: true });
      await writeFile(workspace, "keep me", "utf8");
      const createRuntime = vi.fn(async () => { throw new Error("runtime must not be constructed"); });
      const errors: string[] = [];
      const code = await workspacesDeleteCommand({ runId: "run-id", stdinIsTTY: false, stderr: (line) => errors.push(line), createRuntime: createRuntime as never });
      expect(code).toBe(64); expect(createRuntime).not.toHaveBeenCalled();
      expect(await readFile(workspace, "utf8")).toBe("keep me"); expect(errors.join(" ")).toContain("CONFIRMATION_REQUIRED");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("passes confirmed deletion to the runtime after --yes", async () => {
    const deleted: unknown[] = []; let closed = false;
    const createRuntime = (async () => ({ deleteWorkspaces: async (runId: string, confirmed: boolean) => { deleted.push([runId, confirmed]); return { deleted: 2 }; }, close: () => { closed = true; } })) as never;
    const output: string[] = [];
    expect(await workspacesDeleteCommand({ runId: "run", yes: true, createRuntime, stdout: (line) => output.push(line) })).toBe(0);
    expect(deleted).toEqual([["run", true]]); expect(closed).toBe(true); expect(output[0]).toContain("Deleted 2");
  });
});
