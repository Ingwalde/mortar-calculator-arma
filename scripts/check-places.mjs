// Візуальна перевірка прив'язки: для Everon і Arland качаємо реальні онлайн-тайли
// (reforger.recoil.org), склеюємо їх у одне зображення й малюємо мітки поверх — на місцях
// pxFromWorld() для координат places[] (ті самі, що вже були в прототипі, з EnfusionMapMaker).
// Якщо назви пунктів лягають на свої міста на зображенні — прив'язка коректна.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { PRESETS } from "../src/core/terrains.js";
import { tileIndexForWorld, tileUrl, tileWorldBounds } from "../src/core/onlineTiles.js";

const OUT_DIR = new URL("../.check-places/", import.meta.url);
mkdirSync(OUT_DIR, { recursive: true });

async function fetchTile(base, lod, x, y) {
  const url = tileUrl(base, lod, x, y);
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function buildMosaic(terrainId, lod) {
  const t = PRESETS.find((p) => p.id === terrainId);
  if (!t || !t.tiles) throw new Error(`Терен ${terrainId} без онлайн-тайлів`);

  const min = tileIndexForWorld(0, 0, lod);
  const max = tileIndexForWorld(t.sizeX - 1, t.sizeZ - 1, lod);
  const cols = max.x - min.x + 1;
  const rows = max.y - min.y + 1;
  console.log(`${terrainId}: LOD${lod}, тайлів ${cols}x${rows} (x ${min.x}-${max.x}, y ${min.y}-${max.y})`);

  const fetched = [];
  for (let ty = min.y; ty <= max.y; ty++) {
    for (let tx = min.x; tx <= max.x; tx++) {
      const buf = await fetchTile(t.tiles.base, lod, tx, ty);
      if (!buf) {
        console.warn(`  тайл ${lod}/${tx}/${ty} відсутній (404) — лишаю порожнім`);
        continue;
      }
      fetched.push({ tx, ty, buf });
    }
  }
  if (!fetched.length) throw new Error(`Жоден тайл ${terrainId} LOD${lod} не завантажився`);
  const TS = (await sharp(fetched[0].buf).metadata()).width;
  const tiles = fetched.map(({ tx, ty, buf }) => ({
    input: buf,
    left: (tx - min.x) * TS,
    top: (max.y - ty) * TS // Z росте на північ -> більший ty має бути ВИЩЕ (менший row) на зображенні
  }));

  const worldX0 = tileWorldBounds(min.x, min.y, lod).x0;
  const worldZ1 = tileWorldBounds(min.x, max.y, lod).z1; // верх зображення = максимальний Z
  const span = tileWorldBounds(min.x, min.y, lod).x1 - worldX0;
  const pxPerM = TS / span;

  console.log(`  тайл-розмір виявлено: ${TS}px, зібрано ${tiles.length}/${cols * rows} тайлів`);
  const canvas = sharp({
    create: { width: cols * TS, height: rows * TS, channels: 3, background: "#ff00ff" }
  }).composite(tiles);

  const markers = (t.places || [])
    .map((p) => {
      const px = (p.x - worldX0) * pxPerM;
      const py = (worldZ1 - p.z) * pxPerM;
      return `<circle cx="${px}" cy="${py}" r="6" fill="red" stroke="white" stroke-width="2"/>
              <text x="${px + 9}" y="${py + 4}" font-size="20" fill="white" stroke="black" stroke-width="3" paint-order="stroke">${p.name}</text>`;
    })
    .join("\n");
  const svg = Buffer.from(
    `<svg width="${cols * TS}" height="${rows * TS}" xmlns="http://www.w3.org/2000/svg">${markers}</svg>`
  );

  const outPath = fileURLToPath(new URL(`${terrainId}.png`, OUT_DIR));
  await canvas.composite([{ input: svg }]).png().toFile(outPath);
  console.log(`  -> ${outPath}`);
}

await buildMosaic("everon", 3);
await buildMosaic("arland", 2);
