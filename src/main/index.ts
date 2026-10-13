import { app, BrowserWindow, session, shell } from "electron";
import { isAllowedExternalUrl } from "./security";
import { join } from "node:path";
import { registerPrivilegedSchemes, registerProtocolHandlers } from "./protocols";
import { registerIpcHandlers } from "./ipc";
import { initLan, shutdownLan } from "./lan";
import { registerUpdater } from "./updater";

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
      preload: join(app.getAppPath(), "out/preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // Пісочниця рендерера: preload збирається як CommonJS і користується лише contextBridge/ipcRenderer.
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
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

  // Нові вікна не відкриваємо; у браузер системи йдуть лише http(s)-посилання.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isAllowedExternalUrl(details.url)) void shell.openExternal(details.url);
    return { action: "deny" };
  });
  // Жодних переходів поза застосунком: сторінка планшета не повинна вести кудись інде.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const here = mainWindow?.webContents.getURL() ?? "";
    if (url !== here && !url.startsWith("file://") && !url.startsWith(process.env.ELECTRON_RENDERER_URL ?? "\u0000")) {
      event.preventDefault();
      if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    }
  });
  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(app.getAppPath(), "out/renderer/index.html"));
  }
}

void app.whenReady().then(() => {
  // Дозволи сторінки: лише запис у буфер обміну (кнопки «Копіювати»); камера, геолокація тощо не потрібні.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "clipboard-sanitized-write");
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === "clipboard-sanitized-write");
  registerProtocolHandlers();
  registerIpcHandlers(() => mainWindow);
  registerUpdater(() => mainWindow);
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
