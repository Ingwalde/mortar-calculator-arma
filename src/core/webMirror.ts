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
  return Object.hasOwn(WEB_MOD_MAPS, terrainId) ? WEB_MOD_MAPS[terrainId] : null;
}

/** Найдетальніший дзеркалений LOD терену або undefined. Лише власні ключі: "__proto__" тощо не проходять. */
export function webMirrorMinLod(terrainId: string): number | undefined {
  return Object.hasOwn(WEB_MIRROR_MIN_LOD, terrainId) ? WEB_MIRROR_MIN_LOD[terrainId] : undefined;
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

/**
 * Деталізованіші рівні, що лежать лише на сайті (tiles-hd/), але не в Android-застосунку (вони завеликі для пакета).
 * PWA бере їх зі свого сайту (вони кешуються офлайн кнопкою «Зберегти карту»); APK для них, як і раніше, іде на reforger.recoil.org.
 * Значення — найдетальніший LOD, що є на сайті (діапазон [значення; WEB_MIRROR_MIN_LOD - 1]).
 */
export const WEB_DETAIL_MIN_LOD: Readonly<Record<string, number>> = {
  everon: 1,
  kolguyev: 1,
  arland: 0
};

/** Найдетальніший LOD з tiles-hd/ або undefined. Лише власні ключі. */
export function webDetailMinLod(terrainId: string): number | undefined {
  return Object.hasOwn(WEB_DETAIL_MIN_LOD, terrainId) ? WEB_DETAIL_MIN_LOD[terrainId] : undefined;
}

/** Цей LOD є на сайті як «деталізований» (деталізованіший за дзеркальний, не вбудований в APK). */
export function isDetailTile(terrainId: string, lod: number): boolean {
  const d = webDetailMinLod(terrainId);
  const m = webMirrorMinLod(terrainId);
  return d !== undefined && m !== undefined && lod >= d && lod < m;
}

/**
 * Звідки автономна версія бере онлайн-тайл: шлях на власному сайті (дзеркальний, а в PWA ще й деталізований)
 * або null — тоді тайл вантажиться напряму з reforger.recoil.org. `native` — Android-застосунок (tiles-hd у ньому нема).
 */
export function siteTilePath(terrainId: string, lod: number, x: number, y: number, native: boolean): string | null {
  if (isMirroredTile(terrainId, lod)) return mirroredTilePath(terrainId, lod, x, y);
  if (!native && isDetailTile(terrainId, lod)) return detailTilePath(terrainId, lod, x, y);
  return null;
}

/** Відносний шлях деталізованого тайла на сайті. */
export function detailTilePath(terrainId: string, lod: number, x: number, y: number): string {
  return `tiles-hd/${terrainId}/${lod}/${x}/${y}.jpg`;
}

export function isMirroredTile(terrainId: string, lod: number): boolean {
  const min = webMirrorMinLod(terrainId);
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
