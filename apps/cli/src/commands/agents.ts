import { resolve } from "node:path";
import { createZekoRuntime } from "@zeko/runtime";

export async function agentsCheckCommand(options: {
  project?: string; json?: boolean; stdout?: (line: string) => void; stderr?: (line: string) => void;
  createRuntime?: typeof createZekoRuntime; runtimeOptions?: Parameters<typeof createZekoRuntime>[0];
}): Promise<number> {
  const stdout = options.stdout ?? ((line) => process.stdout.write(`${line}\n`));
  const stderr = options.stderr ?? ((line) => process.stderr.write(`${line}\n`));
  const runtime = await (options.createRuntime ?? createZekoRuntime)(options.runtimeOptions);
  try {
    const project = await runtime.openProject(resolve(options.project ?? process.cwd()));
    const status = await runtime.agentsStatus(project.projectId);
    if (options.json) stdout(JSON.stringify({ type: "agents.check", ...status }));
    else for (const agent of status.agents) stdout(`${agent.agentId}: ${agent.installed ? agent.auth.state : "not installed"}${agent.auth.mode ? ` (${agent.auth.mode})` : ""}`);
    return status.agents.every((agent) => agent.installed && agent.auth.state === "authenticated") ? 0 : 3;
  } catch (error) { stderr(error instanceof Error ? error.message : String(error)); return 3; }
  finally { runtime.close(); }
}
