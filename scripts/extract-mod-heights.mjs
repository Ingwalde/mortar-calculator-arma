// Висоти модових теренів із .ttile (TERR/HGHT) -> resources/heights/<id>.bin у форматі застосунку.
//   node scripts/extract-mod-heights.mjs <id> <шлях до data.pak>
// Той самий формат, що й у Bad Orb (див. extract-badorb-heights.mjs): плитки 129x129 u16 LE,
// метри = raw * 0.03125 + зсув з Terrain.HEAD; рядок плитки = Z (на північ), стовпець = X (на схід);
// сусідні плитки діляться крайніми вершинами (перевіряємо збіг країв).
import { openSync, readSync, statSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { inflateSync, inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// size — довжина сторони терену в метрах; cell — крок вершин; tiles — плиток на сторону;
// step — через скільки вершин брати значення для збереженої сітки (економія розміру).
const CONFIG = {
  bystrany: { prefix: "Worlds/Bystrany/Bystrany/.Data/Bystrany_", tiles: 64, cell: 1.5, step: 8, offset: -204.78125 },
  ironholdcastle: { prefix: "World/Terrain/.Data/Terrain_", tiles: 4, cell: 2, step: 1, offset: -204.78125 },
  kirovograd: { prefix: "Terrain/.Data/Terrain_", tiles: 32, cell: 2, step: 4, offset: -204.78125 },
  mogadishu: { prefix: "Worlds/Mogadishu/mogadishu/.Data/mogadishu_", tiles: 24, cell: 2, step: 3, offset: -204.78125 },
  novyinovka: { prefix: "worlds/Terrain/.Data/Terrain_", tiles: 16, cell: 2, step: 2, offset: -204.78125 }
};
const SCALE = 0.03125;
// Для рендеру карт рельєфу: STEP=<вершин> (менше = детальніше), HSCALE=<множник> (значення зберігаємо як
// round(метри * HSCALE), щоб не було "терас" від цілих метрів), OUT=<файл>.
const STEP = Number(process.env.STEP) || 0;
const HSCALE = Number(process.env.HSCALE) || 1;

const [id, pak] = process.argv.slice(2);
const cfg = CONFIG[id];
if (!cfg || !pak) throw new Error("використання: extract-mod-heights.mjs <" + Object.keys(CONFIG).join("|") + "> <data.pak>");

const fd = openSync(pak, "r");
const size = statSync(pak).size;
const read = (o, l) => { const b = Buffer.alloc(l); const n = readSync(fd, b, 0, l, o); return n === l ? b : b.subarray(0, n); };
let off = 12, fileStart = -1, fileLen = 0;
while (off + 8 <= size) {
  const h = read(off, 8);
  const tag = h.toString("latin1", 0, 4), len = h.readUInt32BE(4);
  if (tag === "FILE") { fileStart = off + 8; fileLen = len; break; }
  off += 8 + len;
}
const fc = read(fileStart, fileLen);
let p = 0;
const files = new Map();
function entry(prefix) {
  const type = fc[p++];
  const nl = fc[p++];
  const name = fc.toString("utf8", p, p + nl);
  p += nl;
  if (type === 0) {
    const n = fc.readUInt32LE(p); p += 4;
    for (let i = 0; i < n; i++) entry(prefix + name + "/");
  } else {
    files.set(prefix + name, { offset: fc.readUInt32LE(p), csize: fc.readUInt32LE(p + 4), usize: fc.readUInt32LE(p + 8) });
    p += 24;
  }
}
p = 0; fc[p++]; const rl = fc[p++]; p += rl;
const rc = fc.readUInt32LE(p); p += 4;
for (let i = 0; i < rc; i++) entry("");
const getFile = (path) => {
  const e = files.get(path);
  if (!e) return null;
  const raw = read(e.offset, e.csize);
  if (e.csize === e.usize) return raw;
  try { return inflateSync(raw); } catch { return inflateRawSync(raw); }
};

const T = cfg.tiles, V = 129, CELLS = 128, N = T * CELLS;
const grid = new Uint16Array((N + 1) * (N + 1));
const tiles = new Array(T * T);
for (let n = 0; n < T * T; n++) {
  const b = getFile(cfg.prefix + n + ".ttile");
  if (!b) throw new Error("нема плитки " + n + " (" + cfg.prefix + n + ".ttile)");
  const i = b.indexOf("HGHT");
  if (i < 0 || b.readUInt32BE(i + 4) !== V * V * 2) throw new Error(`плитка ${n}: неочікуваний HGHT ${i >= 0 ? b.readUInt32BE(i + 4) : "нема"}`);
  const t = new Uint16Array(V * V);
  for (let k = 0; k < V * V; k++) t[k] = b.readUInt16LE(i + 8 + k * 2);
  tiles[n] = t;
  const tx = n % T, tz = Math.floor(n / T);
  for (let r = 0; r < V; r++) for (let c = 0; c < V; c++) grid[(tz * CELLS + r) * (N + 1) + (tx * CELLS + c)] = t[r * V + c];
}

// перевірка швів
let bad = 0, total = 0;
for (let tz = 0; tz < T; tz++) for (let tx = 0; tx < T; tx++) {
  const a = tiles[tz * T + tx];
  if (tx + 1 < T) { const r = tiles[tz * T + tx + 1]; for (let k = 0; k < V; k++) { total++; if (a[k * V + 128] !== r[k * V]) bad++; } }
  if (tz + 1 < T) { const r = tiles[(tz + 1) * T + tx]; for (let k = 0; k < V; k++) { total++; if (a[128 * V + k] !== r[k]) bad++; } }
}
console.log(`шви: ${((1 - bad / total) * 100).toFixed(2)}% збігаються (${bad} з ${total} розбіжностей)`);

const toM = (raw) => raw * SCALE + cfg.offset;
// вихідна сітка: рядок = X, стовпець = з півночі на південь
const step = STEP || cfg.step;
const dim = Math.floor(N / step) + 1;
const out = Buffer.alloc(8 + dim * dim * 2);
out.writeInt32LE(dim, 0);
out.writeInt32LE(dim, 4);
let min = 1e9, max = -1e9;
for (let row = 0; row < dim; row++) {
  const x = Math.min(N, row * step);
  for (let col = 0; col < dim; col++) {
    const z = Math.max(0, N - col * step);
    const m = Math.round(toM(grid[z * (N + 1) + x]) * HSCALE);
    if (m < min) min = m;
    if (m > max) max = m;
    out.writeInt16LE(m, 8 + (row * dim + col) * 2);
  }
}
const OUT = process.env.OUT || fileURLToPath(new URL(`../resources/heights/${id}.bin`, import.meta.url));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
console.log(`${id}: ${dim}x${dim} (крок ${step * cfg.cell} м), терен ${N * cfg.cell} м, висоти ${min}..${max} м, ${(out.length / 1048576).toFixed(1)} МБ`);

// перевірка за висотами підписів із шарів мода (якщо є файл labels)
const labelsFile = `D:/arma-mods/out/${{ bystrany: "Bystrany", ironholdcastle: "IronHoldCastle", kirovograd: "Chernorus_Kirovograd", mogadishu: "Mogadishu", novyinovka: "Novyinovka" }[id]}-labels.json`;
if (existsSync(labelsFile)) {
  const labels = JSON.parse(readFileSync(labelsFile, "utf8"));
  const errs = [];
  for (const L of labels) {
    const gx = Math.round(L.x / cfg.cell), gz = Math.round(L.z / cfg.cell);
    if (gx < 0 || gz < 0 || gx > N || gz > N) continue;
    errs.push(Math.abs(toM(grid[gz * (N + 1) + gx]) - L.h));
  }
  errs.sort((a, b) => a - b);
  if (errs.length) console.log(`підписи: ${errs.length} шт., медіана похибки ${errs[Math.floor(errs.length / 2)].toFixed(1)} м, p90 ${errs[Math.floor(errs.length * 0.9)].toFixed(1)} м`);
}
