// Вирізає контури будівель (секція BULD, LOD 0) із .topo світу/мода й пакує у компактний бінарний файл:
//   node scripts/extract-buildings.mjs <id> <файл.topo> <розмір терену, м> <вихід.bin|вихід.ts>
// Для .ts пишеться модуль `export default "<base64>"` (src/core/buildings/<id>.ts — підвантажується рендерером за потреби).
// Формат (little-endian): "BLD1", u32 кількість; далі на будівлю: u8 n (3..255), n x (u16 x, u16 z),
// координати в чвертях метра (0..16383 м) у системі застосунку (X схід, Z північ): у .topo вісь Z дзеркальна, тому z = розмір - z. Контури з вершинами поза [0; 16383] м або з n > 255 пропускаються.
// Розкладка .topo описана в scripts/render-topo-map.mjs (секції [тег 4][u32 версія][u32 довжина][u32 кінець][u32 0]).
import { readFileSync, writeFileSync } from "node:fs";

const [id, topoPath, sizeArg, outPath] = process.argv.slice(2);
const SIZE = Number(sizeArg);
if (!id || !topoPath || !(SIZE > 0) || !outPath) {
  console.error("Використання: node scripts/extract-buildings.mjs <id> <файл.topo> <розмір, м> <вихід.bin>");
  process.exit(2);
}
const b = readFileSync(topoPath);
const sections = new Map();
for (let off = 20; off + 20 <= b.length; ) {
  const tag = b.toString("latin1", off, off + 4);
  if (!/^[A-Z0-9_]{3,4}$/.test(tag)) break;
  const end = b.readUInt32LE(off + 12);
  sections.set(tag, { payload: off + 20, end });
  if (end <= off) break;
  off = end;
}
const s = sections.get("BULD");
if (!s) {
  console.error(`${id}: у ${topoPath} нема секції BULD`);
  process.exit(1);
}
let o = s.payload;
const lods = b.readUInt32LE(o);
const cnt = b.readUInt32LE(o + 4);
o += 8;
const out = [];
let skipped = 0;
for (let i = 0; i < cnt; i++) {
  const n = b.readUInt32LE(o);
  if (n < 3 || n > 5000 || o + 4 + n * 8 > s.end) {
    console.error(`${id}: обрив на ${i} з ${cnt}`);
    break;
  }
  const pts = [];
  let ok = n <= 255;
  for (let k = 0; k < n && ok; k++) {
    const x = b.readFloatLE(o + 4 + k * 8);
    const z = SIZE - b.readFloatLE(o + 8 + k * 8);
    if (!(x >= 0 && x < 16383 && z >= 0 && z < 16383)) ok = false;
    pts.push(Math.round(x * 4), Math.round(z * 4));
  }
  if (ok) out.push(pts);
  else skipped++;
  o += 4 + n * 8;
}
let size = 8;
for (const p of out) size += 1 + p.length * 2;
const buf = Buffer.alloc(size);
buf.write("BLD1", 0, "latin1");
buf.writeUInt32LE(out.length, 4);
let w = 8;
for (const p of out) {
  buf[w++] = p.length / 2;
  for (const v of p) {
    buf.writeUInt16LE(v, w);
    w += 2;
  }
}
if (outPath.endsWith(".ts")) {
  writeFileSync(outPath, `// Згенеровано scripts/extract-buildings.mjs (${id}): контури будівель із .topo
export default "${buf.toString("base64")}";
`);
} else {
  writeFileSync(outPath, buf);
}
console.log(`${id}: ${out.length} будівель (пропущено ${skipped}, LOD-ів ${lods}), ${(size / 1024).toFixed(0)} КБ -> ${outPath}`);
