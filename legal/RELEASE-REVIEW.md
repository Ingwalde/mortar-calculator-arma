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
- Full GPLv3, LGPLv3 and MPL-1.1 texts and the upstream native component inventory.
- CI type checking/tests and rebuild triggers for license-file changes.

## Not yet cleared for a new public binary/data release

- Asset provenance issues in `ASSET-PROVENANCE.md`: the Novyinovka map image, which
  depicts trench objects from an APL-ND dependency (kept as is by the owner's
  decision; not cleared), official extracted material and the separate web map
  archive.
- Complete native notices, corresponding-source delivery and a working LGPL
  library-replacement test described in `NATIVE-COMPONENTS.md`.
- Final Windows installer/portable validation and Android Gradle dependency and
  APK validation on the target build environments.
- Legal review of the project-specific noncommercial license if required by
  the publisher; technical checks are not a legal opinion.

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

Windows executables were not built or run here (no Wine/Windows environment).
Android APKs were not built (Java 17 is installed; the project needs Java 21
and an Android SDK). External web map assets were not fetched for this check.

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
