import { currentMeta, getCurrent, scheduleSave, type TerrainMeta } from "./state";
import { bundledMap } from "@core/bundledMaps";
import { resetView } from "./mapView";
import { $, toast } from "./dom";
import type { MapImportProgress } from "../preload/index";
import { t } from "./i18n";
import { isRemote } from "./platform";
import { forgetHeights, heightAt, loadHeightGrid } from "./terrainHeight";

let importing = false;


/**
 * Автовисота під міткою — використовується в діалозі додавання мітки.
 *
 * Нулі в height_data — це море (перевірено накладенням на тайли Everon, Arland і Kolguyev), тож
 * на воді чесно кажемо "невідомо" замість нуля. Орієнтацію сітки (рядок = X, стовпець йде з
 * півночі на південь) описано в core/heightGrid.ts.
 */
export async function getAutoHeight(terrainId: string, x: number, z: number, sizeX: number, sizeZ: number): Promise<number | null> {
  await loadHeightGrid(terrainId);
  return heightAt(terrainId, x, z, sizeX, sizeZ);
}

/**
 * Тихо підтягує дані висот для терену, якщо вони є в GeNeFRAG/ArmaReforger і ще не завантажені,
 * і одразу прогріває кеш у пам'яті рендерера (читання+декодування бінарника може бути помітним
 * для великих теренів — краще зробити це заздалегідь, а не в момент відкриття діалогу мітки).
 */
export async function ensureHeights(onDone: () => void): Promise<void> {
  const S = getCurrent();
  const meta = currentMeta();
  // Терени без heightData у каталозі (Bad Orb) можуть мати висоти, поставлені разом із застосунком.
  if (!meta.preset?.heightData) {
    if (await loadHeightGrid(meta.id)) onDone();
    return;
  }
  let grid = await loadHeightGrid(meta.id);
  // У стані може бути позначено, що висоти є, а файлу на диску вже нема (видалено/інша машина) —
  // тоді перекачуємо, а не лишаємось мовчки без висот.
  if (!grid && !isRemote) {
    try {
      const info = await window.api.heights.importFromUrl(meta.id, meta.preset.heightData);
      S.heights = info;
      forgetHeights(meta.id);
      scheduleSave();
      grid = await loadHeightGrid(meta.id);
    } catch {
      return; // дані висот не критичні — тихо лишаємось без автовисоти для цього терену
    }
  }
  if (grid) onDone();
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
    forgetHeights(meta.id);
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
  if (isRemote || S.map !== null) return;
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
      forgetHeights(meta.id);
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
    // вбудована карта (якщо є) повертається замість порожньої сітки
    const bm = bundledMap(meta.id);
    getCurrent().map = bm ? { kind: "pyramid", width: bm.width, height: bm.height } : { kind: "none" };
    forgetHeights(meta.id);
    scheduleSave();
    resetView();
    onDone();
    await window.api.mapImport.remove(meta.id);
    toast(t("mapRemoved"));
  };

  void ensureHeights(onDone);
  void ensureMapImage(onDone);
}
