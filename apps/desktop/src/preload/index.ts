import { contextBridge, ipcRenderer } from "electron";
import { IpcEventSchema, IpcRequestSchema, IpcResponseSchema } from "../../../../packages/contracts/src/ipc.js";

type IpcEvent = typeof IpcEventSchema._output;
type IpcResponse = typeof IpcResponseSchema._output;
type EventListener = (event: IpcEvent) => void;
type HostRequest = { kind: "host-request"; channel: "dialog.openFolder" };

const listeners = new Set<EventListener>();
const pending = new Map<string, (response: IpcResponse) => void>();
let port: MessagePort | undefined;

function emit(event: IpcEvent): void {
  for (const listener of listeners) listener(event);
}

function dispatchIncoming(value: unknown): void {
  const event = IpcEventSchema.safeParse(value);
  if (event.success) { emit(event.data); return; }
  const response = IpcResponseSchema.safeParse(value);
  if (response.success) {
    const resolve = pending.get(response.data.id);
    if (resolve) { pending.delete(response.data.id); resolve(response.data); }
    return;
  }
  emit({ kind: "event", type: "engine.error", payload: { code: "INVALID_ENGINE_MESSAGE" } });
}

ipcRenderer.on("zeko:connect", (event) => {
  const transferred = event.ports[0];
  if (!transferred) return;
  port?.close();
  port = transferred;
  port.onmessage = ({ data }: MessageEvent<unknown>) => dispatchIncoming(data);
  port.onmessageerror = () => emit({ kind: "event", type: "engine.error", payload: { code: "IPC_MESSAGE_ERROR" } });
  port.start();
});

function request(message: { kind: "request" } & Record<string, unknown>): Promise<IpcResponse>;
function request(message: HostRequest): Promise<string | undefined>;
function request(message: unknown): Promise<IpcResponse | string | undefined> {
    if (isHostRequest(message)) return ipcRenderer.invoke(message.channel) as Promise<string | undefined>;
    const parsed = IpcRequestSchema.safeParse(message);
    if (!parsed.success) return Promise.reject(new TypeError("Invalid IPC request"));
    if (!port) return Promise.reject(new Error("Engine host is not connected"));
    return new Promise((resolve) => {
      pending.set(parsed.data.id, resolve);
      port?.postMessage(parsed.data);
    });
}

type TerminalDataListener = (payload: { id: string; data: string }) => void;
type TerminalExitListener = (payload: { id: string; exitCode: number }) => void;

/** Interactive PTYs live in the main process (node-pty), not the engine host, so they bypass the engine port. */
const terminal = Object.freeze({
  open: (request: unknown) => ipcRenderer.invoke("terminal.open", request),
  restart: (request: unknown) => ipcRenderer.invoke("terminal.restart", request),
  write: (id: string, data: string) => ipcRenderer.send("terminal.write", id, data),
  resize: (id: string, cols: number, rows: number) => ipcRenderer.send("terminal.resize", id, cols, rows),
  onData(listener: TerminalDataListener): () => void {
    const handler = (_event: unknown, payload: { id: string; data: string }) => listener(payload);
    ipcRenderer.on("terminal.data", handler);
    return () => ipcRenderer.removeListener("terminal.data", handler);
  },
  onExit(listener: TerminalExitListener): () => void {
    const handler = (_event: unknown, payload: { id: string; exitCode: number }) => listener(payload);
    ipcRenderer.on("terminal.exit", handler);
    return () => ipcRenderer.removeListener("terminal.exit", handler);
  },
});

const bridge = Object.freeze({
  request,
  onEvent(listener: EventListener): () => void {
    if (typeof listener !== "function") throw new TypeError("Event listener must be a function");
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  terminal,
});

contextBridge.exposeInMainWorld("zeko", bridge);

function isHostRequest(value: unknown): value is HostRequest {
  if (typeof value !== "object" || value === null) return false;
  const requestValue = value as Record<string, unknown>;
  return requestValue["kind"] === "host-request" && requestValue["channel"] === "dialog.openFolder"
    && Object.keys(requestValue).length === 2;
}
