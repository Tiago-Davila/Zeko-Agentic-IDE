import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { NormalizedEventSchema, type NormalizedEvent } from "@zeko/contracts";
import { ipc } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";
import { outputStore } from "./ring-buffer.js";

const EMPTY_EVENTS: readonly NormalizedEvent[] = Object.freeze([]);

interface OutputPanelProps { runId: string; nodeId: string }

export function OutputPanel({ runId, nodeId }: OutputPanelProps) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | undefined>(undefined);
  const rendered = useRef({ key: "", length: 0, lastFingerprint: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadGeneration, setReloadGeneration] = useState(0);
  const events = useSyncExternalStore(outputStore.subscribe, () => outputStore.getEvents(runId, nodeId), () => EMPTY_EVENTS);

  useEffect(() => {
    if (!host.current) return;
    const instance = new Terminal({
      disableStdin: true,
      cursorBlink: false,
      convertEol: true,
      scrollback: 5_000,
      fontSize: 11,
      fontFamily: '"Cascadia Code", Consolas, monospace',
      theme: { background: "#f8fafa", foreground: "#334e58", cursor: "#087f72", selectionBackground: "#a8d8cf" },
    });
    instance.open(host.current);
    terminal.current = instance;
    return () => { terminal.current = undefined; instance.dispose(); };
  }, []);

  useEffect(() => {
    const refreshOnResume = () => setReloadGeneration((generation) => generation + 1);
    window.addEventListener("focus", refreshOnResume);
    document.addEventListener("visibilitychange", refreshOnResume);
    return () => {
      window.removeEventListener("focus", refreshOnResume);
      document.removeEventListener("visibilitychange", refreshOnResume);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        let cursor = outputStore.getCursor(runId, nodeId);
        while (active) {
          const page = await ipc.request("node.output.page", { runId, nodeId, afterSeq: cursor, limit: 500 });
          outputStore.appendMany(runId, nodeId, page.events);
          if (page.nextSeq === null || page.nextSeq <= cursor || page.events.length === 0) break;
          cursor = page.nextSeq;
          outputStore.setCursor(runId, nodeId, cursor);
          if (page.events.length < 500) break;
        }
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [nodeId, reloadGeneration, runId]);

  useEffect(() => ipc.onEvent((event) => {
    if (event.type !== "node.output" || event.runId !== runId || typeof event.payload !== "object" || event.payload === null) return;
    const payload = event.payload as Record<string, unknown>;
    if (payload["nodeId"] !== nodeId || !Array.isArray(payload["events"])) return;
    const normalizedEvents = [] as NormalizedEvent[];
    for (const item of payload["events"]) {
      const normalized = normalizeLiveEvent(item);
      if (normalized) normalizedEvents.push(normalized);
    }
    outputStore.appendMany(runId, nodeId, normalizedEvents);
  }), [nodeId, runId]);

  useEffect(() => {
    const instance = terminal.current;
    if (!instance) return;
    const currentKey = `${runId}\0${nodeId}`;
    const previous = rendered.current;
    if (previous.key !== currentKey) {
      instance.reset();
      instance.write(events.map(formatEvent).filter(Boolean).join("\r\n"));
      rendered.current = { key: currentKey, length: events.length, lastFingerprint: eventFingerprint(events.at(-1)) };
      return;
    }
    if (events.length > previous.length) {
      instance.write(events.slice(previous.length).map(formatEvent).join("\r\n"));
    } else if (events.length > 0 && eventFingerprint(events.at(-1)) !== previous.lastFingerprint) {
      instance.write(`\r\n${formatEvent(events.at(-1))}`);
    }
    rendered.current = { key: currentKey, length: events.length, lastFingerprint: eventFingerprint(events.at(-1)) };
  }, [events, nodeId, runId]);

  return <section className="output-panel" aria-label={t("output.title")}>
    <header className="output-panel__header"><div><p className="eyebrow">{t("output.eyebrow")}</p><h2>{nodeId}</h2></div>
      <span>{loading ? t("output.loading") : t("output.eventCount", { count: events.length })}</span>
    </header>
    <div className="output-terminal" ref={host} aria-label={t("output.terminalAria")} />
    {error && <p className="output-error" role="alert">{t("output.loadFailed")}</p>}
    {!loading && !error && events.length === 0 && <p className="output-empty">{t("output.empty")}</p>}
  </section>;
}

function normalizeLiveEvent(value: unknown): NormalizedEvent | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  const type = raw["type"];
  const mapped: Record<string, string> = {
    "agent.session_started": "session_started", "agent.text": "assistant_text", "agent.tool_call": "tool_call",
    "agent.tool_result": "tool_result", "agent.permission_denied": "permission_denied", "agent.inferred_denial": "inferred_denial",
    "agent.usage": "usage", "agent.stderr": "stderr",
  };
  if (typeof type !== "string" || !mapped[type]) return undefined;
  const parsed = NormalizedEventSchema.safeParse({ ...raw, type: mapped[type] });
  return parsed.success ? parsed.data : undefined;
}

function formatEvent(event: NormalizedEvent | undefined): string {
  if (!event) return "";
  switch (event.type) {
    case "assistant_text": return sanitize(event.text);
    case "session_started": return sanitize(`[session ${event.model ?? event.sessionId}]`);
    case "tool_call": return sanitize(`› ${event.name} ${safeJson(event.input)}`);
    case "tool_result": return sanitize(`${event.ok ? "✓" : "!"} ${event.content}`);
    case "permission_denied": return sanitize(`Permission denied: ${event.tool} — ${event.reason}`);
    case "inferred_denial": return sanitize(`Inferred denial (${event.source}): ${event.message}`);
    case "stderr": return sanitize(event.line);
    case "usage": return sanitize(`Usage: ${safeJson(event.consumption ?? event.cost ?? {})}`);
    case "subscription_usage": return sanitize(`Subscription usage read at ${event.readAt}`);
    case "model_mismatch": return sanitize(`Model mismatch: ${event.requested} → ${event.effective}`);
    case "raw": return "";
  }
}

function safeJson(value: unknown): string { try { return JSON.stringify(value); } catch { return "[unavailable]"; } }
function sanitize(text: string): string {
  let result = "";
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 27) {
      const next = text[index + 1];
      if (next === "[") {
        index += 2;
        while (index < text.length && !/[A-Za-z]/.test(text[index] ?? "")) index += 1;
      } else if (next === "]") {
        index += 2;
        while (index < text.length && text.charCodeAt(index) !== 7 && !(text.charCodeAt(index) === 27 && text[index + 1] === "\\")) index += 1;
        if (text.charCodeAt(index) === 27) index += 1;
      } else index += 1;
      continue;
    }
    if (code !== 7) result += text[index];
  }
  return result;
}
function eventFingerprint(event: NormalizedEvent | undefined): string { return event ? `${event.attemptId}\0${event.type}\0${event.ts}` : ""; }
