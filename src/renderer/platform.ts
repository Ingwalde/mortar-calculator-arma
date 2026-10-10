/**
 * Платформа: у вікні Electron `window.api` дає preload; у браузері телефона (сторінку віддає
 * LAN-сервер застосунку на ПК) його немає — тут створюється веб-замінник з тим самим інтерфейсом.
 * Імпортувати цей модуль треба першим (main.ts), до будь-якого використання window.api.
 */
import type { MortarApi } from "../preload/index";

const clientId = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);

function createWebApi(): MortarApi {
  let lastRev = 0;

  const noImport = (): never => {
    throw new Error("Імпорт карт доступний лише в застосунку на ПК");
  };

  return {
    remote: true,
    store: {
      async load() {
        const res = await fetch("/api/store");
        lastRev = Number(res.headers.get("x-rev")) || lastRev;
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`Не вдалося завантажити стан: ${res.status}`);
        return res.json();
      },
      async save(data) {
        const res = await fetch("/api/store", {
          method: "PUT",
          headers: { "content-type": "application/json", "x-client-id": clientId },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`Не вдалося зберегти стан: ${res.status}`);
        lastRev = Number(res.headers.get("x-rev")) || lastRev;
        return res.headers.get("x-merged") === "1";
      },
      onChanged(cb) {
        const es = new EventSource(`/api/events?c=${encodeURIComponent(clientId)}`);
        es.onmessage = (e) => {
          const rev = Number((JSON.parse(e.data) as { rev?: number }).rev);
          // Перше повідомлення після (пере)підключення несе актуальну ревізію: якщо ми її не бачили — стан змінився.
          if (Number.isFinite(rev) && rev !== lastRev) {
            lastRev = rev;
            cb();
          }
        };
        return () => es.close();
      }
    },
    lan: {
      info: async () => ({ enabled: false, port: 0, urls: [], error: null }),
      setEnabled: async () => ({ enabled: false, port: 0, urls: [], error: null }),
      regenerate: async () => ({ enabled: false, port: 0, urls: [], error: null }),
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

if (typeof (window as { api?: unknown }).api === "undefined") window.api = createWebApi();

export const isRemote: boolean = window.api.remote;

if (isRemote) {
  document.documentElement.classList.add("remote");
  markShortViewport();
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
  return isRemote ? `/tile/${terrainId}/${lod}/${x}/${y}` : `tile://${terrainId}/${lod}/${x}/${y}`;
}

/** URL тайла імпортованої піраміди ({z}/{row}/{col}). */
export function pyramidTileSrc(terrainId: string, z: number, row: number, col: number): string {
  return isRemote ? `/localtile/${terrainId}/${z}/${row}/${col}` : `localtile://${terrainId}/${z}/${row}/${col}`;
}
