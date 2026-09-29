import { contextBridge, ipcRenderer } from "electron";

export interface MapImportProgress {
  terrainId: string;
  phase: "download" | "tile";
  done: number;
  total: number;
}

export interface MapImportResult {
  ok: boolean;
  cancelled?: boolean;
  plan?: unknown;
  croppedWidth?: number;
  croppedHeight?: number;
}

const api = {
  store: {
    load: (): Promise<unknown> => ipcRenderer.invoke("store:load"),
    save: (data: unknown): Promise<void> => ipcRenderer.invoke("store:save", data)
  },
  dialogs: {
    pickImageFile: (): Promise<string | null> => ipcRenderer.invoke("dialog:pickImageFile")
  },
  mapImport: {
    fromFile: (terrainId: string, sourcePath: string, sizeX: number, sizeZ: number): Promise<MapImportResult> =>
      ipcRenderer.invoke("mapImport:fromFile", terrainId, sourcePath, sizeX, sizeZ),
    downloadAndImport: (
      terrainId: string,
      imageUrl: string,
      sizeX: number,
      sizeZ: number
    ): Promise<MapImportResult> =>
      ipcRenderer.invoke("mapImport:downloadAndImport", terrainId, imageUrl, sizeX, sizeZ),
    cancel: (): Promise<void> => ipcRenderer.invoke("mapImport:cancel"),
    remove: (terrainId: string): Promise<void> => ipcRenderer.invoke("mapImport:remove", terrainId),
    onProgress: (cb: (p: MapImportProgress) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, p: MapImportProgress) => cb(p);
      ipcRenderer.on("mapImport:progress", listener);
      return () => ipcRenderer.removeListener("mapImport:progress", listener);
    }
  },
  heights: {
    importFromUrl: (terrainId: string, url: string): Promise<{ rows: number; cols: number }> =>
      ipcRenderer.invoke("heights:importFromUrl", terrainId, url),
    read: (terrainId: string): Promise<Uint8Array | null> => ipcRenderer.invoke("heights:read", terrainId)
  },
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
};

contextBridge.exposeInMainWorld("api", api);

export type MortarApi = typeof api;
