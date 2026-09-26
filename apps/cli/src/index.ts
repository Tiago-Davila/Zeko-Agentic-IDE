#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runCommand } from "./commands/run.js";
import { validateCommand } from "./commands/validate.js";

export async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
