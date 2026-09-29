import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildTilePyramid, ImportCancelledError } from "../src/main/tiles/import.js";

const SRC = fileURLToPath(new URL("../maps/everon_sat_z7_full.png", import.meta.url));
const OUT = fileURLToPath(new URL("../.tile-test/module-run", import.meta.url));

console.log("=== 1) звичайний прогін з прогресом ===");
let lastLogged = -1;
const res = await buildTilePyramid(SRC, 12800, 12800, OUT, (p) => {
  const pct = Math.floor((p.done / p.total) * 100);
  if (pct !== lastLogged) {
    lastLogged = pct;
    console.log(`  ${pct}% (${p.done}/${p.total})`);
  }
});
console.log("результат:", res);

console.log("=== 2) скасування на середині ===");
const OUT2 = fileURLToPath(new URL("../.tile-test/module-cancel", import.meta.url));
const ac = new AbortController();
setTimeout(() => ac.abort(), 1500);
try {
  await buildTilePyramid(SRC, 12800, 12800, OUT2, undefined, ac.signal);
  console.log("ПОМИЛКА: мало кинути ImportCancelledError");
} catch (e) {
  if (e instanceof ImportCancelledError) console.log("OK: отримано ImportCancelledError як і очікувалось");
  else throw e;
}
await rm(OUT2, { recursive: true, force: true });
await rm(OUT, { recursive: true, force: true });
console.log("прибрано тестові каталоги");
