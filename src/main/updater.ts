/**
 * Автооновлення з GitHub Releases (electron-updater). Працює лише в встановленій (NSIS) збірці:
 * у portable-версії та в режимі розробки його нема. Завантажується лише різниця між версіями
 * (blockmap), оновлення ставиться при виході або за кнопкою «Перезапустити й оновити».
 */
import { app, BrowserWindow, ipcMain } from "electron";
import electronUpdater from "electron-updater";

// electron-updater — CommonJS: з ESM-збірки main іменований імпорт недоступний, беремо через default.
const { autoUpdater } = electronUpdater;

export type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "none"
  | "error"
  | "unsupported";

export interface UpdateStatus {
  state: UpdateState;
  version?: string;
  percent?: number;
  message?: string;
}

let status: UpdateStatus = { state: "idle" };
let getWindow: () => BrowserWindow | null = () => null;

function set(next: UpdateStatus): void {
  status = next;
  getWindow()?.webContents.send("updater:status", status);
}

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

export function supported(): boolean {
  return app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR;
}

export function registerUpdater(win: () => BrowserWindow | null): void {
  getWindow = win;
  ipcMain.handle("updater:status", () => status);
  ipcMain.handle("updater:check", () => check());
  ipcMain.handle("updater:install", () => {
    if (status.state === "ready") autoUpdater.quitAndInstall(false, true);
  });

  if (!supported()) {
    status = { state: "unsupported" };
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => set({ state: "checking" }));
  autoUpdater.on("update-available", (info) => set({ state: "available", version: info.version }));
  autoUpdater.on("update-not-available", () => set({ state: "none" }));
  autoUpdater.on("download-progress", (p) =>
    set({ state: "downloading", version: status.version, percent: Math.round(p.percent) })
  );
  autoUpdater.on("update-downloaded", (info) => set({ state: "ready", version: info.version }));
  autoUpdater.on("error", (err) => set({ state: "error", message: String(err?.message ?? err).slice(0, 200) }));

  // перша перевірка через кілька секунд після старту, далі раз на кілька годин
  setTimeout(() => void check(), 8000);
  setInterval(() => void check(), CHECK_EVERY_MS);
}

async function check(): Promise<UpdateStatus> {
  if (!supported()) return status;
  if (status.state === "checking" || status.state === "downloading" || status.state === "ready") return status;
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    set({ state: "error", message: String((err as Error)?.message ?? err).slice(0, 200) });
  }
  return status;
}
