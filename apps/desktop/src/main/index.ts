import { app, BrowserWindow, dialog, ipcMain, MessageChannelMain, utilityProcess } from "electron";
import { join } from "node:path";
import { EngineHostLifecycle } from "./engine-host-lifecycle.js";
import { dimension, parseOpenRequest, PtyManager } from "./pty-manager.js";

const lifecycle = new EngineHostLifecycle({
  createWindow: () => {
    const window = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 900,
      minHeight: 600,
      webPreferences: {
        preload: join(import.meta.dirname, "../preload/index.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    if (process.env["ELECTRON_RENDERER_URL"]) void window.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    else void window.loadFile(join(import.meta.dirname, "../renderer/index.html"));
    return window;
  },
  forkEngine: (entry) => utilityProcess.fork(entry, [], {
    serviceName: "Zeko engine host",
    env: { ...process.env, ZEKO_DEVELOPMENT: app.isPackaged ? "0" : "1" },
  }),
  createChannel: () => new MessageChannelMain(),
  engineEntry: join(app.getAppPath(), "out/main/engine-host.js"),
  onQuit: () => app.quit(),
});

const terminals = new PtyManager({
  data: (id, data) => sendToWindows("terminal.data", { id, data }),
  exit: (id, exitCode) => sendToWindows("terminal.exit", { id, exitCode }),
});

function sendToWindows(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send(channel, payload);
}

ipcMain.handle("terminal.open", (_event, request: unknown) => terminals.open(parseOpenRequest(request)));
ipcMain.handle("terminal.restart", (_event, request: unknown) => terminals.restart(parseOpenRequest(request)));
ipcMain.on("terminal.write", (_event, id: unknown, data: unknown) => {
  if (typeof id === "string" && typeof data === "string") terminals.write(id, data);
});
ipcMain.on("terminal.resize", (_event, id: unknown, cols: unknown, rows: unknown) => {
  if (typeof id === "string") terminals.resize(id, dimension(cols, 80), dimension(rows, 24));
});
app.on("will-quit", () => terminals.killAll());

ipcMain.handle("dialog.openFolder", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return result.canceled ? undefined : result.filePaths[0];
});
ipcMain.handle("app.quit", () => app.quit());
ipcMain.handle("engine.restart", () => lifecycle.restart());

void app.whenReady().then(async () => {
  if (process.argv.includes("--zeko-sqlite-smoke")) {
    const databasePath = process.env["ZEKO_DATABASE_PATH"];
    if (!databasePath) { app.exit(2); return; }
    const engine = utilityProcess.fork(join(app.getAppPath(), "out/main/engine-host.js"), ["--zeko-sqlite-smoke"], { serviceName: "Zeko packaged SQLite smoke" });
    engine.once("message", (message) => {
      if (typeof message !== "object" || message === null) return;
      const type = (message as { type?: unknown }).type;
      if (type === "engine-ready") engine.postMessage({ type: "shutdown" });
      else if (type === "engine-error") app.exit(1);
    });
    engine.once("exit", (code) => app.exit(code));
    const channel = new MessageChannelMain();
    channel.port2.close();
    engine.postMessage({ type: "connect" }, [channel.port1]);
    return;
  }
  await lifecycle.start();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) void lifecycle.start(); });
  app.on("before-quit", (event) => lifecycle.beforeQuit(event));
}).catch(() => app.quit());

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
