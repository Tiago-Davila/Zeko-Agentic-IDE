import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";
import { describe, expect, it } from "vitest";
import { FakeAdapter } from "../../adapters/src/fake/fake-adapter.js";
import { createZekoRuntime } from "../src/create-runtime.js";

const execFile = promisify(execFileCallback);
async function git(root: string, ...args: string[]) { return (await execFile("git", args, { cwd: root })).stdout.trim(); }

describe("SC-008 CLI/desktop equivalence", () => {
  it("uses the same runtime and produces identical final NodeResults for both origins", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-equivalence-"));
    const localData = process.env["LOCALAPPDATA"] ?? join(homedir(), ".local", "share");
    const stateRoot = join(localData, `zeko-equivalence-${process.pid}-${Date.now()}`);
    const scenarioPath = join(root, "scenario.json");
    const adapter = new FakeAdapter({ scenarioPath });
    let runtime: Awaited<ReturnType<typeof createZekoRuntime>> | undefined;
    try {
      await git(root, "init", "--quiet"); await git(root, "config", "user.name", "Test"); await git(root, "config", "user.email", "test@example.invalid");
      await writeFile(join(root, "seed.txt"), "base\n"); await git(root, "add", "."); await git(root, "commit", "--quiet", "-m", "base");
      await mkdir(join(root, ".zeko/flows"), { recursive: true });
      await writeFile(join(root, ".zeko/flows/equiv.flow.yaml"), "schemaVersion: 1\nid: equiv\nname: Equivalence\nnodes:\n  - id: goal\n    type: input\n    position: { x: 0, y: 0 }\n    objective: Shared task\n  - id: a\n    type: agent\n    position: { x: 1, y: 0 }\n    agent: claude-code\n    models:\n      claude-code: { model: fake }\n    instructions: Build artifact\n    acceptanceCriteria: []\n    writeScope: [artifact.txt]\n    terminal: { enabled: false, allowedCommands: [] }\n    limits: { timeoutMinutes: 2, maxTurns: 5, maxRetries: 0 }\nedges:\n  - { from: goal, to: a }\n", "utf8");
      await writeFile(scenarioPath, JSON.stringify({ mode: "native", files: [{ path: "artifact.txt", content: "same result\n" }], outcome: { kind: "exited", exitCode: 0, durationMs: 10 }, reportCandidate: { state: "valid", report: { status: "COMPLETED", summary: "Done", filesChanged: ["artifact.txt"], checks: [], blockers: [], findings: [] } } }), "utf8");
      const wrapped = {
        id: "claude-code" as const,
        capabilities: (platform: "win32" | "linux") => adapter.capabilities(platform),
        detect: async () => ({ ...(await adapter.detect()), agentId: "claude-code" as const }),
        readUsage: () => adapter.readUsage(),
        launch: (spec: Parameters<FakeAdapter["launch"]>[0]) => adapter.launch({ ...spec, agentId: "fake" }),
        requestReport: (execution: Parameters<FakeAdapter["requestReport"]>[0], spec: Parameters<FakeAdapter["requestReport"]>[1]) => adapter.requestReport(execution, { ...spec, agentId: "fake" }),
      };
      runtime = await createZekoRuntime({ dbPath: join(stateRoot, "zeko.db"), worktreeRoot: join(stateRoot, "wt"), adapters: { "claude-code": wrapped } });
      const project = await runtime.openProject(root); const loaded = await runtime.loadFlow(project.projectId, "equiv");
      expect(loaded.flow).toBeDefined();
      const nodeResults: Record<string, Array<{ nodeId: unknown; result: unknown }>> = { cli: [], desktop: [] };
      const unsubscribe = runtime.subscribe((event) => {
        if (event.type === "node.result") nodeResults[event.runId === cliRunId ? "cli" : "desktop"]?.push(event.payload as { nodeId: unknown; result: unknown });
      });
      const cli = await runtime.startRun(project.projectId, "equiv", loaded.fileHash, "cli"); const cliRunId = cli.runId;
      const cliResult = await cli.wait;
      const desktop = await runtime.startRun(project.projectId, "equiv", loaded.fileHash, "desktop");
      await desktop.wait;
      unsubscribe();
      expect(cliResult.run.origin).toBe("cli");
      expect(nodeResults["cli"]).toHaveLength(1); expect(nodeResults["desktop"]).toHaveLength(1);
      expect(nodeResults["desktop"]).toEqual(nodeResults["cli"]);
    } finally {
      runtime?.close(); await adapter.dispose(); await rm(stateRoot, { recursive: true, force: true }); await rm(root, { recursive: true, force: true });
    }
  }, 30_000);
});
