/**
 * Геометрія карти й координат — перенесено 1:1 з прототипу
 * (Планшет-мінометника.html, розділ "geometry"), без DOM і глобального стану.
 */

export interface CalibPoint {
  px: number;
  py: number;
  x: number;
  z: number;
}

export interface Calib {
  mode: "size" | "points";
  size: number;
  sizeZ: number;
  a: CalibPoint | null;
  b: CalibPoint | null;
}

export interface MapGeometry {
  calib: Calib;
  /** Розмір поточного зображення карти в пікселях (для порожньої сітки — дорівнює mapSize/mapSizeZ). */
  imgW: number;
  imgH: number;
  /** Розмір терену в метрах, які має покривати зображення від (0,0). */
  mapSize: number;
  mapSizeZ: number;
}

export interface Vec2 {
  x: number;
  z: number;
}

export interface Px2 {
  px: number;
  py: number;
}

/** Чи прив'язка "дві точки" зараз коректно задана (обидві точки далеко одна від одної по обох осях). */
export function ptsOK(g: MapGeometry): boolean {
  const c = g.calib;
  return (
    c.mode === "points" &&
    !!c.a &&
    !!c.b &&
    isFinite(c.a.x) &&
    isFinite(c.a.z) &&
    isFinite(c.b.x) &&
    isFinite(c.b.z) &&
    Math.abs(c.b.px - c.a.px) > 5 &&
    Math.abs(c.b.py - c.a.py) > 5 &&
    c.b.x !== c.a.x &&
    c.b.z !== c.a.z
  );
}

/**
 * Реальний прямокутник зображення (в пікселях), що відповідає терену від (0,0) до (mapSize, mapSizeZ).
 * Якщо зображення квадратно доповнене (auto_crop_padding у generate_tiles.py прив'язує обрізку
 * до верхнього лівого кута (0,0)), рахуємо менший регіон від того ж кута.
 */
export function region(g: MapGeometry): { w: number; h: number } {
  const ia = g.imgW / g.imgH;
  const ma = g.mapSize / g.mapSizeZ;
  if (Math.abs(ia / ma - 1) < 0.03) return { w: g.imgW, h: g.imgH };
  if (Math.abs(ia - 1) < 0.03) {
    return ma > 1 ? { w: g.imgW, h: g.imgW / ma } : { w: g.imgH * ma, h: g.imgH };
  }
  return { w: g.imgW, h: g.imgH };
}

export function worldFromPx(g: MapGeometry, px: number, py: number): Vec2 {
  if (ptsOK(g)) {
    const c = g.calib as { a: CalibPoint; b: CalibPoint };
    const sx = (c.b.x - c.a.x) / (c.b.px - c.a.px);
    const sz = (c.b.z - c.a.z) / (c.b.py - c.a.py);
    return { x: c.a.x + (px - c.a.px) * sx, z: c.a.z + (py - c.a.py) * sz };
  }
  const r = region(g);
  return { x: (px / r.w) * g.mapSize, z: (1 - py / r.h) * g.mapSizeZ };
}

export function pxFromWorld(g: MapGeometry, x: number, z: number): Px2 {
  if (ptsOK(g)) {
    const c = g.calib as { a: CalibPoint; b: CalibPoint };
    const sx = (c.b.x - c.a.x) / (c.b.px - c.a.px);
    const sz = (c.b.z - c.a.z) / (c.b.py - c.a.py);
    return { px: c.a.px + (x - c.a.x) / sx, py: c.a.py + (z - c.a.z) / sz };
  }
  const r = region(g);
  return { px: (x / g.mapSize) * r.w, py: (1 - z / g.mapSizeZ) * r.h };
}

export function metersPerPx(g: MapGeometry): number {
  const a = worldFromPx(g, 0, 0);
  const b = worldFromPx(g, 100, 0);
  return Math.abs(b.x - a.x) / 100 || 1;
}

export function pad(n: number, width: number): string {
  const neg = n < 0;
  let s = String(Math.abs(n));
  while (s.length < width) s = "0" + s;
  return (neg ? "-" : "") + s;
}

/** "0483 1172" — сітка 4+4 цифри (10 м). */
export function gridRef(x: number, z: number): string {
  return pad(Math.floor(x / 10 + 1e-6), 4) + " " + pad(Math.floor(z / 10 + 1e-6), 4);
}

export function fmtM(v: number): string {
  return Math.round(v)
    .toLocaleString("uk-UA")
    .replace(/ /g, " ");
}

export interface ParsedGrid {
  x: number;
  z: number;
  /** Розмір комірки сітки в метрах (10^(5-n), n — кількість цифр на вісь). */
  res: number;
}

/** Розбір сітки виду "0483 1172" (2–5 цифр на вісь; координата — центр комірки). */
export function parseGrid(t: string): ParsedGrid | null {
  const m = String(t)
    .trim()
    .match(/^(\d{2,5})[\s,;/-]+(\d{2,5})$/);
  if (!m || m[1].length !== m[2].length) return null;
  const n = m[1].length;
  const res = Math.pow(10, 5 - n);
  return { x: +m[1] * res + res / 2, z: +m[2] * res + res / 2, res };
}
