import { resolve } from "node:path";
import { createZekoRuntime } from "@zeko/runtime";
import { summarizeRun } from "../output/summary.js";

export interface RunCommandOptions {
  readonly flow: string;
  readonly project?: string;
  readonly json?: boolean;
  readonly stdinIsTTY?: boolean;
  readonly stdout?: (line: string) => void;
  readonly stderr?: (line: string) => void;
  readonly createRuntime?: typeof createZekoRuntime;
  readonly runtimeOptions?: Parameters<typeof createZekoRuntime>[0];
}

export async function runCommand(options: RunCommandOptions): Promise<number> {
  const stdout = options.stdout ?? ((line) => process.stdout.write(`${line}\n`));
  const stderr = options.stderr ?? ((line) => process.stderr.write(`${line}\n`));
  const projectRoot = resolve(options.project ?? process.cwd());
  const factory = options.createRuntime ?? createZekoRuntime;
  const runtime = await factory(options.runtimeOptions);
  let exitCode = 5;
  try {
    const project = await runtime.openProject(projectRoot);
    const flowId = options.flow.replaceAll("\\", "/").split("/").at(-1)?.replace(/\.flow\.yaml$/, "") ?? options.flow;
    const loaded = await runtime.loadFlow(project.projectId, flowId);
    const validation = loaded.flow ? await runtime.validateFlow(project.projectId, loaded.flow) : { diagnostics: loaded.diagnostics };
    const diagnostics = [...loaded.diagnostics, ...validation.diagnostics];
    if (!loaded.flow || diagnostics.some((item) => item.severity === "error")) {
      emit(options.json, stdout, stderr, { type: "validation", diagnostics });
      return 2;
    }
    const approvalNeeded = loaded.flow.nodes.some((node) => node.type === "approval");
    if (approvalNeeded && !(options.stdinIsTTY ?? process.stdin.isTTY)) {
      stderr("APPROVAL_REQUIRES_TTY: this flow requires an interactive approval prompt");
      return 3;
    }
    const preflight = await runtime.preflight(project.projectId, flowId);
    emit(options.json, stdout, stderr, { type: "preflight", ok: preflight.ok, diagnostics: preflight.diagnostics, agents: preflight.agents, warnings: preflight.warnings });
    if (!preflight.ok) return 3;
    let runId = "";
    let finished = false;
    const unsubscribe = runtime.subscribe((event) => {
      const payload = event.payload as Record<string, unknown>;
      if (event.type === "run.started") {
        runId = event.runId ?? "";
        emit(options.json, stdout, stderr, { type: "run.started", runId, flowId, origin: "cli", warnings: payload["warnings"] ?? [] });
      } else if (event.type === "node.state") {
        const nodeId = String(payload["nodeId"] ?? "?");
        emit(options.json, stdout, stderr, { type: "node.state", runId: event.runId ?? runId, nodeId, status: payload["status"], ...(payload["reason"] ? { reason: payload["reason"] } : {}) });
        if (!options.json) stderr(`[${new Date().toTimeString().slice(0, 8)}] ${nodeId} ${String(payload["status"])}${payload["reason"] && typeof payload["reason"] === "object" ? ` ${(payload["reason"] as { code?: string }).code ?? ""}` : ""}`);
      } else if (event.type === "approval.requested") emit(options.json, stdout, stderr, { type: "approval.requested", runId: event.runId ?? runId, nodeId: payload["nodeId"], summary: payload["summary"] });
      else if (event.type === "node.result") emit(options.json, stdout, stderr, { type: "node.result", runId: event.runId ?? runId, nodeId: payload["nodeId"], result: payload["result"] });
      else if (event.type === "run.finished") finished = true;
    });
    const started = await runtime.startRun(project.projectId, flowId, loaded.fileHash, "cli");
    runId = started.runId;
    const result = await started.wait;
    unsubscribe();
    const nodes = [...result.nodeRuns.values()].map((node) => ({ nodeId: node.nodeId, status: node.status, ...(node.agentId ? { agentId: node.agentId } : {}), ...(node.reason ? { reason: node.reason } : {}), ...(node.cost ? { cost: node.cost } : {}), ...(node.consumption ? { consumption: node.consumption } : {}) }));
    emit(options.json, stdout, stderr, { type: "run.finished", runId, status: result.run.status, ...(result.run.outcome ? { outcome: result.run.outcome } : {}), totals: result.run.totals, nodes });
    if (!options.json) for (const line of summarizeRun(runId, result.run, nodes)) stdout(line);
    exitCode = result.run.status === "cancelled" ? 4 : result.run.status === "finished" && nodes.every((node) => node.status === "completed" || node.status === "approved") ? 0 : 1;
    void finished;
    return exitCode;
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return exitCode;
  } finally { runtime.close(); }
}

function emit(json: boolean | undefined, stdout: (line: string) => void, stderr: (line: string) => void, event: Record<string, unknown>) {
  const line = JSON.stringify(event);
  if (json) stdout(line);
  else if (event["type"] === "validation") {
    for (const diagnostic of event["diagnostics"] as Array<{ code: string; severity: string; nodeId?: string; location?: { line?: number; column?: number } }>) stderr(`${diagnostic.location?.line ?? "?"}:${diagnostic.location?.column ?? "?"} ${diagnostic.nodeId ?? ""} ${diagnostic.severity} ${diagnostic.code}`);
  }
}
