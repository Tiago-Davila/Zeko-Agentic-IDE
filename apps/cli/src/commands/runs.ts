import { resolve } from "node:path";
import { createZekoRuntime } from "@zeko/runtime";

export async function runsListCommand(options: { project?: string; flow?: string; limit?: number; json?: boolean; stdout?: (line: string) => void; stderr?: (line: string) => void; createRuntime?: typeof createZekoRuntime; runtimeOptions?: Parameters<typeof createZekoRuntime>[0] }): Promise<number> {
  const stdout = options.stdout ?? ((line) => process.stdout.write(`${line}\n`));
  const stderr = options.stderr ?? ((line) => process.stderr.write(`${line}\n`));
  const runtime = await (options.createRuntime ?? createZekoRuntime)(options.runtimeOptions);
  try {
    const project = await runtime.openProject(resolve(options.project ?? process.cwd()));
    const runs = await runtime.listRuns(project.projectId, options.flow, options.limit ?? 50);
    if (options.json) stdout(JSON.stringify({ type: "runs.list", runs }));
    else if (!runs.length) stdout("No runs found.");
    else for (const run of runs as Array<{ id: string; flowId: string; status: string; startedAt: number; endedAt?: number }>) stdout(`${run.id} ${run.flowId} ${run.status} ${new Date(run.startedAt).toISOString()}${run.endedAt ? ` – ${new Date(run.endedAt).toISOString()}` : ""}`);
    return 0;
  } catch (error) { stderr(error instanceof Error ? error.message : String(error)); return 3; }
  finally { runtime.close(); }
}

export async function runsShowCommand(options: { runId: string; json?: boolean; stdout?: (line: string) => void; stderr?: (line: string) => void; createRuntime?: typeof createZekoRuntime; runtimeOptions?: Parameters<typeof createZekoRuntime>[0] }): Promise<number> {
  const stdout = options.stdout ?? ((line) => process.stdout.write(`${line}\n`));
  const stderr = options.stderr ?? ((line) => process.stderr.write(`${line}\n`));
  const runtime = await (options.createRuntime ?? createZekoRuntime)(options.runtimeOptions);
  try {
    const detail = await runtime.getRun(options.runId);
    if (!detail) { stderr(`Run not found: ${options.runId}`); return 64; }
    if (options.json) stdout(JSON.stringify({ type: "runs.show", ...detail }));
    else {
      const run = detail.run;
      stdout(`Run ${run.id} · ${run.flowName} · ${run.status} · ${run.startedAt}`);
      const nodes = detail.nodeRuns as unknown as Array<{ nodeId: string; status: string; agentId?: string; reasonCode?: string }>;
      for (const node of nodes) stdout(`  ${node.nodeId}: ${node.status}${node.agentId ? ` (${node.agentId})` : ""}${node.reasonCode ? ` — ${node.reasonCode}` : ""}`);
      for (const process of detail.processes) stdout(`  process pid=${process.pid} creationTime=${process.creationTime} root=${process.isRoot} ended=${process.endedAt ?? "live"}`);
    }
    return 0;
  } catch (error) { stderr(error instanceof Error ? error.message : String(error)); return 5; }
  finally { runtime.close(); }
}
