Third-party materials, licenses and credits
===========================================

Mortar Tablet is a noncommercial fan tool for the game Arma Reforger. It is not affiliated with or endorsed by Bohemia Interactive.
Arma, Arma Reforger and Enfusion are trademarks of Bohemia Interactive a.s.

The authored parts of the application are under the Mortar Tablet Noncommercial License 1.0 (the LICENSE file).
That license allows only noncommercial use of the authored parts and does not change the terms of the third-party materials below.
Third-party code, libraries, maps and data keep their own licenses; rights granted earlier under the MIT license are not revoked.


1. Game data and maps
---------------------

EnfusionMapMaker, by nickludlam (https://github.com/nickludlam/EnfusionMapMaker)
License: Arma Public License Share Alike, APL-SA (https://www.bohemia.net/community/licenses/arma-public-license-share-alike).
Used: the names and coordinates of places on Everon and Arland, and the online map tile scheme. The material was changed: the places were converted to the application's format
and supplemented with importance ranks (the files src/core/terrains.ts and src/core/terrains-data.json). This data is distributed under the same APL-SA terms:
noncommercial use only and only for games of the Arma series; no additional restrictions for recipients.
The Everon, Arland and Kolguyev tiles are hosted at reforger.recoil.org. The web version and Android download them from that server;
the PC version supports a local cache. The origin of the materials and the unresolved rights questions are recorded in legal/ASSET-PROVENANCE.md.

GeNeFRAG/ArmaReforger (https://github.com/GeNeFRAG/ArmaReforger)
Used: the calculation code, the M252 and 2B14 ballistic tables, the terrain catalogue, the links to images and height data.
The repository declares MIT. This does not confirm rights to the original sources of the images and of the game data extracted from them;
those need a separate provenance review (legal/ASSET-PROVENANCE.md). The license of the borrowed code:

    MIT License

    Copyright (c) 2025 Gerhard Fröhlich

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

Arma Reforger game files (Bohemia Interactive): building outlines, place names and some dispersion parameters were read from the game files.
The noncommercial purpose of the application is not, by itself, a permission to distribute these materials; the review status is in legal/ASSET-PROVENANCE.md.

Arma Reforger Workshop mods (authors and licenses as shown on the public pages, checked 2026-10-20):
- Gogland - MANW_2025, by Temppa, APL (version 1.3.7): https://reforger.armaplatform.com/workshop/65FCE7C94451AFF8
- Bad Orb 5.0, by Aphex26, APL: https://reforger.armaplatform.com/workshop/64A51967EC407267
- Bystrany, by Der alte Benni, APL: https://reforger.armaplatform.com/workshop/6626CB89B6B9C913
- Chernorus_Kirovograd, by knisez, APL: https://reforger.armaplatform.com/workshop/6608D15676B2EACC
- Mogadishu, by KIOK, APL: https://reforger.armaplatform.com/workshop/5F1D02080409E128
- Novyinovka - Russia, by Itzz Coach, APL: https://reforger.armaplatform.com/workshop/689E376275A6AF90
- Iron Hold Castle, by WoodyCracudo, APL (version 1.0.3, page read 2026-10-20): https://reforger.armaplatform.com/workshop/697F774C5FD21619

The text of the APL: https://www.bohemia.net/en/licenses/arma-public-license
From the mod files the terrain sizes, place names and heights were read; for some maps also the building outlines.
The names/coordinates were converted to the application's format, the heights were turned into compressed grids,
the building outlines into binary modules. For Novyinovka a WebP tile pyramid is shipped as well.
The rights to the mod materials and to their dependencies belong to the respective rights holders.
The mods have dependencies with other licenses (including APL-ND, APL-SA, CC BY-NC-SA 4.0); their list and review status are in legal/ASSET-PROVENANCE.md.
The Novyinovka map is a converted (resized and tiled) 2D image of the terrain taken from that mod (Itzz Coach, APL).


2. Software libraries
---------------------

The notices of the installed npm dependencies are gathered by scripts/collect-third-party-licenses.mjs
into resources/legal/npm-notices.txt and shown in the application. This is not a full audit of the native libraries.
The desktop packaging keeps the LICENSE/COPYING/NOTICE files and the READMEs of the dependencies; Electron/Chromium also need
LICENSE.electron.txt and LICENSES.chromium.html from the matching Electron distribution.

- Electron and Chromium: MIT and the licenses of the Chromium components (LICENSES.chromium.html).
- sharp: Apache-2.0; the bundled libvips: LGPL-3.0-or-later (https://github.com/lovell/sharp-libvips), used only in the desktop version to cut maps into tiles (Windows, macOS and Linux builds).
- qrcode: MIT, Copyright (c) 2012 Ryan Day; dijkstrajs: MIT, Copyright (C) 2008 Wyatt Baldwin.
- nosleep.js: MIT, Copyright (c) Rich Tibbett.
- electron-updater and builder-util-runtime: MIT, Copyright (c) 2015 Loopline Systems.
- Capacitor (core, app, browser): MIT, Copyright (c) 2017-present Drifty Co. and 2020-present Ionic.
- The Android app uses AndroidX libraries under Apache-2.0.

The native bundle of sharp also contains MPL-1.1, BSD, MIT, LGPL and special codec and font licenses.
The versions, the sources and the requirements still open for a release are in legal/NATIVE-COMPONENTS.md.
The source code of the LGPL/MPL libraries, how to get it, and the right to replace them are in legal/native/SOURCE-OFFER.md.
The presence of this notice does not mean that the review of rights to all materials is complete.

The MIT license (applies to the MIT libraries marked above):

    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files
    (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify,
    merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished
    to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
    INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
    SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT
    OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
