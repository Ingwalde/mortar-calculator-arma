import {
  fmtM,
  gridRef,
  metersPerPx,
  pxFromWorld,
  worldFromPx,
  type MapGeometry,
  type Vec2
} from "@core/geometry";
import { tileIndexForWorld, tileSpan } from "@core/onlineTiles";
import { PYRAMID_TILE_SIZE, planPyramid, type PyramidPlan } from "@core/tilePyramid";
import { currentMeta, getCurrent, getVisibleMarkers } from "./state";
import { $ } from "./dom";
import { t } from "./i18n";

const cv = $<HTMLCanvasElement>("cv");
const ctx = cv.getContext("2d")!;

let dpr = 1;
let W = 0;
let H = 0;
let needsDraw = false;

/** Віртуальний розмір "зображення" карти в пікселях: 1:1 з метрами для порожньої сітки й
 * онлайн-тайлів, або справжній розмір імпортованої піраміди (уже обрізаної під world-аспект). */
let imgW = 12800;
let imgH = 12800;
let pyramidPlan: PyramidPlan | null = null;

export const view = { k: 1, ox: 0, oy: 0 };

function css(v: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
}

function geometry(): MapGeometry {
  const S = getCurrent();
  const meta = currentMeta();
  return { calib: S.calib, imgW, imgH, mapSize: meta.sizeX, mapSizeZ: meta.sizeZ };
}

export function syncImageSize(): void {
  const S = getCurrent();
  const meta = currentMeta();
  if (S.map?.kind === "pyramid") {
    imgW = S.map.width;
    imgH = S.map.height;
    pyramidPlan = planPyramid(imgW, imgH);
  } else {
    imgW = meta.sizeX;
    imgH = meta.sizeZ;
    pyramidPlan = null;
  }
}

/** Онлайн-тайли — типове джерело для теренів, що їх мають, доки користувач не імпортував
 * власне зображення (map.kind==="pyramid"). map===null (ще не вирішено) чи {kind:"none"}
 * (явно прибрав карту) рівнозначні тут — обидва означають "нема свого імпорту". */
function usesOnlineTiles(): boolean {
  const S = getCurrent();
  return S.map?.kind !== "pyramid" && !!currentMeta().preset?.tiles;
}

function scrFromPx(px: number, py: number) {
  return { sx: px * view.k + view.ox, sy: py * view.k + view.oy };
}
function pxFromScr(sx: number, sy: number) {
  return { px: (sx - view.ox) / view.k, py: (sy - view.oy) / view.k };
}
export function worldFromScr(sx: number, sy: number): Vec2 {
  const p = pxFromScr(sx, sy);
  return worldFromPx(geometry(), p.px, p.py);
}
export function scrFromWorld(x: number, z: number) {
  const p = pxFromWorld(geometry(), x, z);
  return scrFromPx(p.px, p.py);
}
export function centerWorld(): Vec2 {
  return worldFromScr(W / 2, H / 2);
}

function kLimits() {
  const fitK = Math.min(W / imgW, H / imgH);
  return { min: fitK * 0.5, max: Math.max(fitK * 2, 60 * metersPerPx(geometry())) };
}

export function fit(): void {
  if (!W) return;
  view.k = Math.min(W / imgW, H / imgH) * 0.96;
  view.ox = (W - imgW * view.k) / 2;
  view.oy = (H - imgH * view.k) / 2;
  requestDraw();
}

export function zoomAt(factor: number, sx: number, sy: number): void {
  const l = kLimits();
  const nk = Math.min(l.max, Math.max(l.min, view.k * factor));
  const p = pxFromScr(sx, sy);
  view.k = nk;
  view.ox = sx - p.px * nk;
  view.oy = sy - p.py * nk;
  requestDraw();
}

export function centerOnWorld(x: number, z: number): void {
  const p = pxFromWorld(geometry(), x, z);
  view.ox = W / 2 - p.px * view.k;
  view.oy = H / 2 - p.py * view.k;
  requestDraw();
}

function resize(): void {
  const r = cv.getBoundingClientRect();
  dpr = window.devicePixelRatio || 1;
  const first = W === 0;
  W = r.width;
  H = r.height;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  if (first) fit();
  requestDraw();
}
new ResizeObserver(resize).observe($("mapWrap"));
// ResizeObserver's initial callback can be delayed (or, observed in practice, simply not
// fire) right after a dev-mode full page reload — розмір канви лишається дефолтним 300x150.
// Явний виклик одразу й ще раз у наступному кадрі — надійний запобіжник, не залежний від цього.
resize();
requestAnimationFrame(resize);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", requestDraw);

export function requestDraw(): void {
  if (!needsDraw) {
    needsDraw = true;
    requestAnimationFrame(draw);
  }
}

// ---------- tile image cache ----------
interface CacheEntry {
  img?: HTMLImageElement;
  failedAt?: number;
}
/** Невдалий тайл (мережевий збій, перерваний запит під час HMR тощо) не блокується назавжди —
 * через цей інтервал наступний draw() пробує завантажити його ще раз. */
const TILE_RETRY_MS = 4000;
const tileCache = new Map<string, CacheEntry>();
function loadTile(url: string, fetchIt = true): HTMLImageElement | null {
  let e = tileCache.get(url);
  if (e) {
    if (e.failedAt !== undefined) {
      if (Date.now() - e.failedAt < TILE_RETRY_MS) return null;
      tileCache.delete(url);
      e = undefined;
    } else {
      return e.img ?? null;
    }
  }
  if (!fetchIt) return null;
  e = {};
  tileCache.set(url, e);
  const im = new Image();
  im.decoding = "async";
  im.onload = () => {
    e!.img = im;
    requestDraw();
  };
  im.onerror = () => {
    e!.failedAt = Date.now();
    setTimeout(requestDraw, TILE_RETRY_MS + 50);
  };
  im.src = url;
  if (tileCache.size > 800) {
    for (const k of tileCache.keys()) {
      if (tileCache.size <= 600) break;
      tileCache.delete(k);
    }
  }
  return null;
}

function drawOnlineTiles(): void {
  const maxLod = currentMeta().preset!.tiles!.maxLod;
  const pxPerM = Math.abs(scrFromWorld(100, 0).sx - scrFromWorld(0, 0).sx) / 100;
  let lod = Math.floor(Math.log2(256 / (tileSpan(0) * pxPerM * Math.min(dpr, 2))));
  lod = Math.max(0, Math.min(maxLod, lod));
  // грубий огляд усієї карти одразу (мало тайлів, дешево), тоді проміжний рівень з кешу
  // (без запиту), і нарешті цільова деталізація зверху — так само, як у прототипі.
  drawOnlineLod(maxLod, true);
  if (lod + 1 < maxLod) drawOnlineLod(lod + 1, false);
  if (lod < maxLod) drawOnlineLod(lod, true);
}

function drawOnlineLod(lod: number, fetchIt: boolean): void {
  const meta = currentMeta();
  const span = tileSpan(lod);
  const w0 = worldFromScr(0, 0);
  const w1 = worldFromScr(W, H);
  const min = tileIndexForWorld(Math.min(w0.x, w1.x), Math.min(w0.z, w1.z), lod);
  const max = tileIndexForWorld(Math.max(w0.x, w1.x), Math.max(w0.z, w1.z), lod);
  const tx0 = Math.max(0, min.x);
  const tx1 = Math.min(Math.ceil(meta.sizeX / span), max.x);
  const ty0 = Math.max(0, min.y);
  const ty1 = Math.min(Math.ceil(meta.sizeZ / span), max.y);
  if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 400) return;
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      const url = `tile://${meta.id}/${lod}/${tx}/${ty}`;
      const im = loadTile(url, fetchIt);
      if (!im) continue;
      const a = scrFromWorld(tx * span - 50, (ty + 1) * span - 50);
      const b = scrFromWorld((tx + 1) * span - 50, ty * span - 50);
      ctx.drawImage(im, a.sx, a.sy, b.sx - a.sx + 0.6, b.sy - a.sy + 0.6);
    }
  }
}

function pickPyramidLevel(plan: PyramidPlan): number {
  const need = imgW * view.k * dpr * 0.85;
  for (const l of plan.levels) if (l.width >= need) return l.z;
  return plan.maxLevel;
}

function drawPyramidLevel(z: number, fetchIt: boolean): boolean {
  if (!pyramidPlan) return false;
  const level = pyramidPlan.levels[z];
  const fx = imgW / level.width;
  const fy = imgH / level.height;
  const meta = currentMeta();
  let all = true;
  for (let row = 0; row < level.rows; row++) {
    for (let col = 0; col < level.cols; col++) {
      const x0 = col * PYRAMID_TILE_SIZE * fx;
      const y0 = row * PYRAMID_TILE_SIZE * fy;
      const a = scrFromPx(x0, y0);
      const w = PYRAMID_TILE_SIZE * fx * view.k;
      const h = PYRAMID_TILE_SIZE * fy * view.k;
      if (a.sx > W || a.sy > H || a.sx + w < 0 || a.sy + h < 0) continue;
      // sharp().tile({layout:"google"}) записує файли як {z}/{рядок}/{колонка}.jpg — не
      // {z}/{колонка}/{рядок}, як інтуїтивно очікувалось. Для квадратних зображень (rows===cols)
      // різниці не видно, тому бага не проявлялась на Everon/Kolguyev — лише на непрямокутних.
      const url = `localtile://${meta.id}/${z}/${row}/${col}`;
      const im = loadTile(url, fetchIt);
      if (im) ctx.drawImage(im, a.sx, a.sy, w + 0.6, h + 0.6);
      else all = false;
    }
  }
  return all;
}

function drawPyramid(): void {
  if (!pyramidPlan) return;
  const z = pickPyramidLevel(pyramidPlan);
  // грубий рівень 0 одразу як підклад, тоді ціль зверху — щоб не блимало порожнечею,
  // поки вантажаться тайли потрібної деталізації.
  drawPyramidLevel(0, true);
  if (z >= 2) drawPyramidLevel(z - 1, false);
  if (z > 0) drawPyramidLevel(z, true);
}

// ---------- main draw ----------
export interface DrawCallbacks {
  selectedId: string | null;
  firePair: () => { m: { x: number; z: number }; t: { x: number; z: number } } | null;
}
let callbacks: DrawCallbacks = { selectedId: null, firePair: () => null };
export function setDrawCallbacks(cb: Partial<DrawCallbacks>): void {
  callbacks = { ...callbacks, ...cb };
}

function draw(): void {
  needsDraw = false;
  if (!W) return;
  const c = {
    grid: css("--grid"),
    fine: css("--gridfine"),
    blank: css("--mapblank"),
    ink: css("--ink"),
    surface: css("--raised"),
    mortar: css("--mortar"),
    target: css("--target"),
    point: css("--point")
  };
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = c.blank;
  ctx.fillRect(0, 0, W, H);

  const S = getCurrent();
  if (S.map?.kind === "pyramid") drawPyramid();
  else if (usesOnlineTiles()) drawOnlineTiles();

  drawGrid(c);
  drawFiringLine(c);
  drawCalibPoints(c);
  drawPlaces(c);
  drawMarkers(c);
  updateReadout();
}

function drawGrid(c: Record<string, string>): void {
  const g = geometry();
  const mpp = metersPerPx(g) / view.k;
  const w0 = worldFromScr(0, 0);
  const w1 = worldFromScr(W, H);
  const meta = currentMeta();
  const x0 = Math.max(Math.min(w0.x, w1.x), 0);
  const x1 = Math.min(Math.max(w0.x, w1.x), meta.sizeX);
  const z0 = Math.max(Math.min(w0.z, w1.z), 0);
  const z1 = Math.min(Math.max(w0.z, w1.z), meta.sizeZ);

  const tl = scrFromPx(0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(tl.sx, tl.sy, imgW * view.k, imgH * view.k);
  ctx.clip();
  const steps = [10, 100, 1000];
  let labelStep = 1000;
  for (const st of steps) {
    const spx = st / mpp;
    if (spx < 14) continue;
    if (spx >= 56 && st < labelStep) labelStep = st;
    ctx.strokeStyle = st === 1000 ? c.grid : c.fine;
    ctx.lineWidth = st === 1000 ? 1.2 : 1;
    ctx.beginPath();
    const n = (x1 - x0) / st + (z1 - z0) / st;
    if (n > 400) continue;
    for (let x = Math.ceil(x0 / st) * st; x <= x1; x += st) {
      if (st < 1000 && x % (st * 10) === 0) continue;
      const s = scrFromWorld(x, z0).sx;
      ctx.moveTo(Math.round(s) + 0.5, 0);
      ctx.lineTo(Math.round(s) + 0.5, H);
    }
    for (let z = Math.ceil(z0 / st) * st; z <= z1; z += st) {
      if (st < 1000 && z % (st * 10) === 0) continue;
      const s = scrFromWorld(x0, z).sy;
      ctx.moveTo(0, Math.round(s) + 0.5);
      ctx.lineTo(W, Math.round(s) + 0.5);
    }
    ctx.stroke();
  }
  ctx.restore();

  ctx.font = '600 11px "IBM Plex Sans Condensed",sans-serif';
  ctx.fillStyle = c.ink;
  ctx.textBaseline = "top";
  const lw = labelStep === 1000 ? 2 : labelStep === 100 ? 3 : 4;
  const div = labelStep === 1000 ? 1000 : labelStep === 100 ? 100 : 10;
  if ((x1 - x0) / labelStep < 60) {
    for (let x = Math.ceil(x0 / labelStep) * labelStep; x <= x1; x += labelStep) {
      const s = scrFromWorld(x, z0).sx;
      labelBox(pad(Math.round(x / div), lw), s + 3, 3, c);
    }
    for (let z = Math.ceil(z0 / labelStep) * labelStep; z <= z1; z += labelStep) {
      const s = scrFromWorld(x0, z).sy;
      labelBox(pad(Math.round(z / div), lw), 3, s - 15, c);
    }
  }
}
function pad(n: number, w: number): string {
  let s = String(Math.abs(n));
  while (s.length < w) s = "0" + s;
  return (n < 0 ? "-" : "") + s;
}
function labelBox(t: string, x: number, y: number, c: Record<string, string>): void {
  const w = ctx.measureText(t).width;
  ctx.fillStyle = c.surface;
  ctx.globalAlpha = 0.8;
  ctx.fillRect(x - 2, y - 1, w + 4, 14);
  ctx.globalAlpha = 1;
  ctx.fillStyle = c.ink;
  ctx.fillText(t, x, y);
}

function drawFiringLine(c: Record<string, string>): void {
  const pair = callbacks.firePair();
  if (!pair) return;
  const a = scrFromWorld(pair.m.x, pair.m.z);
  const b = scrFromWorld(pair.t.x, pair.t.z);
  ctx.setLineDash([7, 5]);
  ctx.strokeStyle = c.target;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(b.sx, b.sy);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawCalibPoints(c: Record<string, string>): void {
  const S = getCurrent();
  if (S.calib.mode !== "points") return;
  for (const key of ["a", "b"] as const) {
    const p = S.calib[key];
    if (!p) continue;
    const s = scrFromPx(p.px, p.py);
    ctx.strokeStyle = c.point;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.sx, s.sy, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = c.point;
    ctx.font = '700 12px "IBM Plex Sans Condensed",sans-serif';
    ctx.fillText(key.toUpperCase(), s.sx + 11, s.sy - 6);
  }
}

function drawPlaces(c: Record<string, string>): void {
  const preset = currentMeta().preset;
  if (!getShowPlaces() || !preset?.places) return;
  ctx.font = '500 11px "IBM Plex Sans Condensed",sans-serif';
  ctx.textBaseline = "middle";
  for (const p of preset.places) {
    const s = scrFromWorld(p.x, p.z);
    if (s.sx < -80 || s.sy < -20 || s.sx > W + 20 || s.sy > H + 20) continue;
    ctx.fillStyle = c.ink;
    ctx.beginPath();
    ctx.arc(s.sx, s.sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    const tw = ctx.measureText(p.name).width;
    ctx.fillStyle = c.surface;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(s.sx + 4, s.sy - 7, tw + 6, 14);
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.ink;
    ctx.fillText(p.name, s.sx + 7, s.sy);
  }
}

let showPlaces = true;
export function setShowPlaces(v: boolean): void {
  showPlaces = v;
}
function getShowPlaces(): boolean {
  return showPlaces;
}

function typeLabel(type: string): string {
  return ({ mortar: t("typeMortar"), target: t("typeTarget"), point: t("typePoint") } as Record<string, string>)[type];
}

function drawMarkers(c: Record<string, string>): void {
  for (const m of getVisibleMarkers()) {
    const s = scrFromWorld(m.x, m.z);
    if (s.sx < -40 || s.sy < -40 || s.sx > W + 40 || s.sy > H + 40) continue;
    const col = (c as Record<string, string>)[m.type] || c.point;
    const r = m.id === callbacks.selectedId ? 9 : 7;
    ctx.fillStyle = col;
    ctx.strokeStyle = c.surface;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (m.type === "target") {
      ctx.moveTo(s.sx, s.sy - r - 2);
      ctx.lineTo(s.sx + r + 2, s.sy);
      ctx.lineTo(s.sx, s.sy + r + 2);
      ctx.lineTo(s.sx - r - 2, s.sy);
      ctx.closePath();
    } else if (m.type === "mortar") {
      ctx.arc(s.sx, s.sy, r, 0, Math.PI * 2);
    } else {
      ctx.rect(s.sx - r + 1, s.sy - r + 1, (r - 1) * 2, (r - 1) * 2);
    }
    ctx.fill();
    ctx.stroke();
    if (m.id === callbacks.selectedId) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.sx, s.sy, r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = '600 13px "IBM Plex Sans Condensed",sans-serif';
    ctx.textBaseline = "middle";
    const label = m.name || typeLabel(m.type);
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = c.surface;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(s.sx + r + 5, s.sy - 9, tw + 8, 18);
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.ink;
    ctx.fillText(label, s.sx + r + 9, s.sy);
  }
}

function updateReadout(): void {
  const w = centerWorld();
  $("coords").querySelector(".grid")!.textContent = gridRef(w.x, w.z);
  const u = t("unitM");
  $("coords").querySelector(".m")!.textContent = "X " + fmtM(w.x) + " " + u + "   Z " + fmtM(w.z) + " " + u;
}

// ---------- gestures ----------
export interface TapHandlers {
  onMarkerTap: (id: string) => void;
}

export function centerPx(): { px: number; py: number } {
  return pxFromScr(W / 2, H / 2);
}
let tapHandlers: TapHandlers | null = null;
export function setTapHandlers(h: TapHandlers): void {
  tapHandlers = h;
}
export function hitTestMarker(sx: number, sy: number): string | null {
  let best: string | null = null;
  let bd = 22;
  for (const m of getVisibleMarkers()) {
    const s = scrFromWorld(m.x, m.z);
    const d = Math.hypot(s.sx - sx, s.sy - sy);
    if (d < bd) {
      bd = d;
      best = m.id;
    }
  }
  return best;
}

const ptrs = new Map<number, { x: number; y: number }>();
type Gesture =
  | { type: "pan"; start: { x: number; y: number }; last: { x: number; y: number }; t: number; moved: boolean }
  | { type: "pinch"; d: number; mid: { x: number; y: number } };
let gesture: Gesture | null = null;

function pos(e: PointerEvent) {
  const r = cv.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

cv.addEventListener("pointerdown", (e) => {
  cv.setPointerCapture(e.pointerId);
  const p = pos(e);
  ptrs.set(e.pointerId, p);
  if (ptrs.size === 1) gesture = { type: "pan", start: p, last: p, t: Date.now(), moved: false };
  else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    gesture = { type: "pinch", d: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }
});
cv.addEventListener("pointermove", (e) => {
  if (!ptrs.has(e.pointerId) || !gesture) return;
  const p = pos(e);
  ptrs.set(e.pointerId, p);
  if (gesture.type === "pan" && ptrs.size === 1) {
    view.ox += p.x - gesture.last.x;
    view.oy += p.y - gesture.last.y;
    gesture.last = p;
    if (Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) > 6) gesture.moved = true;
    requestDraw();
  } else if (gesture.type === "pinch" && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    view.ox += mid.x - gesture.mid.x;
    view.oy += mid.y - gesture.mid.y;
    zoomAt(d / gesture.d, mid.x, mid.y);
    gesture.d = d;
    gesture.mid = mid;
  }
});
function endPtr(e: PointerEvent): void {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (gesture && gesture.type === "pan" && !gesture.moved && Date.now() - gesture.t < 500 && e.type === "pointerup") {
    tap(gesture.start.x, gesture.start.y);
  }
  if (ptrs.size === 1) {
    const p = [...ptrs.values()][0];
    gesture = { type: "pan", start: p, last: p, t: 0, moved: true };
  } else if (ptrs.size === 0) gesture = null;
}
cv.addEventListener("pointerup", endPtr);
cv.addEventListener("pointercancel", endPtr);
cv.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  },
  { passive: false }
);

function tap(x: number, y: number): void {
  const id = hitTestMarker(x, y);
  if (id) {
    tapHandlers?.onMarkerTap(id);
    return;
  }
  const w = worldFromScr(x, y);
  centerOnWorld(w.x, w.z);
}

$<HTMLButtonElement>("zin").onclick = () => zoomAt(1.6, W / 2, H / 2);
$<HTMLButtonElement>("zout").onclick = () => zoomAt(1 / 1.6, W / 2, H / 2);
$<HTMLButtonElement>("fit").onclick = () => fit();

export function resetView(): void {
  syncImageSize();
  fit();
}
