/**
 * Контури будівель терену для позначки «зруйновано»: дані (src/core/buildings/<id>.ts, з .topo світів і модів)
 * підвантажуються окремим шматком лише тоді, коли в терені є хоча б одна зруйнована мітка.
 */
import { BuildingIndex, decodeBuildingsBase64 } from "@core/buildings";

type Loader = () => Promise<{ default: string }>;

const LOADERS: Record<string, Loader> = {
  everon: () => import("@core/buildings/everon"),
  arland: () => import("@core/buildings/arland"),
  kolguyev: () => import("@core/buildings/kolguyev"),
  badorb: () => import("@core/buildings/badorb"),
  gogland: () => import("@core/buildings/gogland"),
  bystrany: () => import("@core/buildings/bystrany"),
  kirovograd: () => import("@core/buildings/kirovograd"),
  mogadishu: () => import("@core/buildings/mogadishu"),
  novyinovka: () => import("@core/buildings/novyinovka")
};

const cache = new Map<string, BuildingIndex | null>();
const loading = new Set<string>();
let onLoaded: (() => void) | null = null;

/** Викликається, коли дані терену підвантажились (треба перемалювати карту). */
export function setBuildingsLoadedHook(cb: () => void): void {
  onLoaded = cb;
}

/** true, поки дані терену ще вантажаться (не малюємо тимчасовий круг, щоб не блимав). */
export function buildingsLoading(terrainId: string): boolean {
  return loading.has(terrainId);
}

/** Індекс будівель терену; null — даних нема або вони ще вантажаться (після завантаження спрацює хук). */
export function buildingIndexFor(terrainId: string): BuildingIndex | null {
  if (cache.has(terrainId)) return cache.get(terrainId) ?? null;
  const loader = Object.hasOwn(LOADERS, terrainId) ? LOADERS[terrainId] : undefined;
  if (!loader) {
    cache.set(terrainId, null);
    return null;
  }
  if (!loading.has(terrainId)) {
    loading.add(terrainId);
    void loader()
      .then((m) => cache.set(terrainId, new BuildingIndex(decodeBuildingsBase64(m.default))))
      .catch(() => cache.set(terrainId, null))
      .then(() => {
        loading.delete(terrainId);
        onLoaded?.();
      });
  }
  return null;
}
