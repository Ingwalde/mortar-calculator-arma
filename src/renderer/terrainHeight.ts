/**
 * Висота рельєфу з даних height_data (GeNeFRAG/ArmaReforger) — кеш у пам'яті рендерера й
 * синхронний доступ для малювання/розрахунку. Завантаження асинхронне: до його завершення
 * heightAt() віддає null, а після — повідомляє підписників (щоб UI перерахувався).
 */
import { decodeHeightGrid, sampleHeight, type HeightGrid } from "@core/heightGrid";

const cache = new Map<string, HeightGrid | null>();
const loading = new Map<string, Promise<HeightGrid | null>>();
const listeners = new Set<() => void>();

export function onHeightsLoaded(cb: () => void): void {
  listeners.add(cb);
}

/** Завантажує (один раз) сітку висот терену; null — даних нема. */
export function loadHeightGrid(terrainId: string): Promise<HeightGrid | null> {
  if (cache.has(terrainId)) return Promise.resolve(cache.get(terrainId)!);
  const pending = loading.get(terrainId);
  if (pending) return pending;
  const p = window.api.heights
    .read(terrainId)
    .then((buf) => (buf ? decodeHeightGrid(buf) : null))
    .catch(() => null)
    .then((grid) => {
      cache.set(terrainId, grid);
      loading.delete(terrainId);
      for (const cb of listeners) cb();
      return grid;
    });
  loading.set(terrainId, p);
  return p;
}

/** Скинути кеш терену (після нового імпорту/видалення карти). */
export function forgetHeights(terrainId: string): void {
  cache.delete(terrainId);
  loading.delete(terrainId);
}

/**
 * Висота в метрах або null: даних нема (ще вантажаться), точка поза картою чи на воді
 * (нуль у даних — море, "невідомо" чесніше за нуль).
 */
export function heightAt(terrainId: string, x: number, z: number, sizeX: number, sizeZ: number): number | null {
  const grid = cache.get(terrainId);
  if (!grid) {
    void loadHeightGrid(terrainId);
    return null;
  }
  const h = sampleHeight(grid, x, z, sizeX, sizeZ);
  // 0 і менше — вода (дно моря в модових сітках від'ємне): "невідомо", а не висота
  return h === null || h <= 0 ? null : h;
}
