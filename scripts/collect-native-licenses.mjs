// Collects the license/copyright texts of the native components bundled in sharp's libvips package
// (versions from legal/native/sharp-libvips-*-versions.json) from their upstream repositories.
//   node scripts/collect-native-licenses.mjs
// Writes legal/native/component-licenses/<component>__<file>.txt and legal/native/component-licenses/INDEX.md
// (source URL, version tag and SHA-256 of every file). Components or files that cannot be fetched are listed
// in the index; nothing is silently skipped.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "legal/native/component-licenses");
const versions = JSON.parse(readFileSync(join(root, "legal/native/sharp-0.35.5-win32-x64-versions.json"), "utf8"));
mkdirSync(outDir, { recursive: true });

const gh = (repo, ref, path) => `https://raw.githubusercontent.com/${repo}/${ref}/${path}`;
const fdo = (proj, ref, path) => `https://gitlab.freedesktop.org/${proj}/-/raw/${ref}/${path}`;
const gnome = (proj, ref, path) => `https://gitlab.gnome.org/${proj}/-/raw/${ref}/${path}`;
const gs = (host, proj, ref, path) => `https://${host}.googlesource.com/${proj}/+/${ref}/${path}?format=TEXT`;

// component -> { key in versions.json, files: [ [label, [candidate urls...]] ] }
const v = versions;
const C = {
  aom: { key: "aom", files: [["LICENSE", [gs("aomedia", "aom", `refs/tags/v${v.aom}`, "LICENSE")]], ["PATENTS", [gs("aomedia", "aom", `refs/tags/v${v.aom}`, "PATENTS")]]] },
  libarchive: { key: "archive", files: [["COPYING", [gh("libarchive/libarchive", `v${v.archive}`, "COPYING")]]] },
  cairo: { key: "cairo", files: [["COPYING", [fdo("cairo/cairo", v.cairo, "COPYING")]], ["COPYING-LGPL-2.1", [fdo("cairo/cairo", v.cairo, "COPYING-LGPL-2.1")]], ["COPYING-MPL-1.1", [fdo("cairo/cairo", v.cairo, "COPYING-MPL-1.1")]]] },
  cgif: { key: "cgif", files: [["LICENSE", [gh("dloebl/cgif", `v${v.cgif}`, "LICENSE")]]] },
  libexif: { key: "exif", files: [["COPYING", [gh("libexif/libexif", `v${v.exif}`, "COPYING"), gh("libexif/libexif", `libexif-${v.exif.replaceAll(".", "_")}-release`, "COPYING")]]] },
  expat: { key: "expat", files: [["COPYING", [gh("libexpat/libexpat", `R_${v.expat.replaceAll(".", "_")}`, "expat/COPYING")]]] },
  libffi: { key: "ffi", files: [["LICENSE", [gh("libffi/libffi", `v${v.ffi}`, "LICENSE")]]] },
  fontconfig: { key: "fontconfig", files: [["COPYING", [fdo("fontconfig/fontconfig", v.fontconfig, "COPYING")]]] },
  freetype: { key: "freetype", files: [["FTL.TXT", [fdo("freetype/freetype", `VER-${v.freetype.replaceAll(".", "-")}`, "docs/FTL.TXT")]]] },
  fribidi: { key: "fribidi", files: [["COPYING", [gh("fribidi/fribidi", `v${v.fribidi}`, "COPYING")]]] },
  // glib's COPYING is a symlink to LICENSES/LGPL-2.1-or-later.txt, so the real file is fetched
  glib: { key: "glib", files: [["LGPL-2.1-or-later", [gnome("GNOME/glib", v.glib, "LICENSES/LGPL-2.1-or-later.txt")]]] },
  harfbuzz: { key: "harfbuzz", files: [["COPYING", [gh("harfbuzz/harfbuzz", v.harfbuzz, "COPYING")]]] },
  libheif: { key: "heif", files: [["COPYING", [gh("strukturag/libheif", `v${v.heif}`, "COPYING")]]] },
  highway: { key: "highway", files: [["LICENSE", [gh("google/highway", v.highway, "LICENSE")]]] },
  libimagequant: { key: "imagequant", files: [["COPYRIGHT", [gh("lovell/libimagequant", v.imagequant, "COPYRIGHT"), gh("lovell/libimagequant", "main", "COPYRIGHT")]]] },
  lcms: { key: "lcms", files: [["LICENSE", [gh("mm2/Little-CMS", `lcms${v.lcms}`, "LICENSE")]]] },
  mozjpeg: { key: "mozjpeg", files: [["LICENSE.md", [gh("mozilla/mozjpeg", v.mozjpeg, "LICENSE.md")]]] },
  pango: { key: "pango", files: [["COPYING", [gnome("GNOME/pango", v.pango, "COPYING")]]] },
  pixman: { key: "pixman", files: [["COPYING", [fdo("pixman/pixman", `pixman-${v.pixman}`, "COPYING")]]] },
  libpng: { key: "png", files: [["LICENSE", [gh("pnggroup/libpng", `v${v.png}`, "LICENSE")]]] },
  "proxy-libintl": { key: "proxy-libintl", files: [["COPYING", [gh("frida/proxy-libintl", v["proxy-libintl"], "COPYING")]]] },
  librsvg: { key: "rsvg", files: [["COPYING.LIB", [gnome("GNOME/librsvg", v.rsvg, "COPYING.LIB")]]] },
  libtiff: { key: "tiff", files: [["LICENSE.md", [`https://gitlab.com/libtiff/libtiff/-/raw/v${v.tiff}/LICENSE.md`]]] },
  libultrahdr: { key: "uhdr", files: [["LICENSE", [gh("google/libultrahdr", `v${v.uhdr}`, "LICENSE")]]] },
  libvips: { key: "vips", files: [["LICENSE", [gh("libvips/libvips", `v${v.vips}`, "LICENSE")]]] },
  libwebp: { key: "webp", files: [["COPYING", [gs("chromium", "webm/libwebp", `refs/tags/v${v.webp}`, "COPYING")]], ["PATENTS", [gs("chromium", "webm/libwebp", `refs/tags/v${v.webp}`, "PATENTS")]]] },
  libxml2: { key: "xml2", files: [["Copyright", [gnome("GNOME/libxml2", `v${v.xml2}`, "Copyright")]]] },
  "zlib-ng": { key: "zlib-ng", files: [["LICENSE.md", [gh("zlib-ng/zlib-ng", v["zlib-ng"], "LICENSE.md")]]] }
};

async function get(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = url.endsWith("?format=TEXT") ? Buffer.from(await res.text(), "base64").toString("utf8") : await res.text();
  if (!text.trim()) throw new Error("empty");
  return text;
}

const index = ["# Native component license texts", "", "Fetched by `scripts/collect-native-licenses.mjs` from the upstream repositories at the versions recorded in", "`sharp-0.35.5-win32-x64-versions.json`. Files are stored verbatim; the SHA-256 is of the stored bytes.", "", "| Component | Version | File | Source | SHA-256 |", "| --- | --- | --- | --- | --- |"];
const failed = [];
for (const [name, def] of Object.entries(C)) {
  const ver = v[def.key];
  for (const [label, urls] of def.files) {
    let done = false;
    let lastErr = "";
    for (const url of urls) {
      try {
        const text = await get(url);
        const file = `${name}__${label}.txt`;
        writeFileSync(join(outDir, file), text);
        const sha = createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
        index.push(`| ${name} | ${ver} | ${label} | ${url.replace("?format=TEXT", "")} | \`${sha.slice(0, 16)}…\` |`);
        done = true;
        break;
      } catch (e) {
        lastErr = String(e.message ?? e);
      }
    }
    if (!done) failed.push(`${name} ${label}: ${urls[0]} (${lastErr})`);
  }
}
index.push("", "## Not fetched", "", failed.length ? failed.map((f) => `- ${f}`).join("\n") : "None.", "");
writeFileSync(join(outDir, "INDEX.md"), index.join("\n"));
console.log(`done; ${failed.length} not fetched`);
for (const f of failed) console.log("  !", f);
