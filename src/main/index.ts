import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { registerPrivilegedSchemes, registerProtocolHandlers } from "./protocols";
import { registerIpcHandlers } from "./ipc";
import { initLan, shutdownLan } from "./lan";

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

if (isDev) app.commandLine.appendSwitch("remote-debugging-port", "9222");

registerPrivilegedSchemes();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(app.getAppPath(), "out/preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  if (isDev) {
    mainWindow.webContents.on("console-message", (_e, _level, message, line, sourceId) => {
      console.log(`[renderer] ${message} (${sourceId}:${line})`);
    });
  }

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(app.getAppPath(), "out/renderer/index.html"));
  }
}

void app.whenReady().then(() => {
  registerProtocolHandlers();
  registerIpcHandlers(() => mainWindow);
  void initLan();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  void shutdownLan();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
