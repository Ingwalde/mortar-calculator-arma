// Launch images for iPhone (apple-touch-startup-image): a plain background colour, no emblem.
// The emblem is drawn once, as the animation of the in-page splash (index.html), so the phone must not show it before.
//   node scripts/make-splash.mjs
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const DIR = fileURLToPath(new URL("../src/renderer/public/icons/", import.meta.url));
const BG = "#161c18";

for (const f of readdirSync(DIR)) {
  const m = /^splash-(\d+)x(\d+)\.png$/.exec(f);
  if (!m) continue;
  const [w, h] = [Number(m[1]), Number(m[2])];
  await sharp({ create: { width: w, height: h, channels: 3, background: BG } }).png({ compressionLevel: 9 }).toFile(DIR + f);
  console.log(f);
}
