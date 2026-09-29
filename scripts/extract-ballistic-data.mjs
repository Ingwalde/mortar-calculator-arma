// Джерело: GeNeFRAG/ArmaReforger, mortar_core/ballistic-data.json (MIT, © Gerhard Fröhlich).
// https://github.com/GeNeFRAG/ArmaReforger/blob/main/mortar_core/ballistic-data.json
// Цей скрипт вирізає з повного файлу лише M252 і 2Б14 (єдині міномети, потрібні застосунку)
// і перекладає його у формат src/core/ballistic-data.json. Дані/формули не змінюються.
import { writeFileSync } from "node:fs";

const SOURCE_URL =
  "https://raw.githubusercontent.com/GeNeFRAG/ArmaReforger/main/mortar_core/ballistic-data.json";

const res = await fetch(SOURCE_URL);
if (!res.ok) throw new Error(`Не вдалося завантажити ${SOURCE_URL}: ${res.status}`);
const full = await res.json();

const wanted = ["2B14", "M252"];
const out = {};
for (const ws of full.weaponSystems) {
  if (!wanted.includes(ws.id)) continue;
  const shells = {};
  for (const sh of ws.shellTypes) {
    shells[sh.type] = {
      name: sh.name,
      charges: sh.charges.map((c) => ({
        level: c.level,
        minRange: c.minRange,
        maxRange: c.maxRange,
        table: c.rangeTable.map((r) => ({
          range: r.range,
          elevation: r.elevation,
          tof: r.tof,
          dElev: r.dElev,
          tofPer100m: r.tofPer100m ?? 0
        }))
      }))
    };
  }
  out[ws.id] = {
    name: ws.name,
    milsPerCircle: ws.milSystem.milsPerCircle,
    shells
  };
}

writeFileSync(
  new URL("../src/core/ballistic-data.json", import.meta.url),
  JSON.stringify(out, null, 2) + "\n"
);
console.log("Записано src/core/ballistic-data.json для:", Object.keys(out).join(", "));
