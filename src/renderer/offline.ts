/**
 * Офлайн-режим телефона: збереження карти вибраного терену на пристрої. Тайли й висоти запитуються
 * як звичайно — service worker (public/sw.js) кладе їх у кеш і віддає без мережі.
 * Працює лише в безпечному контексті (HTTPS із довірчим сертифікатом або localhost).
 */
import { planPyramid } from "@core/tilePyramid";
import { onlineTileList } from "@core/onlineTiles";
import { detailTilePath, isMirroredTile, mirroredTilePath, modMapTilePath, webDetailMinLod, webHeightsPath, webMirrorMinLod } from "@core/webMirror";
import { PRESETS } from "@core/terrains";
import { getRoot } from "./state";
import { $, toast } from "./dom";
import { t } from "./i18n";
import { currentMeta, getCurrent } from "./state";
import { isNativeApp, isOffline, isRemote, isStandalone } from "./platform";

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
/** Середній розмір тайла піраміди з ПК (кеш у пам'яті сторінки); null — невідомо. */
const avgBytesCache = new Map<string, number | null>();
async function loadAvgBytes(id: string): Promise<void> {
  if (isStandalone || avgBytesCache.has(id)) return;
  try {
    const res = await fetch(`/api/tilestat/${encodeURIComponent(id)}`);
    const j = (await res.json()) as { avgBytes: number | null };
    avgBytesCache.set(id, typeof j.avgBytes === "number" ? j.avgBytes : null);
  } catch {
    // ПК недосяжний — лишається типова оцінка
  }
}

/** Середній розмір тайла зі свого сайту (дзеркальні й деталізовані JPEG), для оцінки обсягу. */
const SITE_TILE_BYTES = 22 * 1024;

/** Автономна версія: тайли зі свого сайту — дзеркальні й (у PWA) деталізовані; глибше — лише онлайн. */
function standaloneOptions(): OfflineOption[] {
  const meta = currentMeta();
  const tiles = meta.preset?.tiles;
  const minMirror = webMirrorMinLod(meta.id);
  if (!tiles || minMirror === undefined) return [];
  // у Android-застосунку деталізованих рівнів нема (діалог там прихований, але логіка лишається правильною)
  const detail = isNativeApp ? undefined : webDetailMinLod(meta.id);
  const finest = Math.min(minMirror, detail ?? minMirror);
  const names = [t("offlineLevelLow"), t("offlineLevelMid"), t("offlineLevelHigh"), t("offlineLevelFull")];
  const lods = [3, 2, 1, 0].filter((l) => l >= finest && l <= tiles.maxLod);
  const sitePath = (lod: number, x: number, y: number): string =>
    isMirroredTile(meta.id, lod) ? mirroredTilePath(meta.id, lod, x, y) : detailTilePath(meta.id, lod, x, y);
  return lods.map((lod, i) => {
    const urls = onlineTileList(meta.sizeX, meta.sizeZ, tiles.maxLod, lod).map((c) => sitePath(c.lod, c.x, c.y));
    return {
      key: `w${lod}`,
      label: names[i] ?? names[names.length - 1],
      urls: [...urls, webHeightsPath(meta.id)],
      bytes: urls.length * SITE_TILE_BYTES
    };
  });
}

export function offlineOptions(): OfflineOption[] {
  if (isStandalone) return standaloneOptions();
  const meta = currentMeta();
  const S = getCurrent();
  const extra = [isStandalone ? webHeightsPath(meta.id) : `/api/heights/${encodeURIComponent(meta.id)}`];
  const opts: OfflineOption[] = [];

  if (S.map && S.map.kind === "pyramid") {
    const plan = planPyramid(S.map.width, S.map.height);
    const top = plan.maxLevel;
    const urlsUpTo = (maxZ: number): string[] => {
      const out: string[] = [];
      for (const lv of plan.levels) {
        if (lv.z > maxZ) break;
        for (let row = 0; row < lv.rows; row++) {
          for (let col = 0; col < lv.cols; col++) {
            out.push(isStandalone ? modMapTilePath(meta.id, lv.z, row, col) : `/localtile/${meta.id}/${lv.z}/${row}/${col}`);
          }
        }
      }
      return out;
    };
    const picks = [...new Set([Math.max(0, top - 3), Math.max(0, top - 2), Math.max(0, top - 1), top])];
    const names = [t("offlineLevelLow"), t("offlineLevelMid"), t("offlineLevelHigh"), t("offlineLevelFull")];
    picks.forEach((z, i) => {
      const urls = urlsUpTo(z);
      const avg = avgBytesCache.get(meta.id) ?? PYRAMID_TILE_BYTES;
      opts.push({ key: `p${z}`, label: names[names.length - picks.length + i] ?? names[i], urls: [...urls, ...extra], bytes: urls.length * avg });
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
  if (isStandalone) {
    // сайт може лежати на підшляху (GitHub Pages): ключі кешу — повні шляхи
    const root = new URL("./", document.baseURI).pathname;
    return [`${root}tiles/${id}/`, `${root}tiles-hd/${id}/`, `${root}maps/${id}/`, `${root}heights/${id}`];
  }
  return [`/localtile/${id}/`, `/tile/${id}/`, `/api/heights/${id}`];
}

let abort: AbortController | null = null;

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

/** Телефон: тайли тягнуться через service worker, що кладе їх у кеш пристрою. */
async function download(opt: OfflineOption): Promise<void> {
  if (abort) return;
  abort = new AbortController();
  const signal = abort.signal;
  const bar = $<HTMLProgressElement>("offlineProg");
  const txt = $("offlineProgText");
  txt.hidden = false;
  bar.max = opt.urls.length;
  bar.value = 0;
  setBusy(true);
  let done = 0;
  let missing = 0;
  let failed = 0;
  let next = 0;
  let finished = 0;
  const worker = async (): Promise<void> => {
    while (!signal.aborted) {
      const i = next++;
      if (i >= opt.urls.length) return;
      try {
        const res = await fetch(opt.urls[i], { signal });
        if (res.status === 404) missing++;
        else if (!res.ok) failed++;
        else {
          await res.arrayBuffer();
          done++;
        }
      } catch {
        if (signal.aborted) return;
        failed++;
      }
      finished++;
      bar.value = finished;
      txt.textContent = t("offlineProgress", { done: finished, total: opt.urls.length });
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const aborted = signal.aborted;
  abort = null;
  setBusy(false);
  txt.textContent = summary(done, missing, failed, aborted);
  void refresh();
}

/** ПК: онлайн-тайли зберігаються в дисковий кеш застосунку (main-процес). */
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

async function clearTerrain(terrainId?: string): Promise<void> {
  const id = terrainId ?? currentMeta().id;
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

/** Видаляє з кешу все збережене для всіх теренів. */
async function clearAllSaved(): Promise<void> {
  try {
    const cache = await caches.open(TILES_CACHE);
    for (const req of await cache.keys()) await cache.delete(req);
  } catch {
    // кеш недоступний
  }
  toast(t("offlineCleared"));
  void refresh();
}

const TERRAIN_FROM_PATH = /(?:^|\/)(?:tiles|tiles-hd|maps|localtile|tile)\/([A-Za-z0-9_-]+)\//;
const HEIGHTS_FROM_PATH = /(?:^|\/)(?:api\/heights|heights)\/([A-Za-z0-9_-]+)/;

/** Збережене на пристрої за теренами: кількість файлів і розмір (з content-length, інакше оцінка). */
async function savedByTerrain(): Promise<Map<string, { files: number; bytes: number }>> {
  const out = new Map<string, { files: number; bytes: number }>();
  if (!("caches" in window)) return out;
  try {
    const cache = await caches.open(TILES_CACHE);
    const keys = await cache.keys();
    const owner = (req: Request): string | null => {
      const p = new URL(req.url).pathname;
      return TERRAIN_FROM_PATH.exec(p)?.[1] ?? HEIGHTS_FROM_PATH.exec(p)?.[1] ?? null;
    };
    for (let i = 0; i < keys.length; i += 100) {
      await Promise.all(
        keys.slice(i, i + 100).map(async (req) => {
          const id = owner(req);
          if (!id) return;
          const res = await cache.match(req);
          const len = Number(res?.headers.get("content-length"));
          const e = out.get(id) ?? { files: 0, bytes: 0 };
          e.files++;
          e.bytes += Number.isFinite(len) && len > 0 ? len : SITE_TILE_BYTES;
          out.set(id, e);
        })
      );
    }
  } catch {
    // кеш недоступний
  }
  return out;
}

function terrainTitle(id: string): string {
  return PRESETS.find((p) => p.id === id)?.name ?? getRoot().customTerrains.find((c) => c.id === id)?.name ?? id;
}

/** Список збереженого на пристрої (PWA): за теренами, з кнопками видалення. */
async function renderSavedList(): Promise<void> {
  const box = $("offlineList");
  const stats = await savedByTerrain();
  box.textContent = "";
  box.hidden = stats.size === 0;
  if (!stats.size) return;
  const title = document.createElement("div");
  title.className = "storage-head";
  title.textContent = t("offlineListTitle");
  box.appendChild(title);
  for (const [id, s] of [...stats.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const row = document.createElement("div");
    row.className = "storage-row";
    const txt = document.createElement("span");
    txt.textContent = `${terrainTitle(id)}: ${fmtMb(s.bytes)} ${t("unitMb")} · ${s.files} ${t("storageFiles")}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn small danger";
    btn.textContent = t("deleteBtn");
    btn.onclick = () => void clearTerrain(id);
    row.append(txt, btn);
    box.appendChild(row);
  }
  if (stats.size > 1) {
    const all = document.createElement("button");
    all.type = "button";
    all.className = "btn small danger";
    all.style.marginTop = "6px";
    all.textContent = t("offlineClearAll");
    all.onclick = () => void clearAllSaved();
    box.appendChild(all);
  }
}

/** Варіанти деталізації для ПК: лише онлайн-тайли (імпортована карта вже на диску). */
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

function refreshPc(): void {
  const meta = currentMeta();
  const state = $("offlineState");
  state.dataset.ok = "1";
  $("offlineIntro").hidden = true;
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
  $<HTMLButtonElement>("offlineSave").hidden = !has || abort !== null;
  $("offlineNoMap").hidden = true;
  $("offlineSaved").hidden = true;
  $("offlineUsage").hidden = true;
}

async function refresh(): Promise<void> {
  if (!isRemote) {
    refreshPc();
    return;
  }
  const meta = currentMeta();
  $("offlineIntro").hidden = false;
  await loadAvgBytes(meta.id);
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
  sel.disabled = !hasMap || abort !== null;
  $<HTMLButtonElement>("offlineSave").disabled = !hasMap || !secure;
  $("offlineNoMap").hidden = hasMap;

  void renderSavedList();
  const n = await cachedCount(terrainPrefixes(meta.id));
  $("offlineSaved").textContent = t("offlineSaved", { n });

  let usage = "";
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.usage) usage = t("offlineUsage", { mb: fmtMb(est.usage), quota: est.quota ? fmtMb(est.quota) : "?" });
  } catch {
    // немає storage API
  }
  $("offlineUsage").textContent = usage;
}

/**
 * Кнопка «хмарка» в шапці: діалог збереження карти. На телефоні — у кеш пристрою (service worker),
 * на ПК — онлайн-тайли на диск (для імпортованих карт показує, що вони вже на диску).
 */
export function initOffline(): void {
  // в Android-застосунку все вже в пакеті: кнопка збереження карти не потрібна
  if (isNativeApp) return;
  const btn = $<HTMLButtonElement>("offlineBtn");
  btn.hidden = false;
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
    if (!isRemote) {
      const opt = pcOptions().find((o) => o.key === key);
      if (opt) void pcDownload(opt.minLod);
      return;
    }
    const opt = offlineOptions().find((o) => o.key === key);
    if (!opt) return;
    if (isOffline()) {
      toast(t("offlineNeedsPc"));
      return;
    }
    void download(opt);
  };
  $<HTMLButtonElement>("offlineStop").onclick = () => {
    if (isRemote) abort?.abort();
    else void window.api.tiles.cancelPrefetch();
  };
  if (isRemote && "serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (dlg.open) void refresh();
    });
  }
}
