import { NormalizedEventSchema, type NormalizedEvent } from "@zeko/contracts";

type JsonRecord = Record<string, unknown>;

export interface ClaudeStreamParserOptions {
  readonly attemptId: string;
  readonly requestedModel: string;
  readonly now?: () => Date;
}

/** Turns one Claude stream-json line into zero or more contract events. */
export class ClaudeStreamParser {
  readonly #attemptId: string;
  readonly #requestedModel: string;
  readonly #now: () => Date;
  readonly #denialIds = new Set<string>();
  readonly #denialKeys = new Set<string>();
  #result: JsonRecord | undefined;

  constructor(options: ClaudeStreamParserOptions) {
    this.#attemptId = options.attemptId;
    this.#requestedModel = options.requestedModel;
    this.#now = options.now ?? (() => new Date());
  }

  get result(): Readonly<JsonRecord> | undefined {
    return this.#result;
  }

  parse(line: string): NormalizedEvent[] {
    let raw: unknown;
    try {
      raw = JSON.parse(line) as unknown;
    } catch {
      return [this.#event({ type: "raw", data: line })];
    }
    const record = asRecord(raw);
    if (!record) return [this.#event({ type: "raw", data: raw })];

    if (record["type"] === "system" && record["subtype"] === "init") return this.#parseInit(record);
    if (record["type"] === "system" && record["subtype"] === "permission_denied") return this.#parseDenial(record);
    if (record["type"] === "assistant") return this.#parseAssistant(record);
    if (record["type"] === "user") return this.#parseUser(record);
    if (record["type"] === "rate_limit_event") return this.#parseRateLimit(record);
    if (record["type"] === "result") {
      this.#result = record;
      return this.#parseResultDenials(record);
    }
    return [this.#event({ type: "raw", data: raw })];
  }

  #parseInit(raw: JsonRecord): NormalizedEvent[] {
    const model = stringValue(raw["model"]);
    const events: NormalizedEvent[] = [this.#event({
      type: "session_started",
      sessionId: stringValue(raw["session_id"]) ?? "",
      ...(model ? { model } : {}),
      ...(stringArray(raw["tools"]) ? { tools: stringArray(raw["tools"]) } : {}),
      ...(stringValue(raw["claude_code_version"]) ? { agentVersion: stringValue(raw["claude_code_version"]) } : {}),
    })];
    if (model && model !== this.#requestedModel) {
      events.push(this.#event({ type: "model_mismatch", requested: this.#requestedModel, effective: model }));
    }
    return events;
  }

  #parseAssistant(raw: JsonRecord): NormalizedEvent[] {
    const message = asRecord(raw["message"]);
    if (!message || !Array.isArray(message["content"])) return [];
    const subagent = stringValue(raw["parent_tool_use_id"]);
    const events: NormalizedEvent[] = [];
    for (const blockValue of message["content"]) {
      const block = asRecord(blockValue);
      if (!block) continue;
      if (block["type"] === "text" && typeof block["text"] === "string") {
        events.push(this.#event({ type: "assistant_text", text: block["text"], ...(subagent ? { subagent } : {}) }));
      } else if (block["type"] === "tool_use" && typeof block["name"] === "string") {
        events.push(this.#event({
          type: "tool_call",
          ...(stringValue(block["id"]) ? { toolUseId: stringValue(block["id"]) } : {}),
          name: block["name"],
          input: block["input"] ?? {},
        }));
      }
      // Thinking and all streamed partial deltas are intentionally discarded.
    }
    return events;
  }

  #parseUser(raw: JsonRecord): NormalizedEvent[] {
    const message = asRecord(raw["message"]);
    if (!message || !Array.isArray(message["content"])) return [];
    const events: NormalizedEvent[] = [];
    for (const blockValue of message["content"]) {
      const block = asRecord(blockValue);
      if (block?.["type"] !== "tool_result") continue;
      const content = block["content"];
      const text = typeof content === "string" ? content : Array.isArray(content)
        ? content.map((part) => stringValue(asRecord(part)?.["text"])).filter(Boolean).join("\n")
        : content === undefined ? "" : JSON.stringify(content);
      events.push(this.#event({
        type: "tool_result",
        ...(stringValue(block["tool_use_id"]) ? { toolUseId: stringValue(block["tool_use_id"]) } : {}),
        ok: block["is_error"] !== true,
        content: text,
      }));
    }
    return events;
  }

  #parseDenial(raw: JsonRecord): NormalizedEvent[] {
    return this.#denial({
      id: stringValue(raw["tool_use_id"]),
      tool: stringValue(raw["tool_name"]) ?? "unknown",
      reason: stringValue(raw["message"]) ?? stringValue(raw["decision_reason"]) ?? "Permission denied",
      input: raw["input"],
    });
  }

  #parseResultDenials(raw: JsonRecord): NormalizedEvent[] {
    if (!Array.isArray(raw["permission_denials"])) return [];
    const events: NormalizedEvent[] = [];
    for (const denialValue of raw["permission_denials"]) {
      const denial = asRecord(denialValue);
      if (!denial) continue;
      events.push(...this.#denial({
        id: stringValue(denial["tool_use_id"]),
        tool: stringValue(denial["tool_name"]) ?? "unknown",
        reason: stringValue(denial["message"]) ?? stringValue(denial["reason"]) ?? "Permission denied",
        input: denial["input"],
      }));
    }
    return events;
  }

  #denial(input: { id: string | undefined; tool: string; reason: string; input: unknown }): NormalizedEvent[] {
    if (input.id) {
      if (this.#denialIds.has(input.id)) return [];
      this.#denialIds.add(input.id);
    } else {
      const key = `${input.tool}\0${input.reason}\0${stableJson(input.input)}`;
      if (this.#denialKeys.has(key)) return [];
      this.#denialKeys.add(key);
    }
    return [this.#event({ type: "permission_denied", tool: input.tool, reason: input.reason, ...(input.input === undefined ? {} : { input: input.input }) })];
  }

  #parseRateLimit(raw: JsonRecord): NormalizedEvent[] {
    const info = asRecord(raw["rate_limit_info"]);
    const windows = asRecord(info?.["unifiedWindows"]);
    if (!windows) return [this.#event({ type: "raw", data: raw })];
    const nowMs = this.#now().getTime();
    const normalized = Object.entries(windows).flatMap(([name, value]) => {
      const window = asRecord(value);
      const utilization = numberValue(window?.["utilization"]);
      if (utilization === undefined || utilization < 0 || utilization > 1) return [];
      const resetMs = epochMilliseconds(window?.["resetsAt"]);
      if (resetMs !== undefined && resetMs <= nowMs) return [];
      return [{ name, utilization, ...(resetMs === undefined ? {} : { resetsAt: new Date(resetMs).toISOString() }) }];
    });
    if (normalized.length === 0) return [];
    return [this.#event({
      type: "subscription_usage",
      agentId: "claude-code",
      authMode: "detect",
      windows: normalized,
      readAt: this.#now().toISOString(),
      live: true,
      source: "rate_limit_event",
    })];
  }

  #event(fields: Record<string, unknown>): NormalizedEvent {
    return NormalizedEventSchema.parse({ ts: this.#now().toISOString(), attemptId: this.#attemptId, ...fields });
  }
}

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function epochMilliseconds(value: unknown): number | undefined {
  const numeric = numberValue(value);
  if (numeric === undefined) return undefined;
  return numeric < 100_000_000_000 ? numeric * 1000 : numeric;
}

function stableJson(value: unknown): string {
  if (value === undefined) return "";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = asRecord(value);
  if (record) return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
