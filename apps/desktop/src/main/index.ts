import { app, BrowserWindow, dialog, ipcMain, MessageChannelMain, utilityProcess } from "electron";
import { join } from "node:path";
import { EngineHostLifecycle } from "./engine-host-lifecycle.js";

const lifecycle = new EngineHostLifecycle({
  createWindow: () => {
    const window = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 900,
      minHeight: 600,
      webPreferences: {
        preload: join(import.meta.dirname, "../preload/index.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    if (process.env["ELECTRON_RENDERER_URL"]) void window.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    else void window.loadFile(join(import.meta.dirname, "../renderer/index.html"));
    return window;
  },
  forkEngine: (entry) => utilityProcess.fork(entry, [], { serviceName: "Zeko engine host" }),
  createChannel: () => new MessageChannelMain(),
  engineEntry: join(app.getAppPath(), "out/main/engine-host.js"),
  onQuit: () => app.quit(),
});

ipcMain.handle("dialog.openFolder", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return result.canceled ? undefined : result.filePaths[0];
});
ipcMain.handle("app.quit", () => app.quit());
ipcMain.handle("engine.restart", () => lifecycle.restart());

void app.whenReady().then(async () => {
  await lifecycle.start();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) void lifecycle.start(); });
  app.on("before-quit", (event) => lifecycle.beforeQuit(event));
}).catch(() => app.quit());

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
