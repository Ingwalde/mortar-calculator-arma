# Native components and release requirements

## Scope

The npm notice collector covers installed JavaScript/runtime packages and their
supplied notices. It does not prove complete native-binary license compliance.
Desktop uses sharp; web and Capacitor do not execute sharp/libvips.

Recorded versions:

- sharp: `0.35.5` (Apache-2.0).
- Linux x64 libvips npm bundle: `@img/sharp-libvips-linux-x64@1.3.4`.
- Windows x64 package inspected: `@img/sharp-win32-x64@0.35.5`.
- libvips in these inspected packages: `8.18.7`.
- Exact Linux component versions: `native/sharp-libvips-1.3.4-linux-x64-versions.json`.
- Exact Windows component versions: `native/sharp-0.35.5-win32-x64-versions.json`.
- Upstream component/license table: `native/sharp-libvips-1.3.4-NOTICES.md`.

The native bundle declares LGPLv3 (via the later-version option), MPL-1.1,
MIT/BSD and special font/image-codec licenses. The bundled GPL/LGPL texts apply
to those native components, not to the independent application code.

## Sources and build recipes

- [sharp v0.35.5](https://github.com/lovell/sharp/tree/v0.35.5).
- [sharp-libvips v1.3.4](https://github.com/lovell/sharp-libvips/tree/v1.3.4):
  `versions.properties`, `build/posix.sh`, `build/win.sh` and platform files.
- The POSIX build script identifies source archives and patches for each
  component. Rebuilding only vanilla libvips does not reproduce this bundle.
- Windows uses [build-win64-mxe v8.18.7](https://github.com/libvips/build-win64-mxe/releases/tag/v8.18.7),
  specifically `vips-dev-x64-web-8.18.7-static.zip` for the inspected x64 package.
  Inspect its MXE recipes, patches and dependencies when preparing sources.

These are source references, not a claim that a complete corresponding-source
archive has already been supplied with a release.

## Required before distributing desktop binaries

1. Collect all actual native-component notices, copyright statements and license
   texts from the exact build. Include codec/font notices, not just a list of
   SPDX names. Confirm the set for each target OS/architecture.
   Status: the license/copyright files of all 28 components listed for Windows x64
   are stored in `native/component-licenses/` (`INDEX.md` there lists source URL, tag
   and SHA-256; produced by `scripts/collect-native-licenses.mjs`). They are taken
   from the upstream repositories at the recorded tags (libimagequant: default
   branch, no file at its tag), not extracted from the binary. Linux and other
   targets are not covered.
2. Supply the corresponding sources, patches and build instructions required by
   LGPL/MPL using a compliant distribution method. A generic upstream homepage
   or this document alone is not the source delivery. Status: not done; the
   method (for example a written offer or a source archive attached to each
   release) is still to be chosen.
3. Verify that users can replace the LGPL shared libraries with compatible
   modified builds. `asarUnpack` keeps sharp and `@img` outside the archive,
   but this alone is not a successful replacement test. Check the actual DLL/
   shared-library loading and packaging/signing behavior on the target OS.
4. Retain Electron's `LICENSE.electron.txt` and `LICENSES.chromium.html` from
   the exact downloaded Electron distribution and verify they reach the final
   installer/portable package.

The application license explicitly preserves LGPL modification/replacement
and debugging rights. No custom noncommercial restriction is imposed on the
third-party libraries themselves.

## Android

Capacitor package notices are included by the npm collector. AndroidX and other
Gradle runtime dependencies must additionally be inventoried from the resolved
release dependency graph, with their notices included in the APK. The generic
Apache-2.0 text alone is not evidence that the graph has been reviewed.

## License text sources

- `licenses/Apache-2.0.txt`: sharp's distributed LICENSE.
- `licenses/GPL-3.0-only.txt`, `licenses/LGPL-3.0-only.txt`,
  `licenses/MPL-1.1.txt`: SPDX license-list-data text files, obtained 2026-10-20.
  The LGPL file includes the incorporated GPL terms.
- Native component notices: sharp-libvips tag `v1.3.4`.
- `native/libvips-8.18.7-upstream-LICENSE.txt`: unmodified LGPL-2.1 text from
  `vips-dev-x64-web-8.18.7-static.zip` (the archive's SHA-256 is
  `a736af61d3b46499760efa606e469cb14e060445b1f6fd36a1fa2e75009e1197`; the SHA-256 of
  the `LICENSE` file inside it is
  `dc626520dcd53a22f727af3ee42c770e56c97a64fe3adb063799d8ab032fe551`).
  The upstream archive was inspected; it does not supply a complete set of
  per-component notice files, so it does not close item 1 above.

License texts are preserved verbatim. An upstream "or later" grant remains
available even where the file contains the text of one particular version.

## Verification log

Checked on 2026-10-20 (Windows x64 build host, sharp 0.35.5):

- `licenses/GPL-3.0-only.txt`, `LGPL-3.0-only.txt` and `MPL-1.1.txt` are byte-identical
  to the SPDX license-list-data files; `Apache-2.0.txt` is identical to the
  `LICENSE` distributed in the installed `sharp` package.
- `native/sharp-0.35.5-win32-x64-versions.json` is identical to `versions.json` in the
  installed `@img/sharp-win32-x64@0.35.5`; `native/sharp-libvips-1.3.4-linux-x64-versions.json`
  is identical to `versions.json` in the published `@img/sharp-libvips-linux-x64@1.3.4`
  tarball.
- The `libvips-42.dll` shipped in `@img/sharp-win32-x64` is byte-identical (SHA-256
  `06dab07cc3867485...`, 19,018,240 bytes) to `vips-dev-8.18/bin/libvips-42.dll` in the
  `vips-dev-x64-web-8.18.7-static.zip` release named above. This ties the Windows
  library to that upstream build; it does not supply its corresponding sources.
- After `npm run pack`, `dist/win-unpacked` contains `LICENSE.electron.txt`,
  `LICENSES.chromium.html` and `resources/legal/` (application license, notices,
  the files in `legal/` and the generated npm notices). `npm run smoke` passed on
  the unpacked build. `npm run dist:win` also built the NSIS installer and the
  portable executable; both were unpacked with 7-Zip and contain the same
  `LICENSE.electron.txt`, `LICENSES.chromium.html`, `resources/legal/` files
  (identical SHA-256 to `dist/win-unpacked`) and the three separate sharp/libvips
  files listed below. (`native/component-licenses/` was added after that build; a later
  `npm run pack` puts all 33 of its files into `dist/win-unpacked/resources/legal/native/`.
  The installer and portable were not rebuilt afterwards.)
- `libvips-42.dll`, `libvips-cpp-8.18.7.dll` and the sharp `.node` module sit as separate
  files in `resources/app.asar.unpacked/node_modules/@img/sharp-win32-x64/lib`, outside
  the archive. On a copy of that tree sharp loaded and produced an image with the
  original DLLs and with `libvips-42.dll` replaced by the upstream release DLL
  above; a truncated `libvips-42.dll` made the module fail to load. This shows the
  library is loaded from a replaceable file. It is not a test with a modified
  libvips build and does not close item 2 or the signing question in item 3.
  Unsigned builds were used (no signing certificate is configured).
