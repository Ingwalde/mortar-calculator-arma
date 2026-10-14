// Дозбирає статичний сайт автономної версії (out/web): сітки висот і дзеркальні тайли карт.
//   npx tsx scripts/build-web-assets.ts            (після vite build --config vite.web.config.ts)
//   WEB_SKIP_TILES=1 ...                          (без тайлів — швидка локальна збірка)
// Завантажене кешується в .web-cache/, щоб повторні збірки не качали все знову (CI кешує цю папку).
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { onlineTileList, tileUrl } from "../src/core/onlineTiles";
import { PRESETS } from "../src/core/terrains";
import { WEB_MIRROR_MIN_LOD, mirroredTilePath, webHeightsPath } from "../src/core/webMirror";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = join(root, "out", "web");
const cache = join(root, ".web-cache");
const CONCURRENCY = 8;

async function ensureDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

async function fetchBuffer(url: string, tries = 3): Promise<Buffer | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch {
      // мережевий збій — ще спроба
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  throw new Error(`Не вдалося завантажити ${url}`);
}

/** Сітка висот у форматі застосунку: i32 rows, i32 cols, Int16[rows*cols] (див. core/heightGrid.ts). */
function encodeGrid(raw: unknown[][]): Buffer {
  const rows = raw.length;
  const cols = rows > 0 ? raw[0].length : 0;
  const buf = Buffer.alloc(8 + rows * cols * 2);
  buf.writeInt32LE(rows, 0);
  buf.writeInt32LE(cols, 4);
  let o = 8;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      buf.writeInt16LE(Math.round(Number(raw[r][c])), o);
      o += 2;
    }
  }
  return buf;
}

async function buildHeights(): Promise<void> {
  const bundled = new Set<string>();
  const dir = join(root, "resources", "heights");
  for (const f of await readdir(dir)) {
    if (!f.endsWith(".bin.gz")) continue;
    const id = f.slice(0, -".bin.gz".length);
    const dest = join(out, webHeightsPath(id));
    await ensureDir(dest);
    await copyFile(join(dir, f), dest);
    bundled.add(id);
  }
  for (const p of PRESETS) {
    if (bundled.has(p.id) || !p.heightData) continue;
    const cached = join(cache, "heights", `${p.id}.bin.gz`);
    if (!existsSync(cached)) {
      const raw = await fetchBuffer(p.heightData);
      if (!raw) {
        console.warn(`  ! висоти ${p.id}: ${p.heightData} недоступні`);
        continue;
      }
      await ensureDir(cached);
      await writeFile(cached, gzipSync(encodeGrid(JSON.parse(raw.toString("utf8")) as unknown[][]), { level: 9 }));
    }
    const dest = join(out, webHeightsPath(p.id));
    await ensureDir(dest);
    await copyFile(cached, dest);
    bundled.add(p.id);
  }
  console.log(`висоти: ${bundled.size} терен(ів)`);
}

async function buildTiles(): Promise<void> {
  for (const [id, minLod] of Object.entries(WEB_MIRROR_MIN_LOD)) {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset?.tiles) continue;
    const list = onlineTileList(preset.sizeX, preset.sizeZ, preset.tiles.maxLod, minLod);
    let next = 0;
    let have = 0;
    let missing = 0;
    const worker = async (): Promise<void> => {
      for (;;) {
        const i = next++;
        if (i >= list.length) return;
        const c = list[i];
        const rel = mirroredTilePath(id, c.lod, c.x, c.y);
        const cached = join(cache, rel);
        let ok = existsSync(cached);
        if (!ok) {
          const buf = await fetchBuffer(tileUrl(preset.tiles!.base, c.lod, c.x, c.y));
          if (buf) {
            await ensureDir(cached);
            await writeFile(cached, buf);
            ok = true;
          }
        }
        if (!ok) {
          missing++;
          continue;
        }
        const dest = join(out, rel);
        await ensureDir(dest);
        await copyFile(cached, dest);
        have++;
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log(`тайли ${id} (LOD ≥ ${minLod}): ${have} з ${list.length}${missing ? `, відсутні: ${missing}` : ""}`);
  }
}

if (!existsSync(join(out, "index.html"))) {
  console.error("Нема out/web/index.html: спершу vite build --config vite.web.config.ts");
  process.exit(1);
}
await mkdir(cache, { recursive: true });
await buildHeights();
if (process.env.WEB_SKIP_TILES === "1") console.log("тайли пропущено (WEB_SKIP_TILES=1)");
else await buildTiles();
// на Pages без Jekyll: файли з підкресленням і так не потрібні, але вимикаємо обробку явно
await writeFile(join(out, ".nojekyll"), "");
console.log("готово: out/web");
