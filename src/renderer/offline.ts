/**
 * Офлайн-режим телефона: збереження карти вибраного терену на пристрої. Тайли й висоти запитуються
 * як звичайно — service worker (public/sw.js) кладе їх у кеш і віддає без мережі.
 * Працює лише в безпечному контексті (HTTPS із довірчим сертифікатом або localhost).
 */
import { planPyramid } from "@core/tilePyramid";
import { onlineTileList } from "@core/onlineTiles";
import { $, toast } from "./dom";
import { t } from "./i18n";
import { currentMeta, getCurrent } from "./state";
import { isOffline, isRemote } from "./platform";

const TILES_CACHE = "mortar-tiles-v1";
/** Орієнтовний розмір тайла: піраміда (256 px, JPEG q90) і онлайн-тайли (~540 px). */
const PYRAMID_TILE_BYTES = 16 * 1024;
const ONLINE_TILE_BYTES = 40 * 1024;
const CONCURRENCY = 6;

export interface OfflineOption {
  /** Скільки найгрубших рівнів включено (від найгрубшого). */
  key: string;
  label: string;
  urls: string[];
  bytes: number;
}

/** Рівні деталізації для поточного терену: кожен наступний варіант включає всі попередні. */
export function offlineOptions(): OfflineOption[] {
  const meta = currentMeta();
  const S = getCurrent();
  const extra = [`/api/heights/${encodeURIComponent(meta.id)}`];
  const opts: OfflineOption[] = [];

  if (S.map && S.map.kind === "pyramid") {
    const plan = planPyramid(S.map.width, S.map.height);
    const top = plan.maxLevel;
    const urlsUpTo = (maxZ: number): string[] => {
      const out: string[] = [];
      for (const lv of plan.levels) {
        if (lv.z > maxZ) break;
        for (let row = 0; row < lv.rows; row++) {
          for (let col = 0; col < lv.cols; col++) out.push(`/localtile/${meta.id}/${lv.z}/${row}/${col}`);
        }
      }
      return out;
    };
    const picks = [...new Set([Math.max(0, top - 3), Math.max(0, top - 2), Math.max(0, top - 1), top])];
    const names = [t("offlineLevelLow"), t("offlineLevelMid"), t("offlineLevelHigh"), t("offlineLevelFull")];
    picks.forEach((z, i) => {
      const urls = urlsUpTo(z);
      opts.push({ key: `p${z}`, label: names[names.length - picks.length + i] ?? names[i], urls: [...urls, ...extra], bytes: urls.length * PYRAMID_TILE_BYTES });
    });
    return opts;
  }

  const tiles = meta.preset?.tiles;
  if (tiles) {
    const maxLod = tiles.maxLod;
    const urlsFrom = (minLod: number): string[] =>
      onlineTileList(meta.sizeX, meta.sizeZ, maxLod, minLod).map((c) => `/tile/${meta.id}/${c.lod}/${c.x}/${c.y}`);
    const picks = [...new Set([Math.min(maxLod, 3), Math.min(maxLod, 2), 1, 0].filter((l) => l <= maxLod))];
    const names = [t("offlineLevelLow"), t("offlineLevelMid"), t("offlineLevelHigh"), t("offlineLevelFull")];
    picks.forEach((lod, i) => {
      const urls = urlsFrom(lod);
      opts.push({ key: `o${lod}`, label: names[i] ?? names[names.length - 1], urls: [...urls, ...extra], bytes: urls.length * ONLINE_TILE_BYTES });
    });
  }
  return opts;
}

function fmtMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb < 10 ? mb.toFixed(1) : String(Math.round(mb));
}

async function cachedCount(prefixes: string[]): Promise<number> {
  if (!("caches" in window)) return 0;
  try {
    const cache = await caches.open(TILES_CACHE);
    const keys = await cache.keys();
    return keys.filter((r) => prefixes.some((p) => new URL(r.url).pathname.startsWith(p))).length;
  } catch {
    return 0;
  }
}

function terrainPrefixes(id: string): string[] {
  return [`/localtile/${id}/`, `/tile/${id}/`, `/api/heights/${id}`];
}

let abort: AbortController | null = null;

async function download(opt: OfflineOption): Promise<void> {
  if (abort) return;
  abort = new AbortController();
  const signal = abort.signal;
  const bar = $<HTMLProgressElement>("offlineProg");
  const txt = $("offlineProgText");
  bar.hidden = false;
  txt.hidden = false;
  bar.max = opt.urls.length;
  bar.value = 0;
  $<HTMLButtonElement>("offlineSave").hidden = true;
  $<HTMLButtonElement>("offlineStop").hidden = false;
  let done = 0;
  let failed = 0;
  let next = 0;
  const worker = async (): Promise<void> => {
    while (!signal.aborted) {
      const i = next++;
      if (i >= opt.urls.length) return;
      try {
        const res = await fetch(opt.urls[i], { signal });
        if (!res.ok) failed++;
        else await res.arrayBuffer();
      } catch {
        if (signal.aborted) return;
        failed++;
      }
      done++;
      bar.value = done;
      txt.textContent = t("offlineProgress", { done, total: opt.urls.length });
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const aborted = signal.aborted;
  abort = null;
  bar.hidden = true;
  $<HTMLButtonElement>("offlineStop").hidden = true;
  $<HTMLButtonElement>("offlineSave").hidden = false;
  txt.textContent = aborted
    ? t("offlineStopped", { done })
    : failed > opt.urls.length / 2
      ? t("offlineFailed")
      : t("offlineDone", { done: done - failed, failed });
  void refresh();
}

async function clearTerrain(): Promise<void> {
  const id = currentMeta().id;
  try {
    const cache = await caches.open(TILES_CACHE);
    const prefixes = terrainPrefixes(id);
    for (const req of await cache.keys()) {
      if (prefixes.some((p) => new URL(req.url).pathname.startsWith(p))) await cache.delete(req);
    }
  } catch {
    // кеш недоступний — нічого видаляти
  }
  toast(t("offlineCleared"));
  void refresh();
}

async function refresh(): Promise<void> {
  const meta = currentMeta();
  const secure = window.isSecureContext;
  const controlled = "serviceWorker" in navigator && !!navigator.serviceWorker.controller;
  const state = $("offlineState");
  state.textContent = controlled
    ? t("offlineActive")
    : secure
      ? t("offlineNotYet")
      : t("offlineNoHttps");
  state.dataset.ok = controlled ? "1" : "0";

  $("offlineTerrain").textContent = meta.name;
  const sel = $<HTMLSelectElement>("offlineLevel");
  const prev = sel.value;
  sel.textContent = "";
  const opts = offlineOptions();
  for (const o of opts) {
    sel.appendChild(new Option(t("offlineOpt", { label: o.label, n: o.urls.length, mb: fmtMb(o.bytes) }), o.key));
  }
  if (opts.some((o) => o.key === prev)) sel.value = prev;
  const hasMap = opts.length > 0;
  sel.disabled = !hasMap;
  $<HTMLButtonElement>("offlineSave").disabled = !hasMap || !secure;
  $("offlineNoMap").hidden = hasMap;

  const n = await cachedCount(terrainPrefixes(meta.id));
  $("offlineSaved").textContent = t("offlineSaved", { n });
  $<HTMLButtonElement>("offlineClear").disabled = n === 0;

  let usage = "";
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.usage) usage = t("offlineUsage", { mb: fmtMb(est.usage), quota: est.quota ? fmtMb(est.quota) : "?" });
  } catch {
    // немає storage API
  }
  $("offlineUsage").textContent = usage;
}

export function initOffline(): void {
  const btn = $<HTMLButtonElement>("offlineBtn");
  if (!isRemote) {
    btn.hidden = true;
    return;
  }
  const dlg = $<HTMLDialogElement>("offlineDlg");
  btn.onclick = () => {
    dlg.showModal();
    void refresh();
  };
  $<HTMLButtonElement>("offlineClose").onclick = () => dlg.close();
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });
  $<HTMLButtonElement>("offlineSave").onclick = () => {
    const key = $<HTMLSelectElement>("offlineLevel").value;
    const opt = offlineOptions().find((o) => o.key === key);
    if (!opt) return;
    if (isOffline()) {
      toast(t("offlineNeedsPc"));
      return;
    }
    void download(opt);
  };
  $<HTMLButtonElement>("offlineStop").onclick = () => abort?.abort();
  $<HTMLButtonElement>("offlineClear").onclick = () => void clearTerrain();
  $<HTMLSelectElement>("offlineLevel").onchange = () => undefined;
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (dlg.open) void refresh();
    });
  }
}
