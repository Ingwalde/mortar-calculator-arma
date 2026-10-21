# Written offer of source code for the native libraries

Mortar Tablet's desktop builds (Windows x64, macOS arm64 and x64, Linux x64) contain native libraries that are licensed under the
GNU Lesser General Public License (libvips, glib, pango, librsvg, fribidi, libexif, libheif,
proxy-libintl) and the Mozilla Public License 1.1 or the LGPL (cairo). They are part of the
`sharp` image library's prebuilt libvips bundle (libvips 8.18.7): `@img/sharp-win32-x64` 0.35.5 on Windows,
`@img/sharp-libvips-darwin-arm64`, `@img/sharp-libvips-darwin-x64` and `@img/sharp-libvips-linux-x64` 1.3.4 on
macOS and Linux. The component versions of all four bundles are identical; they are in
`legal/native/sharp-0.35.5-win32-x64-versions.json` and `legal/native/sharp-libvips-1.3.4-<platform>-versions.json`,
and the license texts in `legal/native/component-licenses/`.

## What you can obtain

For every desktop release that contains these libraries, the corresponding source is
provided as an archive attached to the same GitHub release
(`https://github.com/Ingwalde/mortar-tablet/releases`), named `MortarTablet-native-sources-<version>.zip`.
It contains:

- the upstream source archives of the LGPL/MPL components at the exact versions listed above;
- `libvips/build-win64-mxe` at tag `v8.18.7`: the recipes, patches and scripts that build the Windows
  libraries, and the MXE fork (`kleisauke/mxe`, branch `llvm-mingw-20260924`) they run on;
- `lovell/sharp-libvips` at tag `v1.3.4`: how the libraries are packaged for `sharp`; for Linux and macOS this
  is also the build recipe (`build/posix.sh`, `platforms/linux-x64/Dockerfile`; macOS is compiled with the same
  script on a macOS machine);
- `SOURCES.md` and `SHA256SUMS`: download addresses and checksums of every file.

The archive is produced by `scripts/collect-native-sources.mjs` from this repository. How to rebuild
the libraries and use your own build is described in `legal/native/REBUILD-LIBVIPS.md`.

## Written offer

If a release you received does not carry that archive, or you cannot download it, open an issue at
`https://github.com/Ingwalde/mortar-tablet/issues` and the source will be provided to you. This offer
is valid for three years from the date the corresponding binary was distributed, and for as long as
the binary remains available from the project.

## Your rights

You may modify these libraries, rebuild them and replace the distributed ones with your build, and
debug such modifications (reverse engineering for that purpose included). This right comes from the
libraries' own licenses and is preserved in the application license. The libraries are kept
as separate files outside the application archive so that they can be replaced:
`resources/app.asar.unpacked/node_modules/@img/sharp-win32-x64/lib/` on Windows and
`.../@img/sharp-libvips-<platform>/lib/` (`libvips-cpp.8.18.7.dylib`, `libvips-cpp.so.8.18.7`) on macOS and Linux.

The application's noncommercial terms apply only to the application's own code and documents and
do not restrict these libraries.

## Status

The release archive has not yet been attached to any release; the first public Windows release
must include it. The script that produces it has been run (all archives downloaded, see
`SOURCES.md` in its output).
