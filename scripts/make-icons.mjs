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

// Заставки запуску iOS (apple-touch-startup-image): темний фон і іконка по центру — замість чорного екрана.
// Розміри — портрет у фізичних пікселях; media-запити в index.html мають збігатися з цим списком.
export const SPLASH = [
  [1320, 2868, 440, 956, 3], [1206, 2622, 402, 874, 3], [1290, 2796, 430, 932, 3], [1179, 2556, 393, 852, 3],
  [1284, 2778, 428, 926, 3], [1170, 2532, 390, 844, 3], [1242, 2688, 414, 896, 3], [1125, 2436, 375, 812, 3],
  [1242, 2208, 414, 736, 3], [828, 1792, 414, 896, 2], [750, 1334, 375, 667, 2]
];
const splashSvg = (w, h) => {
  const icon = Math.round(Math.min(w, h) * 0.26);
  const x = Math.round((w - icon) / 2), y = Math.round((h - icon) / 2);
  const r = Math.round(icon * 0.22);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#161c18"/>
  <svg x="${x}" y="${y}" width="${icon}" height="${icon}" viewBox="0 0 512 512">
    <clipPath id="c"><rect width="512" height="512" rx="${Math.round(512 * 0.22)}"/></clipPath>
    <g clip-path="url(#c)">
      <rect width="512" height="512" fill="#1f2721"/>
      <g fill="none" stroke="#6ee7a8" stroke-width="22" stroke-linecap="round">
        <circle cx="256" cy="256" r="118"/><path d="M256 96v70M256 346v70M96 256h70M346 256h70"/>
      </g>
      <circle cx="256" cy="256" r="26" fill="#f0975a" stroke="#fff" stroke-width="8"/>
    </g>
  </svg>
</svg>`;
};
for (const [w, h] of SPLASH) {
  const name = `splash-${w}x${h}.png`;
  await sharp(Buffer.from(splashSvg(w, h))).png({ compressionLevel: 9 }).toFile(new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  console.log("written", name);
}
