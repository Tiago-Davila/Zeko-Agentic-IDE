import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentUsageReading } from "@zeko/contracts";

export interface CodexRolloutData {
  readonly model?: string;
  readonly durationMs?: number;
  readonly rejections: readonly unknown[];
  readonly usage?: AgentUsageReading;
}

export class CodexRolloutReader {
  readonly #home: string;
  readonly #now: () => Date;
  constructor(options: { readonly codexHome: string; readonly now?: () => Date }) {
    this.#home = options.codexHome;
    this.#now = options.now ?? (() => new Date());
  }

  async read(threadId?: string): Promise<CodexRolloutData | undefined> {
    const files = await findRollouts(join(this.#home, "sessions"));
    const matching = files.filter((file) => !threadId || file.includes(threadId)).sort();
    for (const file of matching.reverse()) {
      const data = await this.#readFile(file);
      if (data && (data.model || data.durationMs !== undefined || data.rejections.length || data.usage)) return data;
    }
    return undefined;
  }

  async #readFile(file: string): Promise<CodexRolloutData | undefined> {
    let contents: string;
    try { contents = await readFile(file, "utf8"); } catch { return undefined; }
    return parseCodexRolloutJsonl(contents, this.#now());
  }
}

export function parseCodexRolloutJsonl(contents: string, now = new Date()): CodexRolloutData {
  let model: string | undefined;
  let durationMs: number | undefined;
  let usage: AgentUsageReading | undefined;
  const rejections: unknown[] = [];
    for (const line of contents.split(/\r?\n/u)) {
      try {
        const envelope = record(JSON.parse(line));
        if (!envelope) continue;
        const payload = record(envelope["payload"]) ?? envelope;
        const type = text(payload["type"]) ?? text(envelope["type"]);
        if (type === "turn_context") model = text(payload["model"]) ?? model;
        if (type === "task_complete") durationMs = integer(payload["duration_ms"]) ?? durationMs;
        if (type === "token_count") usage = parseUsage(payload["rate_limits"], now);
        if (type?.toLowerCase().includes("reject")) rejections.push(payload);
      } catch { /* Tolerate partial final JSONL records. */ }
    }
  return { ...(model ? { model } : {}), ...(durationMs === undefined ? {} : { durationMs }), rejections, ...(usage ? { usage } : {}) };
}

async function findRollouts(root: string): Promise<string[]> {
  const output: string[] = [];
  const walk = async (path: string): Promise<void> => {
    let entries;
    try { entries = await readdir(path, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const fullPath = join(path, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile() && /^rollout-.*\.jsonl$/u.test(entry.name)) output.push(fullPath);
    }
  };
  await walk(root);
  return output;
}

function parseUsage(value: unknown, now: Date): AgentUsageReading | undefined {
  const root = record(value);
  if (!root) return undefined;
  const windows = Object.entries(root).flatMap(([key, candidate]) => {
    const item = record(candidate);
    const percent = item ? number(item["used_percent"]) : undefined;
    if (percent === undefined) return [];
    const resetsAt = item ? text(item["resets_at"]) : undefined;
    return [{ name: key, utilization: Math.max(0, Math.min(1, percent / 100)), ...(resetsAt ? { resetsAt: normalizeReset(resetsAt) } : {}) }];
  });
  if (!windows.length) return undefined;
  return { agentId: "codex", authMode: "subscription", windows, readAt: now.toISOString(), live: false, source: "codex-rollout" };
}

function normalizeReset(value: string): string | undefined {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
function record(value: unknown): Record<string, unknown> | undefined { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function text(value: unknown): string | undefined { return typeof value === "string" && value.length ? value : undefined; }
function number(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function integer(value: unknown): number | undefined { const result = number(value); return result !== undefined && Number.isInteger(result) && result >= 0 ? result : undefined; }
