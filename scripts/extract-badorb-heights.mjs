// Висоти Bad Orb із самого мода (каталог GeNeFRAG їх не має).
//   node scripts/extract-badorb-heights.mjs <шлях до addons/BadOrb…/data.pak> [крок_м=4]
// Формат (з'ясовано розбором PAC1 і перевірено за висотами підписів у Place_Labels.layer: медіана
// похибки 0.65 м, 151 з 261 міток у межах 1 м):
//   Worlds/Dev Branch/5km_Terrain/.Data/5km_Terrain_{N}.ttile, N = 0..1599, 40x40 плиток;
//   у плитці шматок HGHT = 129x129 u16 LE (рядок = Z на північ, стовпець = X на схід);
//   метри = raw * 0.03125 - 102.375 (поля HEAD файлу .terr), крок вершин 1 м, 5121x5121 вершин.
// Вихід у бінарному форматі застосунку (core/heightGrid): i32 rows, i32 cols, Int16 LE[rows*cols],
// де рядок = X (схід), стовпець іде з півночі на південь — тобто як очікує sampleHeight().
import { openSync, readSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { inflateSync, inflateRawSync } from "node:zlib";

const pak = process.argv[2];
const step = Number(process.argv[3] ?? 4);
if (!pak) throw new Error("вкажіть шлях до data.pak мода Bad Orb");
const OUT = new URL("../resources/heights/badorb.bin", import.meta.url);

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

const TILES = 40, V = 129, CELLS = 128, N = TILES * CELLS; // N = 5120 клітинок, 5121 вершина
const SCALE = 0.03125, OFFSET = -102.375;
const base = "Worlds/Dev Branch/5km_Terrain/.Data/5km_Terrain_";
const grid = new Uint16Array((N + 1) * (N + 1)); // [z * 5121 + x]
for (let n = 0; n < TILES * TILES; n++) {
  const b = getFile(base + n + ".ttile");
  if (!b) throw new Error("нема плитки " + n);
  const i = b.indexOf("HGHT");
  if (i < 0 || b.readUInt32BE(i + 4) !== V * V * 2) throw new Error("плитка " + n + ": неочікуваний HGHT");
  const tx = n % TILES, tz = Math.floor(n / TILES);
  for (let r = 0; r < V; r++) for (let c = 0; c < V; c++) {
    grid[(tz * CELLS + r) * (N + 1) + (tx * CELLS + c)] = b.readUInt16LE(i + 8 + (r * V + c) * 2);
  }
}

// вихідна сітка крок step: рядок = X, стовпець = з півночі (Z=N) на південь
const dim = Math.floor(N / step) + 1;
const out = Buffer.alloc(8 + dim * dim * 2);
out.writeInt32LE(dim, 0);
out.writeInt32LE(dim, 4);
let min = 1e9, max = -1e9;
for (let row = 0; row < dim; row++) {
  const x = Math.min(N, row * step);
  for (let col = 0; col < dim; col++) {
    const z = Math.max(0, N - col * step);
    const m = Math.round(grid[z * (N + 1) + x] * SCALE + OFFSET);
    if (m < min) min = m;
    if (m > max) max = m;
    out.writeInt16LE(m, 8 + (row * dim + col) * 2);
  }
}
mkdirSync(dirname(OUT.pathname.replace(/^\/([A-Za-z]:)/, "$1")), { recursive: true });
writeFileSync(OUT.pathname.replace(/^\/([A-Za-z]:)/, "$1"), out);
console.log(`записано resources/heights/badorb.bin: ${dim}x${dim} (крок ${step} м), висоти ${min}..${max} м, ${(out.length / 1048576).toFixed(1)} МБ`);
