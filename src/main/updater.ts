/**
 * Автооновлення з GitHub Releases (electron-updater). Працює у встановленій (NSIS) збірці Windows і в AppImage на Linux:
 * у portable-версії та в режимі розробки його нема. macOS не дозволяє самооновлення непідписаних застосунків, а .deb
 * потребує прав адміністратора, тож там лише перевіряємо останній реліз і пропонуємо відкрити сторінку завантаження
 * (стан «manual»). Завантажується лише різниця між версіями
 * (blockmap), оновлення ставиться при виході або за кнопкою «Перезапустити й оновити».
 */
import { app, BrowserWindow, ipcMain } from "electron";
import electronUpdater from "electron-updater";
import { RELEASE_REPO, isNewerVersion, isTrustedReleaseUrl } from "../core/appVersion";

// electron-updater — CommonJS: з ESM-збірки main іменований імпорт недоступний, беремо через default.
const { autoUpdater } = electronUpdater;

export type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "none"
  | "manual"
  | "error"
  | "unsupported";

export interface UpdateStatus {
  state: UpdateState;
  version?: string;
  percent?: number;
  message?: string;
  /** «manual»: сторінка релізу, з якої завантажити нову версію */
  url?: string;
}

let status: UpdateStatus = { state: "idle" };
let getWindow: () => BrowserWindow | null = () => null;

function set(next: UpdateStatus): void {
  status = next;
  getWindow()?.webContents.send("updater:status", status);
}

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/** Автоматичне завантаження й встановлення: Windows (NSIS) і Linux AppImage (змінна APPIMAGE виставляється його запускачем). */
const AUTO_INSTALL = process.platform === "win32" || (process.platform === "linux" && Boolean(process.env.APPIMAGE));

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
  if (!AUTO_INSTALL) {
    setTimeout(() => void check(), 8000);
    setInterval(() => void check(), CHECK_EVERY_MS);
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

/** macOS і Linux: дивимось останній стабільний реліз; встановлює користувач сам зі сторінки релізу. */
async function checkManual(): Promise<UpdateStatus> {
  if (status.state === "checking") return status;
  set({ state: "checking" });
  try {
    const res = await fetch(`https://api.github.com/repos/${RELEASE_REPO}/releases/latest`, { headers: { accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(String(res.status));
    const rel = (await res.json()) as { tag_name?: string; html_url?: string; draft?: boolean; prerelease?: boolean };
    const url = rel.html_url ?? "";
    if (!rel.draft && !rel.prerelease && rel.tag_name && isNewerVersion(rel.tag_name, app.getVersion()) && isTrustedReleaseUrl(url)) {
      set({ state: "manual", version: rel.tag_name.replace(/^v/, ""), url });
    } else {
      set({ state: "none" });
    }
  } catch (err) {
    set({ state: "error", message: String((err as Error)?.message ?? err).slice(0, 200) });
  }
  return status;
}

async function check(): Promise<UpdateStatus> {
  if (!supported()) return status;
  if (!AUTO_INSTALL) return checkManual();
  if (status.state === "checking" || status.state === "downloading" || status.state === "ready") return status;
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    set({ state: "error", message: String((err as Error)?.message ?? err).slice(0, 200) });
  }
  return status;
}
