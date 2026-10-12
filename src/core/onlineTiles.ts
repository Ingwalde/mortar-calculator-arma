/**
 * Онлайн-тайли reforger.recoil.org: URL {base}{lod}/{x}/{y}/tile.jpg, зсув координат 50 м
 * (edge_to_center_offset, як у EnfusionMapMaker Web/reforger-map.js), LOD 0 покриває
 * SPAN0 = 12.501*256/32 ≈ 100.008 м, кожен наступний LOD — удвічі більший регіон.
 * Формула метрів-на-тайл підтверджена по мережевих запитах реального сайту
 * (поточний шлях "map-tiles/{terrain}/{lod}/{x}/{y}/tile.jpg" — сайт з часів прототипу
 * змінив структуру URL і maxLod для Arland зріс з 4 до 5, див. scripts/extract-terrains.mjs).
 * Розмір самого JPEG-файлу тайла (зараз ~542px) на цю математику не впливає.
 */
export const TILE_PX = 256;
export const EDGE_OFFSET = 50;
/** Метрів на тайл LOD0 (константа з reforger-map.js: scale-фактор 1/12.501, ділене на 32 клітинки тайла). */
export const SPAN0 = (12.501 * TILE_PX) / 32;

export function tileSpan(lod: number): number {
  return SPAN0 * Math.pow(2, lod);
}

export interface TileIndex {
  x: number;
  y: number;
}

/** Індекс тайла на заданому LOD, що містить світову точку (X схід, Z північ). */
export function tileIndexForWorld(x: number, z: number, lod: number): TileIndex {
  const span = tileSpan(lod);
  return {
    x: Math.floor((x + EDGE_OFFSET) / span),
    y: Math.floor((z + EDGE_OFFSET) / span)
  };
}

/** Межі тайла (x,y) на LOD у світових координатах. */
export function tileWorldBounds(tx: number, ty: number, lod: number): { x0: number; x1: number; z0: number; z1: number } {
  const span = tileSpan(lod);
  return {
    x0: tx * span - EDGE_OFFSET,
    x1: (tx + 1) * span - EDGE_OFFSET,
    z0: ty * span - EDGE_OFFSET,
    z1: (ty + 1) * span - EDGE_OFFSET
  };
}

/** Усі тайли терену від найгрубшого LOD (maxLod) до minLod включно — для заздалегідного збереження. */
export function onlineTileList(sizeX: number, sizeZ: number, maxLod: number, minLod: number): { lod: number; x: number; y: number }[] {
  const out: { lod: number; x: number; y: number }[] = [];
  for (let lod = maxLod; lod >= Math.max(0, minLod); lod--) {
    const span = tileSpan(lod);
    const nx = Math.ceil((sizeX + EDGE_OFFSET) / span);
    const ny = Math.ceil((sizeZ + EDGE_OFFSET) / span);
    for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) out.push({ lod, x, y });
  }
  return out;
}

export function tileUrl(base: string, lod: number, tx: number, ty: number): string {
  return `${base}${lod}/${tx}/${ty}/tile.jpg`;
}
