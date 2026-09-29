// Експеримент: нарізка реального 32768x32768 PNG (maps/everon_sat_z7_full.png) на піраміду
// тайлів через sharp().tile({layout:'google'}) — перевіряємо швидкість, пам'ять і структуру
// виводу перед тим, як переносити це у src/main/tiles/import.ts.
import { fileURLToPath } from "node:url";
import { readdirSync, statSync } from "node:fs";
import sharp from "sharp";
import { region } from "../src/core/geometry.js";

const SRC = fileURLToPath(new URL("../maps/everon_sat_z7_full.png", import.meta.url));
const OUT = fileURLToPath(new URL("../.tile-test/everon", import.meta.url));

const t0 = Date.now();
const meta = await sharp(SRC, { limitInputPixels: false }).metadata();
console.log(`джерело: ${meta.width}x${meta.height}, ${(statSync(SRC).size / 1e6).toFixed(0)} МБ`);

const mapSizeX = 12800;
const mapSizeZ = 12800;
const r = region({
  calib: { mode: "size", size: mapSizeX, sizeZ: mapSizeZ, a: null, b: null },
  imgW: meta.width,
  imgH: meta.height,
  mapSize: mapSizeX,
  mapSizeZ: mapSizeZ
});
console.log(`регіон після auto-crop: ${r.w}x${r.h} (з ${meta.width}x${meta.height})`);

let pipeline = sharp(SRC, { limitInputPixels: false, sequentialRead: true });
if (r.w !== meta.width || r.h !== meta.height) {
  pipeline = pipeline.extract({ left: 0, top: 0, width: Math.round(r.w), height: Math.round(r.h) });
}

let lastPct = -1;
pipeline.on("info", (info) => console.log("info:", JSON.stringify(info)));

await pipeline
  .tile({ size: 256, layout: "google" })
  .toFile(OUT);

console.log(`готово за ${((Date.now() - t0) / 1000).toFixed(1)} с`);

// огляд структури виводу: {OUT}/{z}/{x}/{y}.jpg
const levels = readdirSync(OUT).filter((d) => /^\d+$/.test(d)).map(Number).sort((a, b) => a - b);
console.log("рівні:", levels);
for (const z of levels) {
  const cols = readdirSync(`${OUT}/${z}`).filter((d) => /^\d+$/.test(d));
  const firstCol = cols[0];
  const rows = readdirSync(`${OUT}/${z}/${firstCol}`);
  console.log(`  z=${z}: ${cols.length} колонок, приклад файлів у колонці ${firstCol}:`, rows.slice(0, 3));
}
const top = levels[levels.length - 1];
const topMeta = await sharp(`${OUT}/${top}/0/0.jpg`).metadata();
console.log(`тайл верхнього рівня z=${top}: ${topMeta.width}x${topMeta.height}`);
