import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { FlowFileError, FlowFiles } from "../src/flow-files.js";

const flow = { schemaVersion: 1 as const, id: "sample", name: "Sample", nodes: [], edges: [] };

describe("FlowFiles", () => {
  it("round-trips a schema-valid flow canonically", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-flows-"));
    try {
      const files = new FlowFiles(root);
      await files.createFlow("sample", "Sample");
      const loaded = await files.loadFlow("sample");
      expect(loaded.flow).toEqual(flow);
      const saved = await files.saveFlow(flow, loaded.fileHash);
      expect(parse(await readFile(join(root, ".zeko/flows/sample.flow.yaml"), "utf8"))).toEqual(flow);
      expect(saved.fileHash).toMatch(/^[a-f0-9]{64}$/);
      expect(await files.listFlows()).toEqual([{ id: "sample", name: "Sample", valid: true, errorCount: 0 }]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("preserves comments and rejects stale saves with the current hash", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-flows-"));
    try {
      const directory = join(root, ".zeko/flows"); await mkdir(directory, { recursive: true });
      const path = join(directory, "sample.flow.yaml");
      await writeFile(path, "# keep this note\nschemaVersion: 1\nid: sample\nname: Sample\nnodes: []\nedges: []\n", "utf8");
      const files = new FlowFiles(root); const loaded = await files.loadFlow("sample");
      await files.saveFlow(flow, loaded.fileHash);
      expect(await readFile(path, "utf8")).toContain("# keep this note");
      await writeFile(path, `${await readFile(path, "utf8")}# external edit\n`, "utf8");
      await expect(files.saveFlow({ ...flow, name: "mine" }, loaded.fileHash)).rejects.toMatchObject({ code: "FILE_CHANGED_ON_DISK", currentHash: expect.any(String) });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("reports schema and parse locations without changing invalid files", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-flows-"));
    try {
      const directory = join(root, ".zeko/flows"); await mkdir(directory, { recursive: true });
      const path = join(directory, "sample.flow.yaml");
      const invalid = "schemaVersion: nope\nid: sample\nname: Sample\nnodes: []\nedges: []\n";
      await writeFile(path, invalid, "utf8");
      const files = new FlowFiles(root); const loaded = await files.loadFlow("sample");
      expect(loaded.flow).toBeUndefined(); expect(loaded.diagnostics[0]?.location?.line).toBeGreaterThan(0);
      expect(await readFile(path, "utf8")).toBe(invalid);
      await writeFile(path, "schemaVersion: [\n", "utf8");
      expect((await files.loadFlow("sample")).diagnostics[0]).toMatchObject({ code: "FILE_PARSE_ERROR", location: { line: 2 } });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("requires explicit confirmation before deleting flows", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-flows-"));
    try {
      const files = new FlowFiles(root); await files.createFlow("sample");
      await expect(files.deleteFlow("sample", false)).rejects.toBeInstanceOf(FlowFileError);
      await files.deleteFlow("sample", true); expect(await files.listFlows()).toEqual([]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
