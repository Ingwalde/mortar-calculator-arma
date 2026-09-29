import { decodeHeightGrid, sampleHeight, type HeightGrid } from "@core/heightGrid";
import { currentMeta, getCurrent, scheduleSave, type TerrainMeta } from "./state";
import { resetView } from "./mapView";
import { $, toast } from "./dom";
import type { MapImportProgress } from "../preload/index";
import { t } from "./i18n";

const heightCache = new Map<string, HeightGrid | null>();
let importing = false;

async function loadHeightGrid(terrainId: string): Promise<HeightGrid | null> {
  if (heightCache.has(terrainId)) return heightCache.get(terrainId)!;
  const buf = await window.api.heights.read(terrainId);
  const grid = buf ? decodeHeightGrid(buf) : null;
  heightCache.set(terrainId, grid);
  return grid;
}

/**
 * Автовисота під міткою — використовується в діалозі додавання мітки.
 *
 * Прогалини у height_data (GeNeFRAG/ArmaReforger) — клітинки з сентинелом 0 замість реального
 * рельєфу (перевірено на Everon: "0" траплявся в ~68% клітинок, у 25 разів частіше за наступне
 * популярне значення, включно з реально гірськими ділянками) — уже заповнені значенням
 * найближчої реальної клітинки при імпорті (main/tiles/heights.ts, fillHeightGaps). Перевірка
 * тут — лише запобіжник на випадок, якщо вся сітка терену виявиться нульовою (нема з чого
 * заповнювати) — тоді чесно кажемо "невідомо", а не показуємо оманливий нуль.
 */
export async function getAutoHeight(terrainId: string, x: number, z: number, sizeX: number, sizeZ: number): Promise<number | null> {
  const grid = await loadHeightGrid(terrainId);
  if (!grid) return null;
  const h = sampleHeight(grid, x, z, sizeX, sizeZ);
  return h === 0 ? null : h;
}

/**
 * Тихо підтягує дані висот для терену, якщо вони є в GeNeFRAG/ArmaReforger і ще не завантажені,
 * і одразу прогріває кеш у пам'яті рендерера (читання+декодування бінарника може бути помітним
 * для великих теренів — краще зробити це заздалегідь, а не в момент відкриття діалогу мітки).
 */
export async function ensureHeights(onDone: () => void): Promise<void> {
  const S = getCurrent();
  const meta = currentMeta();
  if (!meta.preset?.heightData) return;
  if (!S.heights) {
    try {
      const info = await window.api.heights.importFromUrl(meta.id, meta.preset.heightData);
      S.heights = info;
      heightCache.delete(meta.id);
      scheduleSave();
      onDone();
    } catch {
      return; // дані висот не критичні — тихо лишаємось без автовисоти для цього терену
    }
  }
  void loadHeightGrid(meta.id);
}

function setProgressText(text: string | null): void {
  const el = $("importProg");
  if (text === null) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = text;
}

function progressLabel(p: MapImportProgress): string {
  const pct = p.total ? Math.floor((p.done / p.total) * 100) : 0;
  const phase = p.phase === "download" ? t("importPhaseDownload") : t("importPhaseTiling");
  return t("importProgress", { phase, pct, done: p.done, total: p.total });
}

async function runDownloadImport(meta: TerrainMeta, imageUrl: string, onDone: () => void): Promise<void> {
  if (importing) return;
  importing = true;
  setProgressText(t("downloading"));
  try {
    const res = await window.api.mapImport.downloadAndImport(meta.id, imageUrl, meta.sizeX, meta.sizeZ);
    if (!res.ok) {
      if (!res.cancelled) toast(t("downloadImportFailed", { name: meta.name }));
      return;
    }
    getCurrent().map = { kind: "pyramid", width: res.croppedWidth!, height: res.croppedHeight! };
    heightCache.delete(meta.id);
    scheduleSave();
    resetView();
    onDone();
    toast(t("downloadImportOk", { name: meta.name }));
  } catch (err) {
    toast(t("errorPrefix", { msg: String((err as Error).message ?? err) }));
  } finally {
    setProgressText(null);
    importing = false;
  }
}

/**
 * Автоматично завантажує й імпортує супутниковий знімок для теренів без онлайн-тайлів
 * (усі, крім Everon/Arland) — щойно на них перемкнулись і карти ще не було. Якщо користувач
 * явно натиснув «Прибрати карту» (map.kind==="none"), повторно не пропонуємо.
 */
export async function ensureMapImage(onDone: () => void): Promise<void> {
  const S = getCurrent();
  const meta = currentMeta();
  if (S.map !== null) return;
  if (meta.preset?.tiles) return;
  if (!meta.preset?.mapImage) return;
  await runDownloadImport(meta, meta.preset.mapImage, onDone);
}

export function startMapImportUi(onDone: () => void): void {
  window.api.mapImport.onProgress((p) => setProgressText(progressLabel(p)));

  $<HTMLButtonElement>("pickFile").onclick = async () => {
    const path = await window.api.dialogs.pickImageFile();
    if (!path) return;
    const meta = currentMeta();
    setProgressText(t("processingMap"));
    try {
      const res = await window.api.mapImport.fromFile(meta.id, path, meta.sizeX, meta.sizeZ);
      if (!res.ok) {
        toast(res.cancelled ? t("importCancelled") : t("importFailed"));
        return;
      }
      getCurrent().map = { kind: "pyramid", width: res.croppedWidth!, height: res.croppedHeight! };
      heightCache.delete(meta.id);
      scheduleSave();
      resetView();
      onDone();
      toast(t("mapImported"));
    } catch (err) {
      toast(t("importErrorPrefix", { msg: String((err as Error).message ?? err) }));
    } finally {
      setProgressText(null);
    }
  };

  $<HTMLButtonElement>("downloadImport").onclick = () => {
    const meta = currentMeta();
    if (!meta.preset?.mapImage) return;
    void runDownloadImport(meta, meta.preset.mapImage, onDone);
  };

  $<HTMLButtonElement>("clearMap").onclick = async () => {
    const meta = currentMeta();
    getCurrent().map = { kind: "none" };
    heightCache.delete(meta.id);
    scheduleSave();
    resetView();
    onDone();
    await window.api.mapImport.remove(meta.id);
    toast(t("mapRemoved"));
  };

  void ensureHeights(onDone);
  void ensureMapImage(onDone);
}
