// Робить значки ПК-застосунку (build/icon.png, build/icon.ico) з веб-іконки застосунку.
//   node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SRC = fileURLToPath(new URL("../src/renderer/public/icons/icon-512.png", import.meta.url));
const OUT = new URL("../build/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = [];
for (const s of sizes) pngs.push({ s, data: await sharp(SRC).resize(s, s).png().toBuffer() });

// ICO з PNG-вмістом (Windows підтримує це для всіх розмірів)
const head = Buffer.alloc(6);
head.writeUInt16LE(0, 0);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(pngs.length, 4);
let offset = 6 + 16 * pngs.length;
const entries = pngs.map(({ s, data }) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s >= 256 ? 0 : s, 0);
  e.writeUInt8(s >= 256 ? 0 : s, 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(data.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += data.length;
  return e;
});
writeFileSync(new URL("icon.ico", OUT), Buffer.concat([head, ...entries, ...pngs.map((p) => p.data)]));
writeFileSync(new URL("icon.png", OUT), await sharp(SRC).resize(512, 512).png().toBuffer());
console.log("build/icon.ico, build/icon.png");
