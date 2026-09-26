import { createInterface } from "node:readline/promises";
import { stdin, stderr as processStderr } from "node:process";
import { createZekoRuntime } from "@zeko/runtime";

export async function workspacesDeleteCommand(options: {
  runId: string; yes?: boolean; stdinIsTTY?: boolean;
  stdout?: (line: string) => void; stderr?: (line: string) => void;
  confirmPrompt?: () => Promise<boolean>;
  createRuntime?: typeof createZekoRuntime; runtimeOptions?: Parameters<typeof createZekoRuntime>[0];
}): Promise<number> {
  const stdout = options.stdout ?? ((line) => process.stdout.write(`${line}\n`));
  const stderr = options.stderr ?? ((line) => process.stderr.write(`${line}\n`));
  const isTTY = options.stdinIsTTY ?? process.stdin.isTTY;
  if (!options.yes && !isTTY) { stderr("CONFIRMATION_REQUIRED: pass --yes or run this command in a TTY"); return 64; }
  const confirmed = options.yes ?? await (options.confirmPrompt ?? promptConfirmation)();
  if (!confirmed) { stderr("Workspace deletion cancelled"); return 64; }
  const runtime = await (options.createRuntime ?? createZekoRuntime)(options.runtimeOptions);
  try {
    const result = await runtime.deleteWorkspaces(options.runId, true);
    stdout(`Deleted ${result.deleted} workspace(s) for run ${options.runId}`);
    return 0;
  } catch (error) { stderr(error instanceof Error ? error.message : String(error)); return 5; }
  finally { runtime.close(); }
}

async function promptConfirmation(): Promise<boolean> {
  processStderr.write("Delete isolated workspaces for this run? This cannot be undone.\n");
  const reader = createInterface({ input: stdin, output: processStderr });
  try { return (await reader.question("Delete workspaces? [y/N] ")).trim().toLowerCase() === "y"; }
  finally { reader.close(); }
}
