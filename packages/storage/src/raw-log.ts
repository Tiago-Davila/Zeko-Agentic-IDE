import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PersistedEvent } from "@zeko/contracts";
import type { Redacted } from "./redactor.js";

export class RawLogWriter {
  constructor(private readonly root = process.env["LOCALAPPDATA"]
    ? join(process.env["LOCALAPPDATA"], "Zeko", "logs")
    : join(process.env["XDG_STATE_HOME"] ?? join(process.env["HOME"] ?? ".", ".local", "state"), "zeko", "logs")) {}

  async append(event: Redacted<PersistedEvent>, nodeId: string, seq?: number): Promise<void> {
    if (!event.attemptId) return;
    const safeNode = nodeId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeAttempt = event.attemptId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const path = join(this.root, event.runId, `${safeNode}-${safeAttempt}.jsonl`);
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify({ ...(seq === undefined ? {} : { seq }), ...event })}\n`, { encoding: "utf8", flag: "a" });
  }
}
