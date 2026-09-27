import { IpcEventSchema, IpcRequestSchema, IpcResponseSchema } from "@zeko/contracts";
import type { MessagePortMain } from "electron";

export interface IpcRuntime {
  readonly ipcHandlers: Record<string, (...args: never[]) => unknown>;
}

const ARGUMENTS: Record<string, readonly string[]> = {
  "project.open": ["path"], "flow.list": ["projectId"], "flow.load": ["projectId", "flowId"], "flow.create": ["projectId", "name"],
  "flow.save": ["projectId", "flow", "expectedHash"], "flow.delete": ["projectId", "flowId", "confirmed"], "flow.validate": ["projectId", "flow"],
  "flow.validateEdge": ["projectId", "flow", "edge"], "agents.status": ["projectId", "agents"], "run.preflight": ["projectId", "flowId"],
  "run.start": ["projectId", "flowId", "fileHash"], "run.cancel": ["runId"], "node.cancel": ["runId", "nodeId"],
  "approval.decide": ["runId", "nodeId", "decision"], "run.list": ["projectId", "flowId", "limit"], "run.get": ["runId"],
  "node.output.page": ["runId", "nodeId", "afterSeq", "limit"], "node.diff": ["runId", "nodeId", "path", "offset", "limit"],
  "workspaces.delete": ["runId", "confirmed"], "settings.get": ["projectId"], "settings.set": ["projectId", "config"],
  "files.readDir": ["projectId", "path"], "files.list": ["projectId", "query", "limit"], "files.search": ["projectId", "options"],
};

/** Validate both directions of the renderer/engine boundary and dispatch to the shared runtime. */
export async function dispatchRequest(
  runtime: IpcRuntime,
  port: Pick<MessagePortMain, "postMessage">,
  message: unknown,
  onProjectOpened?: (project: { projectId: string; root: string }) => void | Promise<void>,
): Promise<void> {
  const request = IpcRequestSchema.safeParse(message);
  if (!request.success) {
    postValidated(port, { kind: "event", type: "engine.error", payload: { code: "INVALID_IPC_REQUEST" } });
    return;
  }
  try {
    const params = request.data.params;
    const keys = ARGUMENTS[request.data.method] ?? [];
    const args = keys.map((key) => params[key]);
    const handler = runtime.ipcHandlers[request.data.method];
    if (!handler) throw new Error(`No handler registered for ${request.data.method}`);
    const result = await handler(...args as never[]);
    if (request.data.method === "project.open" && typeof result === "object" && result !== null) {
      const project = result as { projectId?: unknown; root?: unknown };
      if (typeof project.projectId === "string" && typeof project.root === "string") await onProjectOpened?.({ projectId: project.projectId, root: project.root });
    }
    postValidated(port, { kind: "response", id: request.data.id, ok: true, result });
  } catch (error) {
    const value = error as { code?: unknown; params?: unknown; currentHash?: unknown; message?: unknown };
    const code = typeof value.code === "string" ? value.code : "INTERNAL_ERROR";
    const params = code === "FILE_CHANGED_ON_DISK" && typeof value.currentHash === "string"
      ? { currentHash: value.currentHash }
      : typeof value.params === "object" && value.params !== null && !Array.isArray(value.params)
        ? value.params as Record<string, unknown>
        : { message: typeof value.message === "string" ? value.message : "Request failed" };
    postValidated(port, { kind: "response", id: request.data.id, ok: false, error: { code, params } });
  }
}

export function postValidated(port: Pick<MessagePortMain, "postMessage">, message: unknown): boolean {
  const parsed = (message as { kind?: unknown }).kind === "event" ? IpcEventSchema.safeParse(message) : IpcResponseSchema.safeParse(message);
  if (!parsed.success) return false;
  port.postMessage(parsed.data);
  return true;
}
