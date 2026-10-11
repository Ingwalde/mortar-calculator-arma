// Малює карту терену в стилі внутрішньої карти гри з даних самого мода:
//   • рельєф — тіньове освітлення з сітки висот (resources/heights/<id>.bin), море = висота <= 0;
//   • дороги, будівлі — з .topo мода (секції ROAD, BULD), у векторі, тож чіткі на будь-якому зумі.
// Використання:
//   node scripts/render-topo-map.mjs <id> <мод.topo> <розмір_м> <px_на_метр> <вихід.png> [x0 z0 x1 z1]
// Розкладка .topo: TOPO, далі секції [тег 4][u32 версія][u32 довжина][u32 кінець][u32 0][дані].
//   ROAD: 6 лічильників класів + блоки LOD; запис = [u8 клас][u32 n][n x (f32 x, f32 z)][u32 хвіст][хвіст x u32],
//         кожні 4 точки — чотирикутник смуги дороги (початковий край, кінцевий край).
//   BULD: u32 кількість LOD, u32 кількість будівель; LOD 0 = [u32 n][n x (x,z)] на будівлю.
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const [id, topoPath, sizeArg, ppmArg, outPath, ...bbox] = process.argv.slice(2);
const SIZE = Number(sizeArg);
const PPM = Number(ppmArg);
// HEIGHTS=<файл> і HEIGHT_SCALE=<n>: детальніша сітка висот (значення = метри * n), див. extract-mod-heights.mjs
const heightsPath = process.env.HEIGHTS || new URL(`../resources/heights/${id}.bin`, import.meta.url);
const HEIGHT_SCALE = Number(process.env.HEIGHT_SCALE) || 1;
// "-" замість .topo: лише рельєф і море (для модів без топографічних даних)
const b = topoPath === "-" ? Buffer.alloc(0) : readFileSync(topoPath);

// ---- секції
const sections = new Map();
for (let off = 20; off + 20 <= b.length; ) {
  const tag = b.toString("latin1", off, off + 4);
  if (!/^[A-Z0-9_]{3,4}$/.test(tag)) break;
  const size = b.readUInt32LE(off + 8), end = b.readUInt32LE(off + 12);
  sections.set(tag, { off, payload: off + 20, end, ver: b.readUInt32LE(off + 4) });
  if (end <= off) break;
  off = end;
}
console.log("sections:", [...sections.entries()].map(([k, v]) => `${k}(v${v.ver},${v.end - v.payload}B)`).join(" "));

// ---- дороги: LOD0
function parseRoads() {
  const s = sections.get("ROAD");
  if (!s) return [];
  // шукаємо перший запис: [class<=6][n у 2..20000][точки в межах терену] з ланцюгом >= 8 валідних записів
  const valid = (p) => {
    const cnt = b.readUInt32LE(p + 1);
    if (b[p] > 8 || cnt < 4 || cnt > 60000 || p + 5 + cnt * 8 + 4 > s.end) return false;
    for (let k = 0; k < Math.min(cnt, 6); k++) {
      const x = b.readFloatLE(p + 5 + k * 8), z = b.readFloatLE(p + 9 + k * 8);
      if (!(x >= -50 && x <= SIZE + 50 && z >= -50 && z <= SIZE + 50)) return false;
    }
    return true;
  };
  let first = -1;
  for (let p = s.payload + 12; p < s.payload + 200 && first < 0; p++) {
    if (!valid(p)) continue;
    // ланцюг із 8 записів
    let o = p, ok = 0;
    for (let k = 0; k < 8; k++) {
      if (!valid(o)) break;
      const e = o + 5 + b.readUInt32LE(o + 1) * 8;
      const tail = b.readUInt32LE(e);
      if (tail > 64) break;
      o = e + 4 + tail * 4;
      ok++;
    }
    if (ok >= 8) first = p;
  }
  if (first < 0) { console.log("ROAD: не знайдено початок записів"); return []; }
  // лічильники класів стоять на початку payload: рахуємо скільки записів у LOD0
  const counts = [];
  for (let k = 0; k < 6; k++) counts.push(b.readUInt32LE(s.payload + k * 4));
  const total = counts.reduce((a, c) => a + c, 0);
  const recs = [];
  let o = first;
  for (let i = 0; i < total && o + 5 < s.end; i++) {
    if (!valid(o)) break;
    const cls = b[o], n = b.readUInt32LE(o + 1);
    const pts = new Float32Array(n * 2);
    for (let k = 0; k < n * 2; k++) pts[k] = b.readFloatLE(o + 5 + k * 4);
    for (let k = 1; k < n * 2; k += 2) pts[k] = SIZE - pts[k];
    recs.push({ cls, n, pts });
    const e = o + 5 + n * 8;
    const tail = b.readUInt32LE(e);
    o = e + 4 + tail * 4;
  }
  console.log("ROAD: LOD0 records", recs.length, "of", total, "(counts per class:", counts.join(","), ")");
  return recs;
}

// ---- будівлі: LOD0
function parseBuildings() {
  const s = sections.get("BULD");
  if (!s) return [];
  let o = s.payload;
  const lods = b.readUInt32LE(o), cnt = b.readUInt32LE(o + 4);
  o += 8;
  const out = [];
  for (let i = 0; i < cnt; i++) {
    const n = b.readUInt32LE(o);
    if (n < 3 || n > 5000 || o + 4 + n * 8 > s.end) { console.log("BULD: обрив на", i, "з", cnt); break; }
    const pts = new Float32Array(n * 2);
    for (let k = 0; k < n * 2; k++) pts[k] = b.readFloatLE(o + 4 + k * 4);
    for (let k = 1; k < n * 2; k += 2) pts[k] = SIZE - pts[k];
    out.push(pts);
    o += 4 + n * 8;
  }
  console.log("BULD:", out.length, "будівель у LOD0 (lods", lods + ")");
  return out;
}
// AREA: облако точок (u32 6, 6 x 0, 6, 6 x 0, u32 N, далі N x (f32 x, f32 z)) — випадкові вибірки всередині
// багатокутників рослинності (ліс, чагарі). Саму геометрію полігонів у файлі не збережено, тому
// відновлюємо покриття морфологічним "закриттям" растру точок.
const FOREST_CELL = Number(process.env.FOREST_CELL) || 4;
function parseForest() {
  const s = sections.get("AREA");
  if (!s) return null;
  const G = Math.ceil(SIZE / FOREST_CELL);
  let m = new Float32Array(G * G);
  const N = b.readUInt32LE(s.payload + 56);
  if (s.end - s.payload !== 60 + N * 8) {
    // Другий різновид: u32 6 (LOD), u32 кількість, далі на меш [u32 nv][nv x (x,z)][u32 ni][ni x u32 індекс]
    // — трикутники (список без спільних вершин), LOD0 перший.
    const meshes = b.readUInt32LE(s.payload + 4);
    let o = s.payload + 8, tris = 0;
    const pt = new Float32Array(6);
    for (let k = 0; k < meshes; k++) {
      const nv = b.readUInt32LE(o);
      if (o + 4 + nv * 8 + 4 > s.end) { console.log("AREA: обрив мешів на", k); break; }
      const vo = o + 4;
      o += 4 + nv * 8;
      const ni = b.readUInt32LE(o); o += 4 + ni * 4;
      for (let t = 0; t + 2 < nv; t += 3) {
        for (let q = 0; q < 3; q++) { pt[q * 2] = b.readFloatLE(vo + (t + q) * 8) / FOREST_CELL; pt[q * 2 + 1] = (b.readFloatLE(vo + (t + q) * 8 + 4)) / FOREST_CELL; }
        // z у топо перевернуте: рядок растру = z_topo / cell
        const minX = Math.max(0, Math.floor(Math.min(pt[0], pt[2], pt[4]))), maxX = Math.min(G - 1, Math.ceil(Math.max(pt[0], pt[2], pt[4])));
        const minY = Math.max(0, Math.floor(Math.min(pt[1], pt[3], pt[5]))), maxY = Math.min(G - 1, Math.ceil(Math.max(pt[1], pt[3], pt[5])));
        const d = (pt[3] - pt[5]) * (pt[0] - pt[4]) + (pt[4] - pt[2]) * (pt[1] - pt[5]);
        if (Math.abs(d) < 1e-9) continue;
        for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5, py = y + 0.5;
          const l1 = ((pt[3] - pt[5]) * (px - pt[4]) + (pt[4] - pt[2]) * (py - pt[5])) / d;
          const l2 = ((pt[5] - pt[1]) * (px - pt[4]) + (pt[0] - pt[4]) * (py - pt[5])) / d;
          if (l1 >= -0.02 && l2 >= -0.02 && 1 - l1 - l2 >= -0.02) m[y * G + x] = 1;
        }
        tris++;
      }
    }
    console.log("AREA (меші):", meshes, "полігонів,", tris, "трикутників");
    return { G, data: boxBlur(m, G, G, 1) };
  }
  for (let i = 0; i < N; i++) {
    const x = b.readFloatLE(s.payload + 60 + i * 8), z = SIZE - b.readFloatLE(s.payload + 64 + i * 8);
    const gx = Math.floor(x / FOREST_CELL), gy = Math.floor((SIZE - z) / FOREST_CELL);
    if (gx >= 0 && gx < G && gy >= 0 && gy < G) m[gy * G + gx] = 1;
  }
  const R = Math.round(24 / FOREST_CELL);
  let d = boxBlur(m, G, G, R);
  for (let i = 0; i < d.length; i++) d[i] = d[i] > 0.0005 ? 1 : 0;
  let e = boxBlur(d, G, G, R);
  for (let i = 0; i < e.length; i++) e[i] = e[i] > 0.999 ? 1 : 0;
  e = boxBlur(e, G, G, 1); // згладжений контур; різкість повертає smoothstep при вибірці
  console.log("AREA:", N, "точок, сітка", G + "x" + G);
  return { G, data: e };
}
const roads = parseRoads();
const buildings = parseBuildings();

// ---- висоти -> базовий растр (колір рельєфу) і маска моря
const hb = readFileSync(heightsPath);
const rows = hb.readInt32LE(0), cols = hb.readInt32LE(4);
const Hraw = new Int16Array(rows * cols);
for (let i = 0; i < rows * cols; i++) Hraw[i] = hb.readInt16LE(8 + i * 2);
const H = HEIGHT_SCALE === 1 ? Hraw : Float32Array.from(Hraw, (v) => v / HEIGHT_SCALE);
const cell = SIZE / (rows - 1);
// Висоти в сітці — цілі метри: на рівнинах це дає "сходинки" й шумне тіньове освітлення. Згладжуємо
// (кілька проходів ковзного середнього), тоді рельєф лягає м'якими плямами, як на карті гри.
const Hf = Float32Array.from(H);
function boxBlur(src, rows, cols, r) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < cols; y++) {
    for (let x = 0; x < rows; x++) {
      let sum = 0, n = 0;
      for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < rows) { sum += src[xx * cols + y]; n++; } }
      tmp[x * cols + y] = sum / n;
    }
  }
  for (let x = 0; x < rows; x++) {
    for (let y = 0; y < cols; y++) {
      let sum = 0, n = 0;
      for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < cols) { sum += tmp[x * cols + yy]; n++; } }
      out[x * cols + y] = sum / n;
    }
  }
  return out;
}
const forest = parseForest();
function forestAt(X, Z) {
  if (!forest) return 0;
  const { G, data } = forest;
  const fx = Math.min(G - 1.001, Math.max(0, X / FOREST_CELL - 0.5)), fy = Math.min(G - 1.001, Math.max(0, (SIZE - Z) / FOREST_CELL - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, i = y0 * G + x0;
  const v = data[i] * (1 - tx) * (1 - ty) + data[i + 1] * tx * (1 - ty) + data[i + G] * (1 - tx) * ty + data[i + G + 1] * tx * ty;
  const t = Math.min(1, Math.max(0, (v - 0.4) / 0.2));
  return t * t * (3 - 2 * t);
}
let Hs = Hf;
// згладжування за метрами, а не клітинками: ~3 проходи по 2 клітинки на сітці 6-12 м
const blurR = Math.max(1, Math.round(12 / cell));
for (let i = 0; i < 3; i++) Hs = boxBlur(Hs, rows, cols, blurR);
// растр: x = рядок (схід), y = стовпець (північ угорі)
const W = rows, Hh = cols;
const elev = (x, y) => H[Math.max(0, Math.min(rows - 1, x)) * cols + Math.max(0, Math.min(cols - 1, y))];
const elevS = (x, y) => Hs[Math.max(0, Math.min(rows - 1, x)) * cols + Math.max(0, Math.min(cols - 1, y))];
const LAND = [238, 238, 235], SEA = [232, 249, 250], FOREST = [200, 224, 186];
const shadeGrid = new Float32Array(W * Hh);
const ex = 1.6; // вертикальне перебільшення для плоских територій
const lx = -0.6, ly = -0.6, lz = 0.53; // напрямок світла (з північного заходу, зверху)
for (let y = 0; y < Hh; y++) {
  for (let x = 0; x < W; x++) {
    const dzdx = (elevS(x + 1, y) - elevS(x - 1, y)) / (2 * cell) * ex;
    const dzdy = (elevS(x, y + 1) - elevS(x, y - 1)) / (2 * cell) * ex;
    // нормаль (-dzdx, +dzdy (y на південь, Z на північ), 1)
    const nx = -dzdx, ny = dzdy, nz = 1;
    const dot = (nx * lx + ny * ly + nz * lz) / Math.hypot(nx, ny, nz);
    shadeGrid[y * W + x] = Math.max(0.8, Math.min(1.06, 0.96 + (dot - 0.53) * 0.7));
  }
}
// білінійна вибірка за світовими координатами: растр x = рядок сітки (схід), y = стовпець (північ угорі)
const gxScale = (W - 1) / SIZE, gyScale = (Hh - 1) / SIZE;
function bil(arr, X, Z) {
  const fx = Math.min(W - 1.001, Math.max(0, X * gxScale)), fy = Math.min(Hh - 1.001, Math.max(0, (SIZE - Z) * gyScale));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const i = y0 * W + x0;
  return arr[i] * (1 - tx) * (1 - ty) + arr[i + 1] * tx * (1 - ty) + arr[i + W] * (1 - tx) * ty + arr[i + W + 1] * tx * ty;
}
// сира висота у тому ж розкладі (x = рядок, y = стовпець): Float32 для білінійної вибірки берегової лінії
const rawGrid = new Float32Array(W * Hh);
for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) rawGrid[y * W + x] = H[x * cols + y];
const shadeG = new Float32Array(W * Hh);
shadeG.set(shadeGrid);

// ---- стиль векторів
const ROAD_STYLE = {
  0: { w: 20, fill: "rgb(240,236,170)", casing: "rgb(205,198,120)" },
  1: { w: 16, fill: "rgb(242,238,160)", casing: "rgb(205,196,110)" },
  2: { w: 11, fill: "rgb(243,238,172)", casing: "rgb(208,200,125)" },
  3: { w: 7, fill: "rgb(190,172,140)", casing: "rgb(160,146,118)" },
  4: { w: 6, fill: "rgb(190,172,140)", casing: "rgb(160,146,118)" },
  5: { w: 3, fill: "rgb(185,170,140)", casing: "rgb(150,138,112)" }
};
// центральна лінія дороги із чотирикутників: середина початкового краю, далі середини кінцевих країв
function centerline(pts) {
  const n = pts.length / 2;
  const line = [];
  const q = Math.floor(n / 4);
  for (let k = 0; k < q; k++) {
    const i = k * 4;
    const sx = (pts[i * 2] + pts[(i + 1) * 2]) / 2, sz = (pts[i * 2 + 1] + pts[(i + 1) * 2 + 1]) / 2;
    const ex2 = (pts[(i + 2) * 2] + pts[(i + 3) * 2]) / 2, ez = (pts[(i + 2) * 2 + 1] + pts[(i + 3) * 2 + 1]) / 2;
    if (k === 0) line.push([sx, sz]);
    line.push([ex2, ez]);
  }
  return line;
}
const roadLines = roads.map((r) => ({ cls: r.cls, line: centerline(r.pts) })).filter((r) => r.line.length >= 2);

// ---- область рендеру
const [x0, z0, x1, z1] = bbox.length === 4 ? bbox.map(Number) : [0, 0, SIZE, SIZE];
const outW = Math.round((x1 - x0) * PPM), outH = Math.round((z1 - z0) * PPM);
console.log("вихід:", outW, "x", outH, "px; область X", x0, x1, "Z", z0, z1);
const CH = 2048; // піксельний розмір шматка
const comps = [];
for (let cy = 0; cy < outH; cy += CH) {
  for (let cx = 0; cx < outW; cx += CH) {
    const w = Math.min(CH, outW - cx), h = Math.min(CH, outH - cy);
    // світові межі шматка
    const wx0 = x0 + cx / PPM, wx1 = x0 + (cx + w) / PPM;
    const wz1 = z1 - cy / PPM, wz0 = z1 - (cy + h) / PPM;
    const chunk = Buffer.alloc(w * h * 3);
    for (let yy = 0; yy < h; yy++) {
      const Z = z1 - (cy + yy + 0.5) / PPM;
      for (let xx = 0; xx < w; xx++) {
        const X = x0 + (cx + xx + 0.5) / PPM;
        const elevHere = bil(rawGrid, X, Z);
        const di = (yy * w + xx) * 3;
        if (elevHere <= 0.35) { chunk[di] = SEA[0]; chunk[di + 1] = SEA[1]; chunk[di + 2] = SEA[2]; }
        else {
          const sh = bil(shadeG, X, Z);
          const fa = forestAt(X, Z);
          const base = [0, 1, 2].map((c) => LAND[c] + (FOREST[c] - LAND[c]) * fa);
          chunk[di] = Math.min(255, base[0] * sh); chunk[di + 1] = Math.min(255, base[1] * sh); chunk[di + 2] = Math.min(255, base[2] * sh);
        }
      }
    }
    // вектори шматка
    const pad = 30;
    const inb = (px, pz) => px >= wx0 - pad && px <= wx1 + pad && pz >= wz0 - pad && pz <= wz1 + pad;
    const X = (x) => ((x - wx0) * PPM).toFixed(1), Y = (z) => ((wz1 - z) * PPM).toFixed(1);
    const parts = [];
    const byCls = new Map();
    for (const r of roadLines) {
      if (!r.line.some(([x, z]) => inb(x, z))) continue;
      (byCls.get(r.cls) ?? byCls.set(r.cls, []).get(r.cls)).push(r.line);
    }
    // спочатку обводка для всіх класів, потім заливка: перехрестя виглядають цілісно
    const order = [3, 4, 5, 2, 1, 0];
    for (const pass of ["casing", "fill"]) {
      for (const cls of order) {
        const st = ROAD_STYLE[cls];
        const lines = byCls.get(cls);
        if (!st || !lines) continue;
        const sw = ((pass === "casing" ? st.w + 2.4 : st.w) * PPM).toFixed(1);
        const col = pass === "casing" ? st.casing : st.fill;
        for (const line of lines) {
          parts.push(`<polyline fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" points="${line.map(([x, z]) => X(x) + "," + Y(z)).join(" ")}"/>`);
        }
      }
    }
    for (const pts of buildings) {
      let any = false;
      for (let k = 0; k < pts.length; k += 2) if (inb(pts[k], pts[k + 1])) { any = true; break; }
      if (!any) continue;
      const poly = [];
      for (let k = 0; k < pts.length; k += 2) poly.push(X(pts[k]) + "," + Y(pts[k + 1]));
      parts.push(`<polygon points="${poly.join(" ")}" fill="rgb(160,160,157)" stroke="rgb(92,92,89)" stroke-width="${(0.7 * PPM).toFixed(2)}" stroke-linejoin="round"/>`);
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join("")}</svg>`;
    const overlay = await sharp(Buffer.from(svg), { limitInputPixels: false }).png().toBuffer();
    const merged = await sharp(chunk, { raw: { width: w, height: h, channels: 3 } }).composite([{ input: overlay }]).png().toBuffer();
    comps.push({ input: merged, left: cx, top: cy });
    process.stdout.write(`\rшматок ${comps.length}`);
  }
}
console.log();
await sharp({ create: { width: outW, height: outH, channels: 3, background: LAND }, limitInputPixels: false })
  .composite(comps)
  .png({ compressionLevel: 6 })
  .toFile(outPath);
console.log("записано", outPath);
