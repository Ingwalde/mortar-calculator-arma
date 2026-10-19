/**
 * Платформа: у вікні Electron `window.api` дає preload; у браузері телефона (сторінку віддає
 * LAN-сервер застосунку на ПК) його немає — тут створюється веб-замінник з тим самим інтерфейсом.
 * Імпортувати цей модуль треба першим (main.ts), до будь-якого використання window.api.
 */
import type { MortarApi } from "../preload/index";
import { tileUrl } from "@core/onlineTiles";
import { findPreset } from "@core/terrains";
import { modMapTilePath, siteTilePath, webHeightsPath, webModMap } from "@core/webMirror";

/** Автономна веб-версія (PWA на Pages / APK): без ПК, стан лише на пристрої. Підставляється збіркою. */
export const isStandalone: boolean = typeof __STANDALONE__ !== "undefined" && __STANDALONE__;

/** Усередині Android-застосунку (Capacitor): карта й висоти вже в пакеті, service worker не потрібен. */
export const isNativeApp: boolean = !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

const clientId = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);

// ---- офлайн-копія стану на телефоні (localStorage): застосунок відкривається й рахує без ПК,
// зміни лишаються на пристрої й зливаються з ПК, щойно зв'язок повернувся.
const LS_STATE = "mortar.state.v1";
const LS_DIRTY = "mortar.state.dirty";
const RETRY_MS = 10000;

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // сховище недоступне або повне — працюємо лише з мережею
  }
}

// Дельта-синхронізація: на ПК шлемо лише терени, що змінились відносно останнього відомого серверу стану.
const sentTerrains = new Map<string, string>();
function terrainsOf(data: unknown): Record<string, unknown> | null {
  const d = (data as { data?: unknown } | null)?.data;
  return d && typeof d === "object" ? (d as Record<string, unknown>) : null;
}
function rememberTerrains(data: unknown): void {
  rememberEntities(data);
  const terrains = terrainsOf(data);
  if (!terrains) return;
  sentTerrains.clear();
  for (const [id, v] of Object.entries(terrains)) sentTerrains.set(id, JSON.stringify(v));
}

// Лічильник змін, що чекають відправки: порівнюємо мітки/журнал/видалення з останнім відомим станом ПК.
const serverEntities = new Map<string, string>();
function entitiesOf(data: unknown): Map<string, string> {
  const out = new Map<string, string>();
  const terrains = terrainsOf(data);
  if (!terrains) return out;
  for (const [tid, raw] of Object.entries(terrains)) {
    const t = raw as { markers?: { id: string }[]; fireLog?: { id: string }[]; deleted?: Record<string, number> };
    for (const m of t.markers ?? []) out.set(`${tid}:m:${m.id}`, JSON.stringify(m));
    for (const l of t.fireLog ?? []) out.set(`${tid}:l:${l.id}`, JSON.stringify(l));
    for (const [id, u] of Object.entries(t.deleted ?? {})) out.set(`${tid}:d:${id}`, String(u));
  }
  return out;
}
function rememberEntities(data: unknown): void {
  serverEntities.clear();
  for (const [k, v] of entitiesOf(data)) serverEntities.set(k, v);
}
function pendingCount(data: unknown): number {
  const cur = entitiesOf(data);
  let n = 0;
  for (const [k, v] of cur) if (serverEntities.get(k) !== v) n++;
  for (const k of serverEntities.keys()) if (!cur.has(k)) n++;
  return n;
}
function reportPending(n: number): void {
  window.dispatchEvent(new CustomEvent("mortar:pending", { detail: { count: n } }));
}

let online = true;
let retryTimer: ReturnType<typeof setInterval> | undefined;
const changedCallbacks = new Set<() => void>();
let probe: (() => Promise<boolean>) | null = null;

function setOnline(next: boolean): void {
  if (next === online) return;
  online = next;
  window.dispatchEvent(new CustomEvent("mortar:connectivity", { detail: { online } }));
  if (!online) {
    if (!retryTimer) {
      retryTimer = setInterval(() => {
        void probe?.().then((ok) => {
          if (!ok) return;
          setOnline(true);
        });
      }, RETRY_MS);
    }
    return;
  }
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = undefined;
  }
  // Зв'язок повернувся: є незбережені зміни — відправити (злиття на ПК), інакше перечитати стан ПК.
  if (lsGet(LS_DIRTY) === "1") window.dispatchEvent(new CustomEvent("mortar:flush"));
  else for (const cb of changedCallbacks) cb();
}

/** true — застосунок зараз працює без зв'язку з ПК. */
export function isOffline(): boolean {
  return !online;
}

function createWebApi(): MortarApi {
  let lastRev = 0;
  probe = async () => {
    try {
      const res = await fetch("/api/store", { cache: "no-store" });
      return res.ok || res.status === 404;
    } catch {
      return false;
    }
  };

  const noImport = (): never => {
    throw new Error("Імпорт карт доступний лише в застосунку на ПК");
  };

  return {
    remote: true,
    store: {
      async load() {
        try {
          const res = await fetch("/api/store");
          lastRev = Number(res.headers.get("x-rev")) || lastRev;
          if (res.status === 404) {
            setOnline(true);
            return null;
          }
          if (!res.ok) throw new Error(`Не вдалося завантажити стан: ${res.status}`);
          const data = (await res.json()) as unknown;
          rememberTerrains(data);
          lsSet(LS_STATE, JSON.stringify(data));
          setOnline(true);
          return data;
        } catch (err) {
          // ПК недосяжний: беремо копію, збережену на пристрої
          const local = lsGet(LS_STATE);
          if (local) {
            try {
              const data = JSON.parse(local) as unknown;
              setOnline(false);
              return data;
            } catch {
              // пошкоджена копія — віддаємо помилку
            }
          }
          throw err;
        }
      },
      async save(data) {
        lsSet(LS_STATE, JSON.stringify(data));
        lsSet(LS_DIRTY, "1");
        // Повний стан лишається в локальній копії; на ПК йдуть лише змінені терени.
        const terrains = terrainsOf(data);
        const snapshot = new Map<string, string>();
        let body: unknown = data;
        let partial = false;
        if (terrains && sentTerrains.size > 0) {
          const changed: Record<string, unknown> = {};
          for (const [id, v] of Object.entries(terrains)) {
            const str = JSON.stringify(v);
            snapshot.set(id, str);
            if (sentTerrains.get(id) !== str) changed[id] = v;
          }
          body = { ...(data as Record<string, unknown>), data: changed };
          partial = true;
        }
        try {
          const res = await fetch("/api/store", {
            method: "PUT",
            headers: {
              "content-type": "application/json",
              "x-client-id": clientId,
              ...(partial ? { "x-partial": "1" } : {})
            },
            body: JSON.stringify(body)
          });
          if (!res.ok) throw new Error(`Не вдалося зберегти стан: ${res.status}`);
          lastRev = Number(res.headers.get("x-rev")) || lastRev;
          for (const [id, str] of snapshot) sentTerrains.set(id, str);
          if (!partial) rememberTerrains(data);
          else rememberEntities(data);
          lsSet(LS_DIRTY, null);
          reportPending(0);
          // setOnline(true) після скидання прапора: інакше «зв'язок повернувся» знову запустить відправку
          setOnline(true);
          return res.headers.get("x-merged") === "1";
        } catch {
          // Без зв'язку зміни лишаються на пристрої (прапор dirty) і підуть на ПК пізніше.
          setOnline(false);
          reportPending(pendingCount(data));
          return false;
        }
      },
      onChanged(cb) {
        changedCallbacks.add(cb);
        const es = new EventSource(`/api/events?c=${encodeURIComponent(clientId)}`);
        es.onmessage = (e) => {
          const rev = Number((JSON.parse(e.data) as { rev?: number }).rev);
          // Перше повідомлення після (пере)підключення несе актуальну ревізію: якщо ми її не бачили — стан змінився.
          if (Number.isFinite(rev) && rev !== lastRev) {
            lastRev = rev;
            cb();
          }
          // повідомлення прийшло — ПК на зв'язку
          if (!online) setOnline(true);
        };
        return () => {
          changedCallbacks.delete(cb);
          es.close();
        };
      }
    },
    lan: {
      info: async () => ({ enabled: false, port: 0, urls: [], httpsPort: 0, httpsUrls: [], caUrl: null, caConstrained: true, error: null }),
      setEnabled: async () => ({ enabled: false, port: 0, urls: [], httpsPort: 0, httpsUrls: [], caUrl: null, caConstrained: true, error: null }),
      regenerateCa: async () => ({ enabled: false, port: 0, urls: [], httpsPort: 0, httpsUrls: [], caUrl: null, caConstrained: true, error: null }),
      regenerate: async () => ({ enabled: false, port: 0, urls: [], httpsPort: 0, httpsUrls: [], caUrl: null, caConstrained: true, error: null }),
      qr: async () => ""
    },
    dialogs: { pickImageFile: async () => null },
    mapImport: {
      fromFile: noImport,
      downloadAndImport: noImport,
      cancel: async () => undefined,
      remove: async () => undefined,
      onProgress: () => () => undefined
    },
    updater: {
      status: async () => ({ state: "unsupported" }),
      check: async () => ({ state: "unsupported" }),
      install: async () => undefined,
      onStatus: () => () => undefined
    },
    tiles: {
      prefetch: async () => ({ ok: false, done: 0, missing: 0, failed: 0, total: 0 }),
      cancelPrefetch: async () => undefined,
      onPrefetchProgress: () => () => undefined
    },
    storage: { list: async () => [], remove: async () => undefined },
    heights: {
      importFromUrl: noImport,
      async read(terrainId) {
        const res = await fetch(`/api/heights/${encodeURIComponent(terrainId)}`);
        if (!res.ok) return null;
        return new Uint8Array(await res.arrayBuffer());
      }
    },
    versions: { node: "", chrome: "", electron: "" }
  };
}

/** Розпаковує gzip (сітки висот на сайті лежать стиснутими; DecompressionStream є в усіх сучасних браузерах). */
async function gunzip(bytes: ArrayBuffer): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function createStandaloneApi(): MortarApi {
  const base = createWebApi();
  probe = null;
  const heightsCache = new Map<string, Promise<Uint8Array | null>>();
  return {
    ...base,
    store: {
      async load() {
        const raw = lsGet(LS_STATE);
        if (!raw) return null;
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          return null;
        }
      },
      async save(data) {
        try {
          localStorage.setItem(LS_STATE, JSON.stringify(data));
        } catch {
          window.dispatchEvent(new CustomEvent("mortar:storage-error"));
        }
        return false;
      },
      onChanged(cb) {
        // той самий застосунок, відкритий у другій вкладці
        const h = (e: StorageEvent): void => {
          if (e.key === LS_STATE) cb();
        };
        window.addEventListener("storage", h);
        return () => window.removeEventListener("storage", h);
      }
    },
    heights: {
      importFromUrl: base.heights.importFromUrl,
      read(terrainId) {
        let p = heightsCache.get(terrainId);
        if (!p) {
          p = (async () => {
            try {
              const res = await fetch(webHeightsPath(terrainId));
              if (!res.ok) return null;
              return await gunzip(await res.arrayBuffer());
            } catch {
              return null;
            }
          })();
          heightsCache.set(terrainId, p);
        }
        return p;
      }
    }
  };
}

if (typeof (window as { api?: unknown }).api === "undefined") window.api = isStandalone ? createStandaloneApi() : createWebApi();

export const isRemote: boolean = window.api.remote;

if (isRemote) {
  document.documentElement.classList.add("remote");
  markShortViewport();
  // Офлайн-режим: service worker (лише у збірці й лише в безпечному контексті — HTTPS або localhost).
  if ("serviceWorker" in navigator && window.isSecureContext && import.meta.env.PROD && !isNativeApp) {
    // відносний шлях: сайт може лежати на підшляху (GitHub Pages), service worker береться з тієї ж папки
    void navigator.serviceWorker.register(`sw.js?v=${__APP_VERSION__}`).catch(() => undefined);
    void navigator.storage?.persist?.().catch(() => undefined);
  }
  window.addEventListener("online", () => void probe?.().then((ok) => ok && setOnline(true)));
}

/**
 * iOS, режим «На екран Додому» з прозорим статус-баром: вікно сторінки на висоту статус-бару коротше
 * за екран (innerHeight 797 при screen 844), а нижня смуга лежить поза вікном — сторінка в неї не
 * малює. Тоді відступ під домашню смугу вже "всередині" смуги, тож CSS не має додавати його ще раз
 * (клас ios-short), а панель знизу зафарбована кольором фону, щоб зливатися зі смугою.
 */
function markShortViewport(): void {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone !== true) return;
  const check = (): void => {
    const portrait = window.innerHeight >= window.innerWidth;
    const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    document.documentElement.classList.toggle("ios-short", full - window.innerHeight > 20);
  };
  check();
  window.addEventListener("resize", check);
  window.addEventListener("orientationchange", () => setTimeout(check, 250));
}

/** URL тайла онлайн-карти: у Electron — кастомний протокол, у браузері телефона — LAN-сервер. */
export function onlineTileSrc(terrainId: string, lod: number, x: number, y: number): string {
  if (isStandalone) {
    // грубі рівні — зі свого сайту (кешуються офлайн), глибші — напряму з reforger.recoil.org
    // свій сайт: дзеркальні, а в PWA ще й деталізовані (кешуються офлайн); решта — напряму з reforger.recoil.org
    const own = siteTilePath(terrainId, lod, x, y, isNativeApp);
    if (own) return own;
    const base = findPreset(terrainId)?.tiles?.base;
    if (base) return tileUrl(base, lod, x, y);
  }
  return isRemote ? `/tile/${terrainId}/${lod}/${x}/${y}` : `tile://${terrainId}/${lod}/${x}/${y}`;
}

/** URL тайла імпортованої піраміди ({z}/{row}/{col}). */
export function pyramidTileSrc(terrainId: string, z: number, row: number, col: number): string {
  if (isStandalone && webModMap(terrainId)) return modMapTilePath(terrainId, z, row, col);
  return isRemote ? `/localtile/${terrainId}/${z}/${row}/${col}` : `localtile://${terrainId}/${z}/${row}/${col}`;
}
