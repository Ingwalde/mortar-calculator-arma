// Проставляє важливість (1 головні / 2 звичайні / 3 другорядні) 4-м елементом пунктів у
// src/core/terrains-data.json. Для теренів із .topo мода враховує щільність забудови навколо пункту
// (BULD, радіус 250 м), решта — лише за назвою (core/places.ts). Ідемпотентно; запускати після
// scripts/extract-terrains.mjs (воно перегенеровує JSON без цього поля).
//   node scripts/rank-places.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const TOPOS = {
  bystrany: "D:/arma-mods/out/topo/bystrany.topo",
  kirovograd: "D:/arma-mods/out/topo/kirovograd.topo",
  mogadishu: "D:/arma-mods/out/mog/mog.topo",
  novyinovka: "D:/arma-mods/out/topo/novyinovka.topo"
};
// дзеркало core/places.ts (скрипт без TS-збірки)
const MAJOR = /\b(airport|airfield|air ?base|base|military|power plant|hospital|port|refinery|factory|castle|city|town|administration|capital)\b/i;
const MINOR = /\b(farm|cave|hill|ridge|beach|pond|lake|forest|hollow|wood|woods|quarry|sawmill|bunker|bunkers|battery|tunnel|checkpoint|locker|rest|riverbed|fields|bush|yard|wreck|beacon|pass|valley|bay|find|mine|spring|rock|stone|signal|pig|ranch|hof|berg|wasserversorgung|fm)\b/i;
const byName = (n) => (MAJOR.test(n) ? 1 : MINOR.test(n) ? 3 : 2);

function buildings(path, size) {
  const b = readFileSync(path);
  let off = 20, s = -1;
  while (off + 20 <= b.length) {
    const tag = b.toString("latin1", off, off + 4);
    if (!/^[A-Z0-9_]{3,4}$/.test(tag)) break;
    const end = b.readUInt32LE(off + 12);
    if (tag === "BULD") s = off + 20;
    if (end <= off) break;
    off = end;
  }
  if (s < 0) return [];
  let o = s + 4;
  const cnt = b.readUInt32LE(o);
  o += 4;
  const out = [];
  for (let i = 0; i < cnt; i++) {
    const n = b.readUInt32LE(o);
    if (n < 3 || n > 5000) break;
    let sx = 0, sz = 0;
    for (let k = 0; k < n; k++) { sx += b.readFloatLE(o + 4 + k * 8); sz += b.readFloatLE(o + 8 + k * 8); }
    out.push([sx / n, size - sz / n]); // z топо перевернуте
    o += 4 + n * 8;
  }
  return out;
}

const file = new URL("../src/core/terrains-data.json", import.meta.url);
const data = JSON.parse(readFileSync(file, "utf8"));
for (const t of data) {
  if (!t.places) continue;
  const topo = TOPOS[t.id];
  const B = topo && existsSync(topo) ? buildings(topo, t.sizeZ) : null;
  const tally = [0, 0, 0, 0];
  // кількість будівель у радіусі 250 м; «головні» за забудовою — верхні 25% і не менше 50 будівель
  const counts = B ? t.places.map(([, x, z]) => { let n = 0; for (const [bx, bz] of B) if (Math.hypot(bx - x, bz - z) <= 250) n++; return n; }) : [];
  const p75 = counts.length ? [...counts].sort((u, v) => u - v)[Math.floor(counts.length * 0.75)] : 0;
  t.places = t.places.map(([name, x, z], i) => {
    let tier = byName(name);
    if (B) {
      const n = counts[i];
      const d = n >= Math.max(50, p75) ? 1 : n >= 10 ? 2 : 3;
      if (tier !== 1) tier = d === 1 ? 1 : tier === 3 && d === 3 ? 3 : 2;
    }
    tally[tier]++;
    return [name, x, z, tier];
  });
  console.log(`${t.id}: головні ${tally[1]}, звичайні ${tally[2]}, другорядні ${tally[3]}${B ? " (за забудовою)" : " (за назвою)"}`);
}
writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
