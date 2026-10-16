import { existsSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import * as pty from "node-pty";

export type TerminalKind = "claude-code" | "codex" | "shell";

export interface OpenTerminalRequest {
  readonly sessionKey: string;
  readonly cwd: string;
  readonly kind: TerminalKind;
  readonly model?: string | undefined;
  readonly reasoningEffort?: string | undefined;
  readonly cols: number;
  readonly rows: number;
}

export interface OpenTerminalResult {
  readonly id: string;
  /** Output already produced by the session, replayed when a panel re-attaches. */
  readonly buffer: string;
  readonly exitCode?: number | undefined;
}

interface Session {
  readonly id: string;
  readonly process: pty.IPty;
  buffer: string;
  pending: string;
  flushTimer: NodeJS.Timeout | undefined;
  exitCode: number | undefined;
}

interface PtyManagerSink {
  data(id: string, data: string): void;
  exit(id: string, exitCode: number): void;
}

const MAX_REPLAY_CHARS = 512 * 1024;
const FLUSH_MS = 8;
// Set when Zeko itself was started from a Claude Code session; a node terminal is a fresh top-level session.
const INHERITED_AGENT_MARKERS = new Set(["CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_CHILD_SESSION"]);
const MODEL_PATTERN =/^[\w.:[\]/-]{1,80}$/;

/**
 * One interactive PTY per (project, node, terminal kind), modelled on Orca's local PTY provider:
 * the agent runs inside the user's shell so its TUI renders exactly as in a real terminal, and the
 * user is left at a prompt when the agent exits. Sessions outlive the panel so reopening a node re-attaches.
 */
export class PtyManager {
  readonly #byKey = new Map<string, Session>();
  readonly #byId = new Map<string, Session>();
  #nextId = 1;

  constructor(private readonly sink: PtyManagerSink) {}

  open(request: OpenTerminalRequest): OpenTerminalResult {
    const existing = this.#byKey.get(request.sessionKey);
    if (existing) {
      if (existing.exitCode === undefined) existing.process.resize(request.cols, request.rows);
      return { id: existing.id, buffer: existing.buffer + existing.pending, exitCode: existing.exitCode };
    }
    return this.#spawn(request);
  }

  restart(request: OpenTerminalRequest): OpenTerminalResult {
    const existing = this.#byKey.get(request.sessionKey);
    if (existing) this.#dispose(request.sessionKey, existing);
    return this.#spawn(request);
  }

  write(id: string, data: string): void {
    const session = this.#byId.get(id);
    if (session && session.exitCode === undefined) session.process.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.#byId.get(id);
    if (!session || session.exitCode !== undefined) return;
    try { session.process.resize(cols, rows); } catch { /* the process may exit between the check and the resize */ }
  }

  closeAll(): void {
    for (const [key, session] of this.#byKey) this.#dispose(key, session);
  }

  #spawn(request: OpenTerminalRequest): OpenTerminalResult {
    if (!existsSync(request.cwd) || !statSync(request.cwd).isDirectory()) throw new Error("Terminal working directory does not exist");
    const launch = buildLaunch(request);
    const id = String(this.#nextId++);
    const process_ = pty.spawn(launch.file, launch.args, {
      name: "xterm-256color",
      cols: request.cols,
      rows: request.rows,
      cwd: request.cwd,
      env: terminalEnv(),
      // Why (from Orca): the bundled ConPTY has the wrap-marker behaviour xterm.js expects.
      ...(process.platform === "win32" ? { useConptyDll: true } : {}),
    });
    const session: Session = { id, process: process_, buffer: "", pending: "", flushTimer: undefined, exitCode: undefined };
    this.#byKey.set(request.sessionKey, session);
    this.#byId.set(id, session);
    process_.onData((data) => {
      session.pending += data;
      session.flushTimer ??= setTimeout(() => this.#flush(session), FLUSH_MS);
    });
    process_.onExit(({ exitCode }) => {
      this.#flush(session);
      session.exitCode = exitCode;
      if (this.#byId.get(id) === session) this.sink.exit(id, exitCode);
    });
    return { id, buffer: "" };
  }

  #flush(session: Session): void {
    if (session.flushTimer) clearTimeout(session.flushTimer);
    session.flushTimer = undefined;
    if (!session.pending) return;
    const chunk = session.pending;
    session.pending = "";
    session.buffer = (session.buffer + chunk).slice(-MAX_REPLAY_CHARS);
    if (this.#byId.get(session.id) === session) this.sink.data(session.id, chunk);
  }

  #dispose(key: string, session: Session): void {
    if (session.flushTimer) clearTimeout(session.flushTimer);
    this.#byKey.delete(key);
    this.#byId.delete(session.id);
    if (session.exitCode === undefined) {
      try { session.process.kill(); } catch { /* already gone */ }
    }
  }
}

export function parseOpenRequest(value: unknown): OpenTerminalRequest {
  if (typeof value !== "object" || value === null) throw new TypeError("Invalid terminal request");
  const raw = value as Record<string, unknown>;
  const { sessionKey, cwd, kind, model, reasoningEffort, cols, rows } = raw;
  if (typeof sessionKey !== "string" || sessionKey.length === 0 || sessionKey.length > 1024) throw new TypeError("Invalid terminal session");
  if (typeof cwd !== "string" || cwd.length === 0) throw new TypeError("Invalid terminal directory");
  if (kind !== "claude-code" && kind !== "codex" && kind !== "shell") throw new TypeError("Invalid terminal kind");
  if (model !== undefined && (typeof model !== "string" || !MODEL_PATTERN.test(model))) throw new TypeError("Invalid model");
  if (reasoningEffort !== undefined && (typeof reasoningEffort !== "string" || !/^[a-z]{1,20}$/.test(reasoningEffort))) throw new TypeError("Invalid reasoning effort");
  return { sessionKey, cwd, kind, model, reasoningEffort, cols: dimension(cols, 80), rows: dimension(rows, 24) };
}

export function dimension(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 2 && value <= 1000 ? value : fallback;
}

/** Agent command line; arguments are pre-validated so they never need shell quoting beyond plain words. */
export function agentCommand(request: Pick<OpenTerminalRequest, "kind" | "model" | "reasoningEffort">): string[] | undefined {
  if (request.kind === "claude-code") return ["claude", ...(request.model ? ["--model", request.model] : [])];
  if (request.kind === "codex") {
    return ["codex", ...(request.model ? ["-m", request.model] : []),
      ...(request.reasoningEffort ? ["-c", `model_reasoning_effort=${request.reasoningEffort}`] : [])];
  }
  return undefined;
}

function buildLaunch(request: OpenTerminalRequest): { file: string; args: string[] } {
  const command = agentCommand(request);
  if (process.platform === "win32") {
    const shell = findOnPath("pwsh.exe") ?? "powershell.exe";
    // Why (from Orca): Windows startup commands go in argv; typing them into a shell that is still booting drops keys.
    return command ? { file: shell, args: ["-NoLogo", "-NoExit", "-Command", `& ${command.map(powershellQuote).join(" ")}`] }
      : { file: shell, args: ["-NoLogo"] };
  }
  const shell = process.env["SHELL"] || "/bin/bash";
  return command ? { file: shell, args: ["-l", "-i", "-c", `${command.map(posixQuote).join(" ")}; exec "${shell}" -l -i`] }
    : { file: shell, args: ["-l", "-i"] };
}

function terminalEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined || key.startsWith("ELECTRON_") || key.startsWith("ZEKO_") || INHERITED_AGENT_MARKERS.has(key)) continue;
    env[key] = value;
  }
  env["TERM"] = "xterm-256color";
  env["COLORTERM"] = "truecolor";
  env["TERM_PROGRAM"] = "Zeko";
  return env;
}

function findOnPath(executable: string): string | undefined {
  for (const directory of (process.env["PATH"] ?? "").split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, executable);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function powershellQuote(word: string): string { return /^[\w.:=/-]+$/.test(word) ? word : `'${word.replaceAll("'", "''")}'`; }
function posixQuote(word: string): string { return /^[\w.:=/-]+$/.test(word) ? word : `'${word.replaceAll("'", "'\\''")}'`; }
