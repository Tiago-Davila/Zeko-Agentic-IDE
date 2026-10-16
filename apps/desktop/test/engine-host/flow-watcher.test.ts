import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FlowWatcher, type FlowFileChanged } from "../../src/engine-host/flow-watcher.js";

describe("flow watcher", () => {
  let root: string | undefined;
  let watcher: FlowWatcher | undefined;

  afterEach(async () => {
    watcher?.close();
    if (root) await rm(root, { recursive: true, force: true });
    root = undefined;
    watcher = undefined;
    vi.useRealTimers();
  });

  it("emits stable hashes for external create/update/delete and ignores unrelated files", async () => {
    root = await mkdtemp(join(tmpdir(), "zeko-flow-watch-"));
    const directory = join(root, ".zeko", "flows");
    await mkdir(directory, { recursive: true });
    const existing = join(directory, "already.flow.yaml");
    await writeFile(existing, "initial", "utf8");
    const changes: FlowFileChanged[] = [];
    watcher = new FlowWatcher("project-1", root, (change) => changes.push(change), 20);
    await watcher.start();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(changes).toHaveLength(0);

    await writeFile(join(directory, "notes.txt"), "ignored", "utf8");
    const created = join(directory, "new.flow.yaml");
    await writeFile(created, "version 1", "utf8");
    await waitFor(() => changes.some((change) => change.flowId === "new"));
    expect(changes.find((change) => change.flowId === "new")).toMatchObject({ projectId: "project-1", flowId: "new" });
    const creationHash = changes.find((change) => change.flowId === "new")?.fileHash;
    expect(creationHash).toMatch(/^[a-f0-9]{64}$/);

    await writeFile(created, "version 2", "utf8");
    await waitFor(() => changes.filter((change) => change.flowId === "new").length >= 2);
    expect(changes.filter((change) => change.flowId === "new").at(-1)?.fileHash).not.toBe(creationHash);
    const changedCount = changes.length;
    await writeFile(created, "version 2", "utf8");
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(changes).toHaveLength(changedCount);

    await unlink(created);
    await waitFor(() => changes.at(-1)?.flowId === "new" && changes.at(-1)?.fileHash === "");
    expect(changes.at(-1)).toEqual({ projectId: "project-1", flowId: "new", fileHash: "" });
  });
});

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for flow watcher event");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
