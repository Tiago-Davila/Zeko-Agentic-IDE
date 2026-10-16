import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { terminalBridge, type OpenTerminalRequest } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";

interface NodeTerminalProps {
  request: Omit<OpenTerminalRequest, "cols" | "rows">;
  /** Bumping this kills the current process and launches a fresh one. */
  restartToken: number;
  ariaLabel: string;
  onSession: (sessionId: string | undefined) => void;
}

const THEME = {
  background: "#101a1f", foreground: "#d7e3e2", cursor: "#91d2c6", cursorAccent: "#101a1f", selectionBackground: "#2f5b58",
  black: "#1b2a30", red: "#e0786b", green: "#8cc9a0", yellow: "#e2c07e", blue: "#7fb2d8", magenta: "#c49bd6", cyan: "#7fcfc4", white: "#d7e3e2",
  brightBlack: "#5d7178", brightRed: "#f0968a", brightGreen: "#a6dcb6", brightYellow: "#f0d49a", brightBlue: "#9dc6e6", brightMagenta: "#d6b4e4", brightCyan: "#a0e0d6", brightWhite: "#f4fbf8",
};

/** A real interactive terminal attached to a main-process PTY: the agent's own TUI renders here unmodified. */
export function NodeTerminal({ request, restartToken, ariaLabel, onSession }: NodeTerminalProps) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const handled = useRef(restartToken);
  const onSessionRef = useRef(onSession);
  onSessionRef.current = onSession;
  // Model edits apply on the next launch; they must not tear down a live session.
  const launchOptions = useRef(request);
  launchOptions.current = request;
  const [failure, setFailure] = useState<string>();
  const { sessionKey, cwd, kind } = request;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const bridge = terminalBridge();
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      lineHeight: 1.15,
      fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, "Courier New", monospace',
      scrollback: 10_000,
      allowProposedApi: true,
      theme: THEME,
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(element);
    safeFit(fit);

    let sessionId: string | undefined;
    let disposed = false;
    setFailure(undefined);

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown" || !event.ctrlKey || event.altKey) return true;
      const key = event.key.toLowerCase();
      // Windows-terminal convention: Ctrl+C copies when there is a selection, otherwise it is SIGINT.
      if (key === "c" && (event.shiftKey || terminal.hasSelection())) {
        void navigator.clipboard.writeText(terminal.getSelection()).catch(() => undefined);
        terminal.clearSelection();
        return false;
      }
      // Let the browser deliver a paste event, which xterm turns into (bracketed) input.
      if (key === "v") return false;
      return true;
    });

    const input = terminal.onData((data) => { if (sessionId) bridge.write(sessionId, data); });
    const resize = terminal.onResize(({ cols, rows }) => { if (sessionId) bridge.resize(sessionId, cols, rows); });
    const offData = bridge.onData((payload) => { if (payload.id === sessionId) terminal.write(payload.data); });
    const offExit = bridge.onExit((payload) => {
      if (payload.id === sessionId) terminal.write(`\r\n\x1b[2m${t("terminal.exited", { code: payload.exitCode })}\x1b[0m\r\n`);
    });

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { if (!disposed) safeFit(fit); });
    });
    observer.observe(element);

    const restart = handled.current !== restartToken;
    handled.current = restartToken;
    const { model, reasoningEffort } = launchOptions.current;
    const params: OpenTerminalRequest = {
      sessionKey, cwd, kind, cols: terminal.cols, rows: terminal.rows,
      ...(model ? { model } : {}), ...(reasoningEffort ? { reasoningEffort } : {}),
    };
    void (restart ? bridge.restart(params) : bridge.open(params)).then((result) => {
      if (disposed) return;
      sessionId = result.id;
      if (result.buffer) terminal.write(result.buffer);
      if (result.exitCode !== undefined) terminal.write(`\r\n\x1b[2m${t("terminal.exited", { code: result.exitCode })}\x1b[0m\r\n`);
      else bridge.resize(result.id, terminal.cols, terminal.rows);
      onSessionRef.current(result.id);
      terminal.focus();
    }).catch((cause: unknown) => {
      if (!disposed) setFailure(cause instanceof Error ? cause.message : String(cause));
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      input.dispose(); resize.dispose(); offData(); offExit();
      onSessionRef.current(undefined);
      // The PTY keeps running in the main process; reopening the node re-attaches and replays its output.
      terminal.dispose();
    };
  }, [cwd, kind, restartToken, sessionKey, t]);

  return <div className="node-terminal">
    <div className="node-terminal__host" ref={host} aria-label={ariaLabel} />
    {failure && <p className="node-terminal__error" role="alert">{t("terminal.openFailed", { message: failure })}</p>}
  </div>;
}

function safeFit(fit: FitAddon): void {
  try { fit.fit(); } catch { /* host not laid out yet */ }
}
