import { createZekoRuntime } from "@zeko/runtime";
import type { MessagePortMain } from "electron";
import { dispatchRequest, postValidated } from "./dispatch.js";
import { OutputBatcher, type EngineEvent } from "./output-batcher.js";

let stopped = false;
let messagePort: MessagePortMain | undefined;
let outputBatcher: OutputBatcher | undefined;
const runtimePromise = createZekoRuntime();

process.parentPort.on("message", (event) => {
  const data = event.data as { type?: unknown } | undefined;
  if (data?.type === "connect") {
    const candidate = event.ports[0];
    if (candidate && !messagePort) void attach(candidate);
  } else if (data?.type === "shutdown") {
    void shutdown();
  }
});

async function attach(port: MessagePortMain): Promise<void> {
  try {
    const runtime = await runtimePromise;
    if (stopped) { port.close(); return; }
    messagePort = port;
    outputBatcher = new OutputBatcher((event) => {
      if (!postValidated(port, event)) postValidated(port, { kind: "event", type: "engine.error", payload: { code: "INVALID_ENGINE_EVENT" } });
    });
    runtime.subscribe((event) => {
      const parsed = event as EngineEvent;
      if (parsed.type === "node.output") outputBatcher?.push(parsed);
      else if (!postValidated(port, parsed)) postValidated(port, { kind: "event", type: "engine.error", payload: { code: "INVALID_ENGINE_EVENT" } });
    });
    port.on("message", ({ data }) => { void dispatchRequest(runtime, port, data); });
    port.on("close", () => { if (messagePort === port) messagePort = undefined; });
    port.start();
  } catch (error) {
    const portMessage = error instanceof Error ? error.message : "Runtime initialization failed";
    postValidated(port, { kind: "event", type: "engine.error", payload: { code: "ENGINE_START_FAILED", params: { message: portMessage } } });
    port.close();
  }
}

async function shutdown(): Promise<void> {
  if (stopped) return;
  stopped = true;
  outputBatcher?.close();
  messagePort?.close();
  const runtime = await runtimePromise;
  runtime.close();
  process.parentPort.postMessage({ type: "shutdown-complete" });
  process.exit(0);
}
