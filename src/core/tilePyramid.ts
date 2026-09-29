/**
 * Геометрія локальної піраміди тайлів, яку будує sharp().tile({layout:"google", size:256})
 * у src/main/tiles/import.ts. Рівень z=0 — один тайл на все зображення (найгрубший),
 * z=maxLevel — повна роздільність (найдетальніший) — стандартна схема Google/XYZ.
 * Усе тут виводиться лише з width/height обрізаного зображення, без окремого файлу-маніфесту.
 */
export const PYRAMID_TILE_SIZE = 256;

export interface PyramidLevel {
  z: number;
  /** Розмір зображення на цьому рівні (до якого воно масштабоване перед нарізкою). */
  width: number;
  height: number;
  cols: number;
  rows: number;
}

export interface PyramidPlan {
  maxLevel: number;
  levels: PyramidLevel[];
  totalTiles: number;
}

export function planPyramid(width: number, height: number, tileSize = PYRAMID_TILE_SIZE): PyramidPlan {
  const maxDim = Math.max(width, height);
  const maxLevel = Math.max(0, Math.ceil(Math.log2(maxDim / tileSize)));
  const levels: PyramidLevel[] = [];
  let totalTiles = 0;
  for (let z = 0; z <= maxLevel; z++) {
    const scale = Math.pow(2, z - maxLevel);
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const cols = Math.ceil(w / tileSize);
    const rows = Math.ceil(h / tileSize);
    levels.push({ z, width: w, height: h, cols, rows });
    totalTiles += cols * rows;
  }
  return { maxLevel, levels, totalTiles };
}

/** Найдетальніший рівень (z=maxLevel), яким рендерер має користуватись при повному наближенні. */
export function finestLevel(plan: PyramidPlan): PyramidLevel {
  return plan.levels[plan.levels.length - 1];
}

/** Шлях тайла відносно кореня піраміди терену: {z}/{x}/{y}.jpg (як пише sharp, layout "google"). */
export function pyramidTilePath(z: number, x: number, y: number): string {
  return `${z}/${x}/${y}.jpg`;
}
