import { basename, resolve } from "node:path";
import { createZekoRuntime } from "@zeko/runtime";

interface Diagnostic {
  code: string;
  severity: string;
  params: Record<string, unknown>;
  nodeId?: string | undefined;
  location?: { line?: number | undefined; column?: number | undefined } | undefined;
}

export interface ValidateCommandOptions {
  readonly flow: string;
  readonly project?: string;
  readonly json?: boolean;
  readonly stdout?: (line: string) => void;
  readonly stderr?: (line: string) => void;
  readonly createRuntime?: typeof createZekoRuntime;
}

export function diagnosticLine(file: string, diagnostic: Diagnostic): string {
  const location = diagnostic.location?.line ? `:${diagnostic.location.line}${diagnostic.location.column ? `:${diagnostic.location.column}` : ""}` : "";
  const node = diagnostic.nodeId ? ` node=${diagnostic.nodeId}` : "";
  const detail = typeof diagnostic.params["message"] === "string" ? ` ${diagnostic.params["message"]}` : "";
  return `${file}${location}${node}: ${diagnostic.severity} ${diagnostic.code}${detail}`;
}

export async function validateCommand(options: ValidateCommandOptions): Promise<number> {
  const stdout = options.stdout ?? ((line) => process.stdout.write(`${line}\n`));
  const stderr = options.stderr ?? ((line) => process.stderr.write(`${line}\n`));
  const projectRoot = resolve(options.project ?? process.cwd());
  const flowId = basename(options.flow).replace(/\.flow\.yaml$/, "");
  const runtime = await (options.createRuntime ?? createZekoRuntime)();
  try {
    const project = await runtime.openProject(projectRoot);
    const loaded = await runtime.loadFlow(project.projectId, flowId);
    const diagnostics = loaded.flow ? [...loaded.diagnostics, ...(await runtime.validateFlow(project.projectId, loaded.flow)).diagnostics] : loaded.diagnostics;
    if (options.json) stdout(JSON.stringify({ type: "validation", diagnostics }));
    else if (diagnostics.length === 0) stdout(`Valid flow: ${flowId}`);
    else for (const diagnostic of diagnostics) stderr(diagnosticLine(`${projectRoot}/.zeko/flows/${flowId}.flow.yaml`, diagnostic));
    return diagnostics.some((diagnostic) => diagnostic.severity === "error") || !loaded.flow ? 2 : 0;
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 3;
  } finally { runtime.close(); }
}
