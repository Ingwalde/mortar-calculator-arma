// Генерує іконки веб-застосунку (головний екран телефона) із SVG: node scripts/make-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT = new URL("../src/renderer/public/icons/", import.meta.url);
mkdirSync(OUT, { recursive: true });

// Прицільна сітка на темному тлі; вміст у центральних ~70% — безпечна зона для maskable.
const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#161c18"/>
  <g fill="none" stroke="#6ee7a8" stroke-width="22" stroke-linecap="round">
    <circle cx="256" cy="256" r="118"/>
    <path d="M256 96v70M256 346v70M96 256h70M346 256h70"/>
  </g>
  <circle cx="256" cy="256" r="26" fill="#f0975a" stroke="#fff" stroke-width="8"/>
</svg>`;

for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  await sharp(Buffer.from(svg(size))).png().toFile(new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  console.log("written", name);
}
