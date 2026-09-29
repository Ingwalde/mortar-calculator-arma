// Візуальна перевірка прив'язки на реальному повнорозмірному знімку Everon
// (maps/everon_sat_z7_full.png, 32768x32768) замість онлайн-тайлів: зменшуємо картинку
// й малюємо мітки пунктів через ту саму pxFromWorld(), що використовує застосунок.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { PRESETS } from "../src/core/terrains.js";
import { pxFromWorld } from "../src/core/geometry.js";

const OUT_DIR = new URL("../.check-places/", import.meta.url);
mkdirSync(OUT_DIR, { recursive: true });

const SRC = fileURLToPath(new URL("../maps/everon_sat_z7_full.png", import.meta.url));
const PREVIEW_W = 2048;

const t = PRESETS.find((p) => p.id === "everon");
const meta = await sharp(SRC, { limitInputPixels: false }).metadata();
console.log(`джерело: ${meta.width}x${meta.height}`);

const scale = PREVIEW_W / meta.width;
const previewH = Math.round(meta.height * scale);

const geometry = {
  calib: { mode: "size", size: t.sizeX, sizeZ: t.sizeZ, a: null, b: null },
  imgW: PREVIEW_W,
  imgH: previewH,
  mapSize: t.sizeX,
  mapSizeZ: t.sizeZ
};

const markers = t.places
  .map((p) => {
    const { px, py } = pxFromWorld(geometry, p.x, p.z);
    return `<circle cx="${px}" cy="${py}" r="5" fill="red" stroke="white" stroke-width="1.5"/>
            <text x="${px + 7}" y="${py + 4}" font-size="14" fill="white" stroke="black" stroke-width="2.5" paint-order="stroke">${p.name}</text>`;
  })
  .join("\n");
const svg = Buffer.from(`<svg width="${PREVIEW_W}" height="${previewH}" xmlns="http://www.w3.org/2000/svg">${markers}</svg>`);

const outPath = fileURLToPath(new URL("everon-local.png", OUT_DIR));
await sharp(SRC, { limitInputPixels: false })
  .resize(PREVIEW_W, previewH)
  .composite([{ input: svg }])
  .png()
  .toFile(outPath);
console.log("->", outPath);
