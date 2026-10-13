// Стискає resources/heights/*.bin у *.bin.gz (gzip -9) і прибирає оригінали: сітки висот плавні й стискаються
// у ~8 разів (14 МБ -> 1,7 МБ). Застосунок розпаковує їх при читанні (src/main/tiles/heights.ts).
//   node scripts/compress-heights.mjs
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const dir = fileURLToPath(new URL("../resources/heights/", import.meta.url));
let before = 0;
let after = 0;
for (const f of readdirSync(dir)) {
  if (!f.endsWith(".bin")) continue;
  const buf = readFileSync(join(dir, f));
  const gz = gzipSync(buf, { level: 9 });
  writeFileSync(join(dir, f + ".gz"), gz);
  unlinkSync(join(dir, f));
  before += buf.length;
  after += gz.length;
  console.log(`${f}: ${(buf.length / 1048576).toFixed(2)} МБ -> ${(gz.length / 1048576).toFixed(2)} МБ`);
}
console.log(`разом: ${(before / 1048576).toFixed(1)} МБ -> ${(after / 1048576).toFixed(2)} МБ`);
