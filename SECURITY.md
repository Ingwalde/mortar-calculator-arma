# Security

Threat model: the application runs on the user's PC, in a browser (the site) or on an Android phone, and has no server component.
We trust the operating system and the user; we do not trust content that comes from outside
(imported JSON, images, server responses) and, as defence in depth, the renderer itself.

## What has been done

**The application window**
- The renderer is sandboxed (`sandbox: true`, `contextIsolation`, no `nodeIntegration`); the preload is built as CommonJS
  and exposes only a narrow typed `window.api`.
- A content security policy (CSP) in the built `index.html`: only own scripts, `eval` is forbidden, no embedded plugins, forms or `<base>`.
- Navigation and new windows are forbidden: only `http(s)` links are opened in the system browser; `<webview>` is turned off.
- Page permissions (camera, geolocation, notifications and so on) are denied, except writing to the clipboard.
- Electron fuses: no `ELECTRON_RUN_AS_NODE`, `--inspect` or `NODE_OPTIONS`; code is loaded only from `app.asar`
  with an integrity check. Verified by `npm run smoke`.

**IPC (renderer → main)**: every call is validated, not taken on trust:
- terrain identifiers are only `[A-Za-z0-9_-]{1,64}`, map sizes are within sensible limits;
- a map file is accepted only if the user has just chosen it in the system dialog (the renderer cannot make the main process
  read an arbitrary file);
- images and heights are downloaded only from a URL in the terrain catalogue, only over `https`, with a size limit (4 GB).

## Standalone version and Android

- **The site (PWA) and the APK** work without a server: the state lives only in the device storage, the CSP does not allow third-party scripts; the only external requests are
  the reforger.recoil.org tiles (images) and the check for a new version at api.github.com.
- **Sharing by link/QR:** markers are compressed into the address fragment (they do not go to a server). Unpacking has limits (400 thousand characters, 2 MB unpacked,
  1000 markers), coordinates and names are sanitised, and an import always goes through a confirmation dialog. A terrain id from a foreign link is compared only
  with own keys (`Object.hasOwn`): `__proto__` and similar do not become terrains.
- **Updates:** on Android and the web the app only reports a new version; links from the GitHub API response are opened only if they are https on github.com
  within this repository. On the PC, Windows (installer) and Linux (AppImage) update through `electron-updater`; macOS and the .deb package only
  report a new release and open its page. The Android app opens share links only from this site.
- **Build:** the mod terrain maps are downloaded from a service release with a SHA-256 check (`scripts/web-mod-maps.sha256`) and a check of the paths
  in the tar before unpacking. The APK is signed with a key stored in the repository secrets (a copy of the key is kept outside the repository).

## Known limitations

- **The builds are not code-signed** (Windows and macOS): Windows SmartScreen and macOS Gatekeeper show a warning at the first launch.
  Download only from this repository's [Releases](https://github.com/Ingwalde/mortar-tablet/releases).
- **Automatic updates** trust the releases of this GitHub repository (the hash of the file from `latest.yml` / `latest-linux.yml` is checked, but not the publisher's signature).
- **The APK** is installed from unknown sources and not from Google Play; make sure you download it only from this repository's [Releases](https://github.com/Ingwalde/mortar-tablet/releases).
  Android auto backup (`allowBackup`) is on: markers can end up in a Google backup.
- The site pages cannot set `frame-ancestors` (GitHub Pages does not allow headers): in theory they can be embedded in a foreign page; there are no secrets there.
- GitHub Actions are pinned by major version (not by SHA); the development dependencies (vitest and the build chain) have known advisories, but they do not get into the
  released application.
- `node-forge` is a development dependency (it was used once to create the Android signing key) and is not part of any build.

## Reporting a vulnerability

Write to the author at the address in the `author` field of `package.json`. Please do not publish details before a fix.
