// Значки й заставка Android із src/renderer/public/icons/icon-512.png (sharp).
//   node scripts/make-android-icons.mjs
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const res = join(root, "android", "app", "src", "main", "res");
const src = readFileSync(join(root, "src", "renderer", "public", "icons", "icon-512.png"));
const BG = "#161c18";

// щільність -> розмір значка (48 dp) і розмір шару adaptive-значка (108 dp)
const densities = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };

for (const [d, [icon, layer]] of Object.entries(densities)) {
  const dir = join(res, `mipmap-${d}`);
  const square = await sharp(src).resize(icon, icon).png().toBuffer();
  writeFileSync(join(dir, "ic_launcher.png"), square);
  const mask = Buffer.from(`<svg width="${icon}" height="${icon}"><circle cx="${icon / 2}" cy="${icon / 2}" r="${icon / 2}"/></svg>`);
  writeFileSync(join(dir, "ic_launcher_round.png"), await sharp(square).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer());
  // adaptive foreground: значок у «безпечній зоні» (66 % шару), решту закриває фон
  const inner = Math.round(layer * 0.62);
  const fg = await sharp(src).resize(inner, inner).png().toBuffer();
  writeFileSync(
    join(dir, "ic_launcher_foreground.png"),
    await sharp({ create: { width: layer, height: layer, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: fg, gravity: "centre" }])
      .png()
      .toBuffer()
  );
}

writeFileSync(
  join(res, "values", "ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`
);
writeFileSync(
  join(res, "values", "colors.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="colorPrimary">#3F51B5</color>\n    <color name="colorPrimaryDark">#303F9F</color>\n    <color name="colorAccent">#FF4081</color>\n    <color name="launch_bg">${BG}</color>\n</resources>\n`
);
// заставка запуску — суцільний колір фону замість стандартної картинки Capacitor
let styles = readFileSync(join(res, "values", "styles.xml"), "utf8");
styles = styles.replace("@drawable/splash", "@color/launch_bg");
writeFileSync(join(res, "values", "styles.xml"), styles);
for (const dir of ["drawable-land-hdpi", "drawable-land-mdpi", "drawable-land-xhdpi", "drawable-land-xxhdpi", "drawable-land-xxxhdpi",
  "drawable-port-hdpi", "drawable-port-mdpi", "drawable-port-xhdpi", "drawable-port-xxhdpi", "drawable-port-xxxhdpi"]) {
  rmSync(join(res, dir), { recursive: true, force: true });
}
rmSync(join(res, "drawable", "splash.png"), { force: true });
console.log("готово");
