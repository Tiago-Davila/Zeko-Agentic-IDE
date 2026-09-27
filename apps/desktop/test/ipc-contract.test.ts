import { beforeEach, describe, expect, it, vi } from "vitest";
import { IpcEventSchema, IpcRequestSchema, IpcResponseSchema } from "@zeko/contracts";
import { IPC_METHODS } from "@zeko/runtime";
import { dispatchRequest } from "../src/engine-host/dispatch.js";

const electronHarness = vi.hoisted(() => ({
  bridge: undefined as unknown,
  connect: undefined as ((event: { ports: unknown[] }) => void) | undefined,
}));

vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: (_key: string, api: unknown) => { electronHarness.bridge = api; } },
  ipcRenderer: { on: (_channel: string, listener: (event: { ports: unknown[] }) => void) => { electronHarness.connect = listener; } },
}));

const request = (method: (typeof IPC_METHODS)[number], params: Record<string, unknown> = {}) => ({
  kind: "request" as const, id: "018f0000-0000-7000-8000-000000000001", method, params,
});

describe("desktop IPC contract boundaries", () => {
  beforeEach(() => {
    electronHarness.bridge = undefined;
    electronHarness.connect = undefined;
    vi.resetModules();
  });

  it("engine host validates every request and responds for every contract method", async () => {
    const messages: unknown[] = [];
    const handlers = Object.fromEntries(IPC_METHODS.map((method) => [method, async (...args: never[]) => ({ method, args })]));
    const runtime = { ipcHandlers: handlers };
    for (const method of IPC_METHODS) {
      await dispatchRequest(runtime, { postMessage: (message) => messages.push(message) }, request(method, { projectId: "/repo", runId: "run" }));
      const response = messages.at(-1);
      expect(IpcResponseSchema.safeParse(response).success, method).toBe(true);
      expect(response).toMatchObject({ kind: "response", ok: true, result: { method } });
    }
    expect(messages).toHaveLength(IPC_METHODS.length);
  });

  it("drops invalid host requests and emits a valid engine.error", async () => {
    const messages: unknown[] = [];
    let called = false;
    await dispatchRequest({ ipcHandlers: { "project.open": async () => { called = true; } } }, { postMessage: (message) => messages.push(message) }, { kind: "request", id: "bad", method: "project.open", params: {} });
    expect(called).toBe(false);
    expect(IpcEventSchema.parse(messages[0])).toMatchObject({ type: "engine.error", payload: { code: "INVALID_IPC_REQUEST" } });
  });

  it("preload validates requests and responses, and surfaces invalid host messages as engine.error", async () => {
    await import("../src/preload/index.js");
    const bridge = electronHarness.bridge as {
      request(message: unknown): Promise<{ kind: string; id: string; ok: boolean; result?: unknown }>;
      onEvent(listener: (event: unknown) => void): () => void;
    };
    const sent: unknown[] = [];
    const port = {
      postMessage: (message: unknown) => sent.push(message), start: vi.fn(), close: vi.fn(),
      onmessage: null as ((event: MessageEvent) => void) | null,
      onmessageerror: null as (() => void) | null,
    };
    electronHarness.connect?.({ ports: [port] });
    expect(port.start).toHaveBeenCalledOnce();
    await expect(bridge.request({ kind: "request", id: "invalid", method: "project.open", params: {} })).rejects.toThrow("Invalid IPC request");
    expect(sent).toHaveLength(0);

    const validRequest = request("project.open", { path: "C:/repo" });
    const responsePromise = bridge.request(validRequest);
    expect(IpcRequestSchema.parse(sent[0])).toEqual(validRequest);
    port.onmessage?.({ data: { kind: "response", id: validRequest.id, ok: true, result: { projectId: "repo" } } } as MessageEvent);
    expect(await responsePromise).toMatchObject({ kind: "response", id: validRequest.id, ok: true });

    const received: unknown[] = [];
    const unsubscribe = bridge.onEvent((event) => received.push(event));
    port.onmessage?.({ data: { broken: true } } as MessageEvent);
    expect(IpcEventSchema.parse(received[0])).toMatchObject({ type: "engine.error", payload: { code: "INVALID_ENGINE_MESSAGE" } });
    unsubscribe();
  });
});
