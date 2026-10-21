# Noncommercial release preparation

## Completed in this change set

- Noncommercial terms for the author's original code/documentation, with explicit
  exclusions for third-party materials and previously granted MIT rights.
- Application terms displayed with third-party notices in the shared UI.
- Correct Workshop authors; Iron Hold Castle's APL license is confirmed on its public
  Workshop page (version 1.0.3, read 2026-10-20), with the listed dependencies recorded.
- Runtime npm notice collection, including a documented MIT supplement for
  `lazy-val@1.0.5`, whose package and upstream tree omit a separate license file.
- Desktop packaging retains Markdown license files and README licensing information.
- Full GPLv3, LGPLv3 and MPL-1.1 texts, the upstream native component inventory and
  the license files of all 28 Windows x64 native components
  (`legal/native/component-licenses/`).
- Installer and portable Windows packages built and inspected (legal files and
  separate native libraries present); web map archive checked tile by tile.
- Replacement of the libvips library with a rebuilt, modified one
  (`legal/native/REBUILD-LIBVIPS.md`) and the Android build with its Gradle dependency
  and APK validation: verified.
- CI type checking/tests and rebuild triggers for license-file changes.

## Not yet cleared for a new public binary/data release

- Asset provenance in `ASSET-PROVENANCE.md`: for the official outlines, GeNeFRAG
  images/elevations and recoil.org tiles no separate permissions were obtained.
- Corresponding-source delivery for the LGPL/MPL components: method and script are
  in place (`legal/native/SOURCE-OFFER.md`, `scripts/collect-native-sources.mjs`); release 1.0.0
  carries the archive, and every later release must attach its own.
- Technical checks are not a legal opinion on the project-specific noncommercial license.

Existing maps and application behavior are preserved while these items are
reviewed. Do not describe this preparation as completed asset clearance or
as approval for Google Play/App Store distribution. No public release tag is
created by the licensing changes alone.

## Local verification

Checks completed for this change set (and repeated on 2026-10-20 on a Windows x64
host (the branch is based on `6769d03`): `npm run licenses:collect`,
`npm run check` = typecheck, 156 tests, `npm run pack` and `npm run smoke`, and
`npm run build:web` including the external map assets all passed; the checks
below were first recorded for the original change set): TypeScript checks passed, all 156 tests
in 20 files passed, Electron code and standalone Vite web code builds passed.
Both renderer bundles contain the application license, corrected attribution
and generated npm notices. Dependency versions were not changed.

Windows installer and portable executable were built with `npm run dist:win` on
2026-10-20 (unsigned) and their contents inspected; they were not installed or run
beyond `npm run smoke` on the unpacked build.
Android APKs were not built (Java 17 is installed; the project needs Java 21
and an Android SDK); the Android workflow was not run because it publishes a
signed APK as an artifact.

```sh
npm ci --ignore-scripts
npm run licenses:collect
npm run typecheck
npm test
npm run build
npx vite build --config vite.web.config.ts
```

The last command verifies the web code bundle; `npm run build:web` additionally
fetches/copies external map assets and must be checked before publishing the
actual site or APK. Direct Vite invocations require `licenses:collect` first;
the npm build/dev/package scripts run it automatically.

Before a binary release, use `npm run pack` and `npm run smoke` on a supported
Windows build environment, inspect the final package contents, and verify the
native source/replacement requirements. Android additionally needs the SDK,
Java 21, Gradle resolution and the owner's release-signing configuration.
