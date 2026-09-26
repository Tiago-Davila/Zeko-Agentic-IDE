#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runCommand } from "./commands/run.js";
import { validateCommand } from "./commands/validate.js";
import { runsListCommand, runsShowCommand } from "./commands/runs.js";

export async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;
  if (command === "runs") {
    const [subcommand, value, ...tail] = rest;
    const flags = parseFlags(tail);
    if (!flags || (subcommand !== "list" && subcommand !== "show")) return usage();
    if (subcommand === "show") return value ? runsShowCommand({ runId: value, json: flags.json }) : usage();
    const limit = flags.limit === undefined ? 50 : Number(flags.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) return usage();
    return runsListCommand({ ...(flags.project ? { project: flags.project } : {}), ...(flags.flow ? { flow: flags.flow } : {}), limit, json: flags.json });
  }
  if (command !== "validate" && command !== "run") return usage();
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let index = 0; index < rest.length; index++) {
    const item = rest[index];
    if (!item) continue;
    if (item === "--json" || item === "--no-color") flags.set(item.slice(2), true);
    else if (item === "--project") {
      const value = rest[++index]; if (!value) return usage(); flags.set("project", value);
    } else if (item.startsWith("-")) return usage();
    else positional.push(item);
  }
  if (positional.length !== 1) return usage();
  const options = { flow: positional[0]!, ...(typeof flags.get("project") === "string" ? { project: resolve(flags.get("project") as string) } : {}), json: flags.get("json") === true };
  if (command === "validate") return validateCommand(options);
  return runCommand(options);
}

function usage(): number {
  process.stderr.write("Usage: zeko validate <flow> [--project <dir>] [--json]\n       zeko run <flow> [--project <dir>] [--json] [--no-color]\n");
  return 64;
}

function parseFlags(args: string[]): { project?: string; flow?: string; limit?: string; json: boolean } | undefined {
  const output: { project?: string; flow?: string; limit?: string; json: boolean } = { json: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]; if (!arg) continue;
    if (arg === "--json") output.json = true;
    else if (arg === "--project" || arg === "--flow" || arg === "--limit") {
      const value = args[++index]; if (!value) return undefined;
      if (arg === "--project") output.project = value;
      else if (arg === "--flow") output.flow = value;
      else output.limit = value;
    } else return undefined;
  }
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
