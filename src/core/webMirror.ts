/**
 * Автономна веб-версія (PWA на GitHub Pages) і Android-застосунок. Онлайн-тайли офіційних карт (Everon, Arland, Kolguyev)
 * вантажаться напряму з їхнього першоджерела й на сайті не копіюються. З власного сайту беруться лише карти модів
 * (вони побудовані на ПК) і сітки висот.
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

/** Відносний шлях тайла піраміди модового терену на сайті. */
export function modMapTilePath(terrainId: string, z: number, row: number, col: number): string {
  return `maps/${terrainId}/${z}/${row}/${col}.webp`;
}

/** Відносний шлях стисненої сітки висот терену на сайті. */
export function webHeightsPath(terrainId: string): string {
  return `heights/${terrainId}.bin.gz`;
}
