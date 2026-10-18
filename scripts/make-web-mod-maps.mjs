// Готує карти модових теренів для автономної веб-збірки (PWA/APK): з локальних пірамід застосунку на ПК
// бере рівні від грубого до такого, що вкладається в бюджет розміру, і пакує їх в архів + пише src/core/web-mod-maps.json.
//   node scripts/make-web-mod-maps.mjs <папка maps застосунку> <вихідна папка> [бюджет МБ на терен, типово 16]
//   напр.: node scripts/make-web-mod-maps.mjs "%APPDATA%/mortar-tablet/maps" D:/tmp/webmaps
// Далі архів mod-maps.tar.gz завантажується в реліз web-assets (його качає scripts/build-web-assets.ts):
//   gh release create web-assets --prerelease --title "Дані карт для веб-збірки" D:/tmp/webmaps/mod-maps.tar.gz
// Розміри повного зображення береться з board.json у батьківській папці (там записано width/height піраміди).
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [mapsDir, outDir, budgetArg] = process.argv.slice(2);
if (!mapsDir || !outDir) {
  console.error("Використання: node scripts/make-web-mod-maps.mjs <папка maps> <вихідна папка> [бюджет МБ]");
  process.exit(2);
}
const BUDGET = (Number(budgetArg) || 16) * 1048576;
const TILE = 256;
const root = fileURLToPath(new URL("..", import.meta.url));
const board = JSON.parse(readFileSync(join(dirname(mapsDir), "board.json"), "utf8"));

// той самий розрахунок, що в src/core/tilePyramid.ts
function plan(width, height) {
  const maxLevel = Math.max(0, Math.ceil(Math.log2(Math.max(width, height) / TILE)));
  const levels = [];
  for (let z = 0; z <= maxLevel; z++) {
    const s = Math.pow(2, z - maxLevel);
    const w = Math.max(1, Math.round(width * s));
    const h = Math.max(1, Math.round(height * s));
    levels.push({ z, width: w, height: h, cols: Math.ceil(w / TILE), rows: Math.ceil(h / TILE) });
  }
  return { maxLevel, levels };
}

const stage = join(outDir, "mod-maps");
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
const index = {};
let total = 0;

for (const id of readdirSync(mapsDir)) {
  const src = join(mapsDir, id);
  const m = board.data?.[id]?.map;
  if (!statSync(src).isDirectory() || !m || m.kind !== "pyramid") continue;
  const full = plan(m.width, m.height);
  // рівні, що вкладаються в бюджет (накопичувально від грубого)
  let cum = 0;
  let top = 0;
  const sizes = [];
  for (const lv of full.levels) {
    const dir = join(src, String(lv.z));
    if (!existsSync(dir)) break;
    let bytes = 0;
    for (const row of readdirSync(dir)) for (const f of readdirSync(join(dir, row))) bytes += statSync(join(dir, row, f)).size;
    if (lv.z > 0 && cum + bytes > BUDGET) break;
    cum += bytes;
    top = lv.z;
    sizes.push(bytes);
  }
  const topLv = full.levels[top];
  const reduced = plan(topLv.width, topLv.height);
  // піраміда зі зменшеного розміру має збігатися з урізаною: однакова сітка тайлів на кожному рівні
  for (let z = 0; z <= top; z++) {
    const a = full.levels[z];
    const b = reduced.levels[z];
    if (!b || a.cols !== b.cols || a.rows !== b.rows) throw new Error(`${id}: сітка рівня ${z} не збігається (${a.cols}x${a.rows} vs ${b?.cols}x${b?.rows})`);
  }
  if (reduced.maxLevel !== top) throw new Error(`${id}: maxLevel ${reduced.maxLevel} != ${top}`);
  let count = 0;
  for (let z = 0; z <= top; z++) {
    const dir = join(src, String(z));
    for (const row of readdirSync(dir)) {
      mkdirSync(join(stage, id, String(z), row), { recursive: true });
      for (const f of readdirSync(join(dir, row))) {
        copyFileSync(join(dir, row, f), join(stage, id, String(z), row, f));
        count++;
      }
    }
  }
  index[id] = { width: topLv.width, height: topLv.height, maxLevel: top, tiles: count, mb: +(cum / 1048576).toFixed(1) };
  total += cum;
  console.log(`${id}: рівні 0..${top} з ${full.maxLevel}, ${topLv.width}x${topLv.height}, ${count} тайлів, ${(cum / 1048576).toFixed(1)} МБ`);
}

writeFileSync(join(stage, "index.json"), JSON.stringify(index, null, 1));
const archive = join(outDir, "mod-maps.tar.gz");
rmSync(archive, { force: true });
// відносні шляхи й cwd: GNU tar приймає "D:" у шляху за ім'я віддаленого хоста
execFileSync("tar", ["-czf", "mod-maps.tar.gz", "mod-maps"], { cwd: outDir, stdio: "inherit" });
// розміри піраміди потрібні й клієнту (вони складають map у стані автономної версії)
const dims = Object.fromEntries(Object.entries(index).map(([id, v]) => [id, { width: v.width, height: v.height }]));
writeFileSync(join(root, "src", "core", "web-mod-maps.json"), JSON.stringify(dims, null, 1) + "\n");
// контрольна сума архіву: збірка сайту звіряє її перед розпакуванням (архів лежить у публічному релізі)
const sha = createHash("sha256").update(readFileSync(archive)).digest("hex");
writeFileSync(join(root, "scripts", "web-mod-maps.sha256"), sha + "
");
console.log(`sha256 ${sha}`);
console.log(`разом ${(total / 1048576).toFixed(1)} МБ -> ${archive} (${(statSync(archive).size / 1048576).toFixed(1)} МБ)`);
