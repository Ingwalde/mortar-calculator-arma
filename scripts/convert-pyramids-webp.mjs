// Конвертує імпортовані піраміди тайлів із JPEG у WebP (на третину-половину менше місця й трафіку).
// Нові імпорти вже пишуться в WebP; цей скрипт переводить карти, імпортовані раніше. Застосунок читає обидва
// формати, тож конвертація безпечна: .jpg видаляється лише після того, як .webp успішно записано й читається.
//   node scripts/convert-pyramids-webp.mjs [каталог maps] [--keep] [--quality=90] [--only=<id,id>]
// Типовий каталог: %APPDATA%/mortar-tablet/maps. Закрийте застосунок перед запуском.
import sharp from "sharp";
import { readdir, stat, unlink, rename, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=")[1] : def;
};
const keep = args.includes("--keep");
const quality = Number(flag("quality", "90"));
const only = flag("only", "")
  .split(",")
  .filter(Boolean);
const root =
  args.find((a) => !a.startsWith("--")) ?? join(process.env.APPDATA ?? "", "mortar-tablet", "maps");

sharp.cache(false);
const CONCURRENCY = 8;
const num = /^\d+$/;

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

async function convertOne(file, stats) {
  const out = file.replace(/\.jpg$/i, ".webp");
  const before = (await stat(file)).size;
  // Усе в пам'яті: sharp не тримає відкритих файлів (на Windows це давало EBUSY при rename).
  const buf = await sharp(await readFile(file)).webp({ quality, smartSubsample: true, effort: 4 }).toBuffer();
  const meta = await sharp(buf).metadata();
  if (!meta.width || !meta.height) throw new Error("webp не читається: " + file);
  const tmp = out + ".tmp";
  await writeFile(tmp, buf);
  await rename(tmp, out);
  if (!keep) await unlink(file);
  stats.files++;
  stats.before += before;
  stats.after += buf.length;
}

const entries = (await readdir(root, { withFileTypes: true })).filter(
  (e) => e.isDirectory() && !/backup/i.test(e.name) && (only.length === 0 || only.includes(e.name))
);
let totalBefore = 0;
let totalAfter = 0;
for (const e of entries) {
  const dir = join(root, e.name);
  const stats = { files: 0, before: 0, after: 0 };
  const queue = [];
  let failed = 0;
  for await (const f of walk(dir)) {
    if (!/\.jpg$/i.test(f)) continue;
    const parts = f.slice(dir.length + 1).split(/[\\/]/);
    if (parts.length !== 3 || !num.test(parts[0]) || !num.test(parts[1])) continue; // лише {z}/{row}/{col}.jpg
    queue.push(f);
  }
  if (!queue.length) {
    console.log(`${e.name}: JPEG-тайлів нема (уже WebP або порожньо)`);
    continue;
  }
  let i = 0;
  const worker = async () => {
    for (;;) {
      const f = queue[i++];
      if (!f) return;
      try {
        await convertOne(f, stats);
      } catch (err) {
        failed++;
        console.error(`  ✗ ${f}: ${err.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  totalBefore += stats.before;
  totalAfter += stats.after;
  const mb = (n) => (n / 1048576).toFixed(1);
  console.log(
    `${e.name}: ${stats.files} тайлів, ${mb(stats.before)} МБ -> ${mb(stats.after)} МБ (${((100 * stats.after) / Math.max(1, stats.before)).toFixed(0)}%)` +
      (failed ? `, помилок: ${failed}` : "")
  );
}
const mb = (n) => (n / 1048576).toFixed(1);
console.log(`\nРазом: ${mb(totalBefore)} МБ -> ${mb(totalAfter)} МБ (економія ${mb(totalBefore - totalAfter)} МБ)`);
