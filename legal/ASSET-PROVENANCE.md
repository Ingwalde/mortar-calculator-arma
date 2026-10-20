# Asset provenance and distribution review

Reviewed on 2026-10-20 against repository base `6769d037e5a83a04fccf4ca05b41c714cb77b895`.
This records evidence, not additional permission. The application license does
not cover third-party maps or data. A public Workshop listing establishes the
license declared there, not ownership of every dependency of the mod.

## Official maps and upstream datasets

| Material | Source and attribution | Repository locations | Status and remaining work |
| --- | --- | --- | --- |
| Everon / Arland place names and coordinates | [nickludlam/EnfusionMapMaker](https://github.com/nickludlam/EnfusionMapMaker), APL-SA | `src/core/terrains-data.json`, `scripts/extract-terrains.mjs` | Keep APL-SA attribution for the adapted datasets; record the exact upstream revision used. The entire JSON file is not exclusively from this source. |
| Everon / Arland / Kolguyev online tiles | `https://reforger.recoil.org/map-tiles/`, game content by Bohemia Interactive | `src/core/terrains-data.json`, `src/core/onlineTiles.ts` | Web/Android request tiles directly; desktop can cache them. Confirm the applicable content and service permissions, including caching. A URL alone is not permission. |
| Full map images and elevation datasets linked through GeNeFRAG | [GeNeFRAG/ArmaReforger](https://github.com/GeNeFRAG/ArmaReforger), repository declares MIT | `src/core/terrains-data.json`, `src/core/heightGrid.ts`, `scripts/build-web-assets.ts` | The MIT code license does not establish rights in underlying game/mod imagery or elevation datasets. Record their actual sources and applicable permissions. |
| Official-map building outlines | Bohemia Interactive game `.topo` files | `src/core/buildings/{everon,arland,kolguyev}.ts` | Converted to BLD1/base64 by `scripts/extract-buildings.mjs`. Specific redistribution authority has not been established. Resolve before a new public binary/data release. |
| Calculation reference code and tables | GeNeFRAG / Gerhard Fröhlich, MIT | `src/core/ballistics.ts`, `src/core/ballistic-data.json`, `test/vendor/BallisticCalculator.reference.cjs` | Preserve the MIT notice. Separately document the provenance of the numerical dataset; do not assume that all isolated numbers/formulas are copyrightable. |
| Game dispersion parameters | Arma Reforger game prefabs | `src/core/spread.ts` | A few numerical parameters and independently written calculation code, not an extracted image. Record their origin; do not equate these automatically with the legal status of copied maps or databases. |

## Workshop terrains

The following are the licenses and versions visible on the public listings on
the review date. The exact versions used for the existing extracted files have
not yet been recorded and must not be silently equated with these versions.

| Terrain | Author | Workshop ID / source | Observed license / version |
| --- | --- | --- | --- |
| Gogland | Temppa | [623EEDF242F6265E](https://reforger.armaplatform.com/workshop/623EEDF242F6265E) | APL / 1.4.12 |
| Bad Orb 5.0 | Aphex26 | [64A51967EC407267](https://reforger.armaplatform.com/workshop/64A51967EC407267) | APL / 5.0.47 |
| Bystrany | Der alte Benni | [6626CB89B6B9C913](https://reforger.armaplatform.com/workshop/6626CB89B6B9C913) | APL / 0.2.6 |
| Chernorus_Kirovograd | knisez | [6608D15676B2EACC](https://reforger.armaplatform.com/workshop/6608D15676B2EACC) | APL / 1.0.6 |
| Mogadishu | KIOK | [5F1D02080409E128](https://reforger.armaplatform.com/workshop/5F1D02080409E128) | APL / 1.0.13 |
| Novyinovka - Russia | Itzz Coach | [689E376275A6AF90](https://reforger.armaplatform.com/workshop/689E376275A6AF90) | APL / 0.5.16 |
| Iron Hold Castle | WoodyCracudo | [697F774C5FD21619](https://reforger.armaplatform.com/workshop/697F774C5FD21619) | APL / 1.0.3 (detail page read on 2026-10-20; the license link points to `https://www.bohemia.net/community/licenses`) |

### Dependencies listed on the Workshop pages

The detail pages list these mod dependencies. Their licenses were read on the
same date from the dependencies' own pages and differ from the terrain's own
license in several cases. No dependency list was shown on the retrieved pages of
Gogland, Bad Orb 5.0 and Bystrany; that is an observation of the page text, not a
guarantee that they have none.

| Terrain | Dependency (author, ID) | Observed license / version |
| --- | --- | --- |
| Iron Hold Castle | iRON79 Compositions (iRON79, `60A68ED7293C691A`) | APL-ND / 1.0.29 |
| Iron Hold Castle | Carcara Props (WoodyCracudo, `684F070647627FD1`) | APL / 1.0.11 |
| Chernorus_Kirovograd | WolfsBuildingPack (N3crowolf, `5D84C738432BFE6A`) | APL-ND / 0.1.56 |
| Chernorus_Kirovograd | Rail Enfusion Redux (TilW, `5DE612963E4B005A`) | APL-SA / 1.0.12 |
| Chernorus_Kirovograd | RHS TerraCore2 (Red Hammer Studios, `5E58A3FB8CE68CBB`) | CC BY-NC-SA 4.0 / 0.1.35 |
| Chernorus_Kirovograd | Railway Generator (TilW, `5F0D245931200FD1`) | APL / 1.0.5 |
| Chernorus_Kirovograd, Mogadishu | ArmaTerrainCore (KIOK, `60B524F7A5AE96A8`) | APL / 1.1.9 |
| Novyinovka - Russia | Ukraine Trenches (Piano_Man, `646518DA09B1E283`) | APL-ND / 1.0.3 |

Whether any protected object, texture or composition from these dependencies is
embedded in the extracted outlines, height grids or the rendered Novyinovka tile
pyramid has not been determined. The repository extracts terrain topology and
renders its own images; the dependency assets themselves were not audited.
The APL-ND, APL-SA and CC BY-NC-SA entries are listed because their terms differ
from the terrain's own license, not because use of them has been established.

Affected files include:

- `resources/heights/*.bin.gz`: extracted, converted and compressed height grids.
- `src/core/buildings/*.ts`: converted building outlines for nine terrains.
- `src/core/terrains-data.json`: mixed-source names, coordinates and terrain metadata.
- `resources/maps/novyinovka/**`: bundled WebP tile pyramid.
- `src/core/web-mod-maps.json` and the separate `web-assets/mod-maps.tar.gz`
  release: additional web/Android images. Review the actual archive as well as
  the repository; a source-tree review is not an audit of that external archive.

For mod dependencies, determine whether any protected material from them is
present in the exported images/data. The map author's license cannot grant
rights that belong to another author. There is no need to obtain a new
individual permission where an existing applicable license already covers
the intended noncommercial use and distribution.

## Outstanding decisions

1. Iron Hold Castle's own license is confirmed as APL (1.0.3). Determine whether
   protected material from its APL-ND dependency (iRON79 Compositions) and the
   other listed dependencies is present in the supplied data (see the table
   above); exclude or replace the data if it cannot be cleared.
2. Establish redistribution rights for official game-derived material and for
   images/elevations redistributed by upstream projects.
3. Record extraction versions, relevant upstream revisions and retained license
   notices. Review the separate web map archive.
4. If an item cannot be cleared, replace or exclude it and verify the affected
   feature. This change set does not silently remove existing maps or data.

## Verification log

Checked on 2026-10-20:

- All seven terrain pages and the dependency pages above were read; authors, IDs,
  license names and versions match the tables. Iron Hold Castle's page, which could
  not be retrieved in the original review, is now read and confirmed.
- The reference URLs below, `https://reforger.armaplatform.com/workshop-terms` and
  `https://reforger.recoil.org/map-tiles/everon/5/1/1/tile.jpg` respond with HTTP 200.
  Reachability is not permission to reuse or cache the tiles.

References:

- [Bohemia game content rules](https://www.bohemia.net/en/community/game-content-usage-rules)
- [APL](https://www.bohemia.net/en/licenses/arma-public-license)
- [APL-SA](https://www.bohemia.net/en/licenses/arma-public-license-share-alike)
- [Workshop terms](https://reforger.armaplatform.com/workshop-terms)

Noncommercial intent alone does not settle the outstanding source permissions.
