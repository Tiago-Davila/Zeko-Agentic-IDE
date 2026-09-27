import type { BrowserWindow, MessageChannelMain, UtilityProcess } from "electron";

interface LifecycleOptions {
  readonly createWindow: () => BrowserWindow;
  readonly forkEngine: (entry: string) => UtilityProcess;
  readonly createChannel: () => MessageChannelMain;
  readonly engineEntry: string;
  readonly onQuit: () => void;
}

/** Owns the utility process and the two data ports; the main process never proxies app messages. */
export class EngineHostLifecycle {
  #window: BrowserWindow | undefined;
  #engine: UtilityProcess | undefined;
  #quitting = false;
  #quitApproved = false;

  constructor(private readonly options: LifecycleOptions) {}

  async start(): Promise<void> {
    if (this.#window && !this.#window.isDestroyed()) return;
    this.#window = this.options.createWindow();
    this.#startEngine();
  }

  async restart(): Promise<void> {
    await this.#stopEngine();
    this.#startEngine();
  }

  beforeQuit(event: { preventDefault(): void }): void {
    if (this.#quitApproved) return;
    event.preventDefault();
    if (this.#quitting) return;
    this.#quitting = true;
    const engine = this.#engine;
    if (!engine) {
      this.#quitApproved = true;
      this.options.onQuit();
      return;
    }
    engine.once("exit", () => {
      this.#engine = undefined;
      this.#quitApproved = true;
      this.options.onQuit();
    });
    engine.postMessage({ type: "shutdown" });
  }

  #startEngine(): void {
    const window = this.#window;
    if (!window || window.isDestroyed()) return;
    const engine = this.options.forkEngine(this.options.engineEntry);
    this.#engine = engine;
    const { port1, port2 } = this.options.createChannel();
    engine.postMessage({ type: "connect" }, [port1]);
    window.webContents.postMessage("zeko:connect", undefined, [port2]);
    engine.on("exit", () => { if (this.#engine === engine) this.#engine = undefined; });
  }

  async #stopEngine(): Promise<void> {
    const engine = this.#engine;
    if (!engine) return;
    const exited = new Promise<void>((resolve) => engine.once("exit", () => resolve()));
    engine.postMessage({ type: "shutdown" });
    await exited;
    if (this.#engine === engine) this.#engine = undefined;
  }
}
