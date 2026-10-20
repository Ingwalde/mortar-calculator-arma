// Collects the source code that has to accompany the Windows desktop binaries for the LGPL/MPL native components
// (see legal/NATIVE-COMPONENTS.md and legal/native/SOURCE-OFFER.md):
//   node scripts/collect-native-sources.mjs [outDir]      (default: dist/native-sources)
// Downloads the upstream source archives of the LGPL/MPL components named in
// legal/native/sharp-0.35.5-win32-x64-versions.json, the Windows build recipes (libvips/build-win64-mxe, with its
// patches), the MXE fork those recipes build on and sharp-libvips, then writes SHA256SUMS and SOURCES.md.
// Release assets: zip the output directory and attach it to the release next to the installers.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv[2] ?? join(root, "dist/native-sources");
const v = JSON.parse(readFileSync(join(root, "legal/native/sharp-0.35.5-win32-x64-versions.json"), "utf8"));
mkdirSync(outDir, { recursive: true });

const gh = (repo, ref) => `https://codeload.github.com/${repo}/tar.gz/${ref}`;
const fdo = (proj, ref) => `https://gitlab.freedesktop.org/${proj}/-/archive/${ref}/${proj.split("/").pop()}-${ref}.tar.gz`;
const gnome = (proj, ref) => `https://gitlab.gnome.org/${proj}/-/archive/${ref}/${proj.split("/").pop()}-${ref}.tar.gz`;

const rel = (url) => url; // release tarball (.tar.xz) used when the repository archive endpoint refuses the request
const minor = (ver) => ver.split(".").slice(0, 2).join(".");

// name, license, version, candidate URLs
const items = [
  ["libvips", "LGPL-2.1-or-later", v.vips, [gh("libvips/libvips", `v${v.vips}`)]],
  ["glib", "LGPL-2.1-or-later", v.glib, [gnome("GNOME/glib", v.glib), rel(`https://download.gnome.org/sources/glib/${minor(v.glib)}/glib-${v.glib}.tar.xz`)]],
  ["pango", "LGPL-2.1-or-later", v.pango, [gnome("GNOME/pango", v.pango)]],
  ["librsvg", "LGPL-2.1-or-later", v.rsvg, [gnome("GNOME/librsvg", v.rsvg), rel(`https://download.gnome.org/sources/librsvg/${minor(v.rsvg)}/librsvg-${v.rsvg}.tar.xz`)]],
  ["cairo", "LGPL-2.1 or MPL-1.1", v.cairo, [fdo("cairo/cairo", v.cairo), rel(`https://cairographics.org/releases/cairo-${v.cairo}.tar.xz`)]],
  ["fribidi", "LGPL-2.1-or-later", v.fribidi, [gh("fribidi/fribidi", `v${v.fribidi}`)]],
  ["libexif", "LGPL-2.1-or-later", v.exif, [gh("libexif/libexif", `v${v.exif}`), gh("libexif/libexif", `libexif-${v.exif.replaceAll(".", "_")}-release`)]],
  ["libheif", "LGPL-3.0-or-later", v.heif, [gh("strukturag/libheif", `v${v.heif}`)]],
  ["proxy-libintl", "LGPL-2.1-or-later", v["proxy-libintl"], [gh("frida/proxy-libintl", v["proxy-libintl"]), gh("frida/proxy-libintl", `v${v["proxy-libintl"]}`)]],
  // build recipes and patches for the Windows binaries, and the toolchain environment they run in
  ["build-win64-mxe", "recipes and patches (libvips/build-win64-mxe)", "v8.18.7", [gh("libvips/build-win64-mxe", "v8.18.7")]],
  ["mxe-llvm-mingw", "MXE fork used by the recipes (kleisauke/mxe, branch llvm-mingw-20260924)", "llvm-mingw-20260924", [gh("kleisauke/mxe", "llvm-mingw-20260924")]],
  ["sharp-libvips", "packaging of the libvips bundle (lovell/sharp-libvips)", "v1.3.4", [gh("lovell/sharp-libvips", "v1.3.4")]]
];

const rows = [];
const sums = [];
const failed = [];
for (const [name, lic, ver, urls] of items) {
  let ok = false;
  let err = "";
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1024) throw new Error("too small");
      const file = `${name}-${ver}${url.endsWith(".tar.xz") ? ".tar.xz" : ".tar.gz"}`;
      writeFileSync(join(outDir, file), buf);
      const sha = createHash("sha256").update(buf).digest("hex");
      sums.push(`${sha}  ${file}`);
      rows.push(`| ${name} | ${ver} | ${lic} | ${url} | ${(buf.length / 1048576).toFixed(1)} MB | \`${sha}\` |`);
      ok = true;
      break;
    } catch (e) {
      err = String(e.message ?? e);
    }
  }
  if (!ok) failed.push(`${name} ${ver}: ${urls[0]} (${err})`);
  console.log(`${ok ? "ok  " : "FAIL"} ${name} ${ver}`);
}
writeFileSync(join(outDir, "SHA256SUMS"), sums.join("\n") + "\n");
writeFileSync(
  join(outDir, "SOURCES.md"),
  [
    "# Corresponding source for the native libraries",
    "",
    "Source archives of the LGPL/MPL components of the libvips bundle used by the Windows x64 build of Mortar Tablet",
    "(`@img/sharp-win32-x64` 0.35.5, libvips 8.18.7), plus the build recipes and patches. Produced by",
    "`scripts/collect-native-sources.mjs`. Build instructions: `legal/native/REBUILD-LIBVIPS.md`.",
    "",
    "| Component | Version | License | Downloaded from | Size | SHA-256 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "Other dependencies of the bundle (permissive licenses) are fetched by the recipes from the URLs and checksums",
    "pinned in `build-win64-mxe/build/*.mk` and in the MXE fork's `src/*.mk`.",
    "",
    "## Not downloaded",
    "",
    failed.length ? failed.map((f) => `- ${f}`).join("\n") : "None.",
    ""
  ].join("\n")
);
console.log(`done; ${failed.length} failed`);
for (const f of failed) console.log("  !", f);
process.exitCode = failed.length ? 1 : 0;
