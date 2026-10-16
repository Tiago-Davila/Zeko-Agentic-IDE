import { NormalizedEventSchema, type NormalizedEvent } from "@zeko/contracts";

type JsonRecord = Record<string, unknown>;

export class CodexExecParser {
  readonly #attemptId: string;
  readonly #now: () => Date;

  constructor(options: { readonly attemptId: string; readonly now?: () => Date }) {
    this.#attemptId = options.attemptId;
    this.#now = options.now ?? (() => new Date());
  }

  parse(line: string): NormalizedEvent[] {
    let value: unknown;
    try { value = JSON.parse(line); } catch { return []; }
    const event = asRecord(value);
    if (!event) return [];
    if (event["type"] === "thread.started") {
      const threadId = stringValue(event["thread_id"]);
      return threadId ? [this.#event({ type: "session_started", sessionId: threadId })] : [this.#raw(event)];
    }
    if (event["type"] === "turn.completed") return this.#parseTurnCompleted(event);
    if (event["type"] === "turn.failed") return [this.#raw(event)];
    if (event["type"] === "error") return [this.#raw(event)];
    if (event["type"] !== "item.started" && event["type"] !== "item.completed") return [];
    const item = asRecord(event["item"]);
    if (!item) return [this.#raw(event)];
    const itemType = stringValue(item["type"]);
    if (itemType === "agent_message" && event["type"] === "item.completed") {
      const text = stringValue(item["text"]);
      return text === undefined ? [] : [this.#event({ type: "assistant_text", text })];
    }
    if (itemType === "reasoning" || itemType === "error") return [this.#raw(event)];
    if (itemType && ["command_execution", "file_change", "mcp_tool_call", "web_search"].includes(itemType)) {
      if (event["type"] === "item.started") {
        return [this.#event({ type: "tool_call", toolUseId: stringValue(item["id"]), name: itemType, input: item })];
      }
      return [this.#event({
        type: "tool_result",
        toolUseId: stringValue(item["id"]),
        ok: item["status"] === undefined ? true : item["status"] === "completed",
        content: JSON.stringify(item),
      })];
    }
    return [this.#raw(event)];
  }

  #parseTurnCompleted(event: JsonRecord): NormalizedEvent[] {
    const usage = asRecord(event["usage"]);
    if (!usage) return [];
    const inputTokens = numberValue(usage["input_tokens"]);
    const outputTokens = numberValue(usage["output_tokens"]);
    const cacheReadTokens = numberValue(usage["cached_input_tokens"]);
    const cacheCreationTokens = numberValue(usage["cache_write_input_tokens"]);
    const consumption = {
      ...(inputTokens === undefined ? {} : { inputTokens }),
      ...(outputTokens === undefined ? {} : { outputTokens }),
      ...(cacheReadTokens === undefined ? {} : { cacheReadTokens }),
      ...(cacheCreationTokens === undefined ? {} : { cacheCreationTokens }),
    };
    return Object.keys(consumption).length > 0 ? [this.#event({ type: "usage", consumption })] : [];
  }

  #raw(data: unknown): NormalizedEvent {
    return this.#event({ type: "raw", data });
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

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0 ? value : undefined;
}
