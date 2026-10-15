/**
 * Автономна веб-версія (PWA на GitHub Pages) віддає частину онлайн-тайлів зі свого сайту: там вони
 * кешуються service worker-ом і працюють без інтернету (reforger.recoil.org не дає CORS, надійно
 * кешувати з нього неможливо). Решта — глибші рівні — вантажиться напряму з reforger.recoil.org.
 * Сюди ж звертається скрипт збірки (scripts/build-web-assets.mjs).
 */

import webModMaps from "./web-mod-maps.json";

/**
 * Модові терени не мають онлайн-тайлів: їхні карти — піраміди, які будуються на ПК. Для автономної версії
 * вони пакуються (scripts/make-web-mod-maps.mjs) до рівня, що вкладається в бюджет, і кладуться на сайт
 * (`maps/<id>/<z>/<рядок>/<колонка>.webp`). Тут — розміри такої піраміди (вона може бути меншою за повну).
 */
export const WEB_MOD_MAPS: Readonly<Record<string, { width: number; height: number }>> = webModMaps;

export function webModMap(terrainId: string): { width: number; height: number } | null {
  return WEB_MOD_MAPS[terrainId] ?? null;
}

/** Відносний шлях тайла піраміди модового терену на сайті. */
export function modMapTilePath(terrainId: string, z: number, row: number, col: number): string {
  return `maps/${terrainId}/${z}/${row}/${col}.webp`;
}

/** Найдетальніший дзеркалений LOD терену (менший номер — детальніше): дзеркало містить LOD ≥ цього. */
export const WEB_MIRROR_MIN_LOD: Readonly<Record<string, number>> = {
  everon: 2,
  arland: 1,
  kolguyev: 2
};

export function isMirroredTile(terrainId: string, lod: number): boolean {
  const min = WEB_MIRROR_MIN_LOD[terrainId];
  return min !== undefined && lod >= min;
}

/** Відносний шлях дзеркального тайла на сайті. */
export function mirroredTilePath(terrainId: string, lod: number, x: number, y: number): string {
  return `tiles/${terrainId}/${lod}/${x}/${y}.jpg`;
}

/** Відносний шлях стисненої сітки висот терену на сайті. */
export function webHeightsPath(terrainId: string): string {
  return `heights/${terrainId}.bin.gz`;
}
