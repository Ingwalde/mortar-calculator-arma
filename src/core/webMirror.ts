/**
 * Автономна веб-версія (PWA на GitHub Pages) віддає частину онлайн-тайлів зі свого сайту: там вони
 * кешуються service worker-ом і працюють без інтернету (reforger.recoil.org не дає CORS, надійно
 * кешувати з нього неможливо). Решта — глибші рівні — вантажиться напряму з reforger.recoil.org.
 * Сюди ж звертається скрипт збірки (scripts/build-web-assets.mjs).
 */

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
