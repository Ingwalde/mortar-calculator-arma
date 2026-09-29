import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { loadStore, saveStore } from "./store";
import { buildTilePyramid, ImportCancelledError, type ImportProgress } from "./tiles/import";
import { downloadFile } from "./tiles/download";
import { convertHeightData, heightsPath, readHeights } from "./tiles/heights";
import { pyramidDir } from "./protocols";

/** Лише один імпорт карти одночасно — так само, як в UI прототипу (один прогрес-бар). */
let currentImport: AbortController | null = null;

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle("store:load", () => loadStore());
  ipcMain.handle("store:save", (_e, data: unknown) => saveStore(data));

  ipcMain.handle("dialog:pickImageFile", async () => {
    const win = getWindow();
    const res = await dialog.showOpenDialog(win ?? undefined!, {
      title: "Виберіть зображення карти",
      properties: ["openFile"],
      filters: [{ name: "Зображення", extensions: ["png", "jpg", "jpeg", "webp"] }]
    });
    if (res.canceled || !res.filePaths[0]) return null;
    return res.filePaths[0];
  });

  ipcMain.handle(
    "mapImport:fromFile",
    async (event, terrainId: string, sourcePath: string, sizeX: number, sizeZ: number) =>
      runImport(event.sender, terrainId, sourcePath, sizeX, sizeZ)
  );

  ipcMain.handle(
    "mapImport:downloadAndImport",
    async (event, terrainId: string, imageUrl: string, sizeX: number, sizeZ: number) => {
      const ac = new AbortController();
      currentImport = ac;
      const tmpPath = join(app.getPath("temp"), `mortar-import-${randomUUID()}.png`);
      try {
        await downloadFile(
          imageUrl,
          tmpPath,
          (p) => event.sender.send("mapImport:progress", { terrainId, phase: "download", ...p }),
          ac.signal
        );
        return await runImport(event.sender, terrainId, tmpPath, sizeX, sizeZ, ac);
      } catch (err) {
        if (ac.signal.aborted) return { ok: false as const, cancelled: true as const };
        throw err;
      } finally {
        await rm(tmpPath, { force: true });
      }
    }
  );

  ipcMain.handle("mapImport:cancel", () => {
    currentImport?.abort();
    currentImport = null;
  });

  ipcMain.handle("mapImport:remove", async (_e, terrainId: string) => {
    await rm(pyramidDir(terrainId), { recursive: true, force: true });
    await rm(heightsPath(terrainId), { force: true });
  });

  ipcMain.handle("heights:importFromUrl", (_e, terrainId: string, url: string) =>
    convertHeightData(terrainId, url)
  );
  ipcMain.handle("heights:read", (_e, terrainId: string) => readHeights(terrainId));
}

async function runImport(
  sender: Electron.WebContents,
  terrainId: string,
  sourcePath: string,
  sizeX: number,
  sizeZ: number,
  ac: AbortController = new AbortController()
) {
  currentImport = ac;
  try {
    const result = await buildTilePyramid(
      sourcePath,
      sizeX,
      sizeZ,
      pyramidDir(terrainId),
      (p: ImportProgress) => sender.send("mapImport:progress", { terrainId, phase: "tile", ...p }),
      ac.signal
    );
    return { ok: true as const, ...result };
  } catch (err) {
    if (err instanceof ImportCancelledError) return { ok: false as const, cancelled: true as const };
    throw err;
  } finally {
    if (currentImport === ac) currentImport = null;
  }
}
