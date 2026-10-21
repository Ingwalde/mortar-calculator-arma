/**
 * Офлайн-режим на ПК: онлайн-тайли карти (Everon, Arland, Kolguyev) зберігаються в дисковий кеш застосунку
 * (main-процес), щоб карта працювала без інтернету. Імпортовані карти вже лежать на диску.
 */
import { onlineTileList } from "@core/onlineTiles";
import { $ } from "./dom";
import { t } from "./i18n";
import { currentMeta } from "./state";
import { isNativeApp, isStandalone } from "./platform";

/** Кеш service worker-а, який могли створити старі версії сайту (PWA): його прибираємо. */
const TILES_CACHE = "mortar-tiles-v1";
/** Орієнтовний розмір онлайн-тайла (~540 px). */
const ONLINE_TILE_BYTES = 40 * 1024;

function fmtMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb < 10 ? mb.toFixed(1) : String(Math.round(mb));
}

function setBusy(busy: boolean): void {
  $<HTMLButtonElement>("offlineSave").hidden = busy;
  $<HTMLButtonElement>("offlineStop").hidden = !busy;
  $<HTMLProgressElement>("offlineProg").hidden = !busy;
  $<HTMLSelectElement>("offlineLevel").disabled = busy;
}

function summary(done: number, missing: number, failed: number, aborted: boolean): string {
  if (aborted) return t("offlineStopped", { done });
  if (done === 0 && failed > 0) return t("offlineFailed");
  return t("offlineDone", { done, missing, failed });
}

/** Варіанти деталізації: лише онлайн-тайли (імпортована карта вже на диску). */
function pcOptions(): { key: string; minLod: number; label: string; n: number; bytes: number }[] {
  const meta = currentMeta();
  const tiles = meta.preset?.tiles;
  if (!tiles) return [];
  const names = [t("offlineLevelLow"), t("offlineLevelMid"), t("offlineLevelHigh"), t("offlineLevelFull")];
  const lods = [...new Set([Math.min(tiles.maxLod, 3), Math.min(tiles.maxLod, 2), 1, 0])];
  return lods.map((lod, i) => {
    const n = onlineTileList(meta.sizeX, meta.sizeZ, tiles.maxLod, lod).length;
    return { key: `o${lod}`, minLod: lod, label: names[i] ?? names[names.length - 1], n, bytes: n * ONLINE_TILE_BYTES };
  });
}

function refresh(): void {
  const meta = currentMeta();
  const state = $("offlineState");
  state.dataset.ok = "1";
  $("offlineTerrain").textContent = meta.name;
  const opts = pcOptions();
  const sel = $<HTMLSelectElement>("offlineLevel");
  const prev = sel.value;
  sel.textContent = "";
  for (const o of opts) sel.appendChild(new Option(t("offlineOpt", { label: o.label, n: o.n, mb: fmtMb(o.bytes) }), o.key));
  if (opts.some((o) => o.key === prev)) sel.value = prev;
  const has = opts.length > 0;
  state.textContent = has ? t("offlinePcTiles") : t("offlinePcLocal");
  sel.hidden = !has;
  $<HTMLButtonElement>("offlineSave").hidden = !has;
}

/** Онлайн-тайли зберігаються в дисковий кеш застосунку (main-процес). */
async function pcDownload(minLod: number): Promise<void> {
  const meta = currentMeta();
  const bar = $<HTMLProgressElement>("offlineProg");
  const txt = $("offlineProgText");
  txt.hidden = false;
  bar.max = 1;
  bar.value = 0;
  setBusy(true);
  const off = window.api.tiles.onPrefetchProgress((p) => {
    bar.max = p.total;
    bar.value = p.done;
    txt.textContent = t("offlineProgress", { done: p.done, total: p.total });
  });
  try {
    const res = await window.api.tiles.prefetch(meta.id, minLod);
    txt.textContent = summary(res.done, res.missing, res.failed, res.cancelled === true);
  } finally {
    off();
    setBusy(false);
  }
}

/**
 * Кнопка «хмарка» в шапці: діалог збереження карти на диск (лише застосунок на ПК).
 * Android-застосунок і сайт її не мають: у APK усе вже в пакеті, а на сайті тайли йдуть з першоджерела.
 */
export function initOffline(): void {
  if (isNativeApp) return;
  if (isStandalone) {
    // збережене старими версіями сайту стираємо
    if ("caches" in window) void caches.delete(TILES_CACHE).catch(() => undefined);
    return;
  }
  const btn = $<HTMLButtonElement>("offlineBtn");
  btn.hidden = false;
  const dlg = $<HTMLDialogElement>("offlineDlg");
  btn.onclick = () => {
    dlg.showModal();
    refresh();
  };
  $<HTMLButtonElement>("offlineClose").onclick = () => dlg.close();
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });
  $<HTMLButtonElement>("offlineSave").onclick = () => {
    const opt = pcOptions().find((o) => o.key === $<HTMLSelectElement>("offlineLevel").value);
    if (opt) void pcDownload(opt.minLod);
  };
  $<HTMLButtonElement>("offlineStop").onclick = () => void window.api.tiles.cancelPrefetch();
}
