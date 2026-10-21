// Параметри вибуху мінометних снарядів зі «справжніх» файлів гри (Arma Reforger Server): відстань ураження осколками.
//   node scripts/extract-shell-effects.mjs "<Arma Reforger Server>/addons/data/data002.pak" [src/core/shell-effects.json]
// Читає префаби снарядів і бойових частин, іде вгору по ланцюжку успадкування (.et і .conf) і бере DamageDistance
// ефекту ExplosionFragmentationEffect. Нічого не вигадує: якщо відстань не знайдено, у JSON буде null.
import { closeSync, openSync, readSync, statSync, writeFileSync } from "node:fs";
import { inflateRawSync, inflateSync } from "node:zlib";
import { basename } from "node:path";

const pakPath = process.argv[2];
const outPath = process.argv[3] ?? "src/core/shell-effects.json";
if (!pakPath) {
  console.error('Використання: node scripts/extract-shell-effects.mjs "<шлях до data002.pak>" [вихідний.json]');
  process.exit(2);
}

// ---- мінімальний читач PAK (FORM/PAC1): лише читання
const fd = openSync(pakPath, "r");
const size = statSync(pakPath).size;
function read(off, len) {
  const b = Buffer.alloc(len);
  const n = readSync(fd, b, 0, len, off);
  return n === len ? b : b.subarray(0, n);
}
const head = read(0, 12);
if (head.toString("latin1", 0, 4) !== "FORM" || head.toString("latin1", 8, 12) !== "PAC1") throw new Error("не PAC1: " + pakPath);
let off = 12;
let fileChunk = null;
while (off + 8 <= size) {
  const hdr = read(off, 8);
  const tag = hdr.toString("latin1", 0, 4);
  const len = hdr.readUInt32BE(4);
  if (tag === "FILE") {
    fileChunk = read(off + 8, len);
    break;
  }
  off += 8 + len;
}
if (!fileChunk) throw new Error("у файлі нема каталогу FILE");
const entries = new Map();
let p = 0;
function readEntry(prefix) {
  const type = fileChunk[p++];
  const nameLen = fileChunk[p++];
  const name = fileChunk.toString("utf8", p, p + nameLen);
  p += nameLen;
  if (type === 0) {
    const count = fileChunk.readUInt32LE(p);
    p += 4;
    for (let i = 0; i < count; i++) readEntry(prefix + name + "/");
  } else if (type === 1) {
    const offset = fileChunk.readUInt32LE(p);
    const csize = fileChunk.readUInt32LE(p + 4);
    const usize = fileChunk.readUInt32LE(p + 8);
    p += 24;
    entries.set(prefix + name, { offset, csize, usize });
  } else throw new Error("невідомий тип запису " + type);
}
if (fileChunk[p++] !== 0) throw new Error("корінь не каталог");
p += 1 + fileChunk[p];
const rootCount = fileChunk.readUInt32LE(p);
p += 4;
for (let i = 0; i < rootCount; i++) readEntry("");

function text(path) {
  const e = entries.get(path);
  if (!e) throw new Error("нема файлу в архіві: " + path);
  const raw = read(e.offset, e.csize);
  if (e.csize === e.usize) return raw.toString("utf8");
  try {
    return inflateSync(raw).toString("utf8");
  } catch {
    return inflateRawSync(raw).toString("utf8");
  }
}

// ---- розбір: у текстових префабах/конфігах батьківський файл стоїть у першому рядку після двокрапки
const GUID_PATH = /"\{[0-9A-F]{16}\}([^"]+)"/;
function parentOf(src) {
  const first = src.split("\n", 1)[0];
  const m = /:\s*"\{[0-9A-F]{16}\}([^"]+)"/.exec(first);
  return m ? m[1] : null;
}

/** Блок за ключем: текст між відповідними дужками (дужки всередині лапок, як у «{GUID}шлях», не рахуються). */
function block(src, key) {
  const m = new RegExp(`\\b${key}\\b`).exec(src);
  if (!m) return null;
  let i = m.index + key.length;
  let inQuote = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"') inQuote = !inQuote;
    else if (!inQuote && c === "{") break;
  }
  if (i >= src.length) return null;
  const head = src.slice(m.index, i + 1);
  let depth = 1;
  let j = i + 1;
  const start = j;
  inQuote = false;
  for (; j < src.length && depth > 0; j++) {
    const c = src[j];
    if (c === '"') inQuote = !inQuote;
    else if (!inQuote && c === "{") depth++;
    else if (!inQuote && c === "}") depth--;
  }
  return { head, body: src.slice(start, j - 1) };
}

function number(src, key) {
  const m = new RegExp(`\\b${key}\\s+(-?[0-9.]+)`).exec(src);
  return m ? Number(m[1]) : null;
}

/** DamageDistance ефекту: власне значення блоку, інакше успадковане з батьківського .conf (рекурсивно). */
function inheritedNumber(blk, key, depth = 0) {
  if (!blk || depth > 8) return null;
  const own = number(blk.body, key);
  if (own !== null) return own;
  const par = GUID_PATH.exec(blk.head);
  if (!par) return null;
  const conf = text(par[1]);
  const inner = block(conf, "ExplosionFragmentationEffect") ?? { head: conf.split("\n", 1)[0], body: conf };
  const direct = number(conf, key);
  if (direct !== null && !block(conf, "ExplosionFragmentationEffect")) return direct;
  return inheritedNumber({ head: conf.split("\n", 1)[0] + "{", body: inner.body }, key, depth + 1);
}

/** Відстань осколків і дані заряду для префаба бойової частини; null — осколків нема. */
function warheadEffects(path) {
  let src = text(path);
  const chain = [path];
  let fragBlock = null;
  let ownFrag = null;
  let charge = null;
  for (let depth = 0; depth < 8 && src; depth++) {
    if (charge === null) charge = number(src, "ChargeWeight");
    if (ownFrag === null) ownFrag = block(src, "ExplosionFragmentationEffect");
    const container = /ExplosionDamageContainer\s+"[^"]*"\s*:\s*"\{[0-9A-F]{16}\}([^"]+)"/.exec(src);
    if (container) {
      // контейнер .conf: ланцюжок успадкування, де десь описано ExplosionFragmentationEffect
      let confPath = container[1];
      for (let k = 0; k < 8 && confPath; k++) {
        const conf = text(confPath);
        chain.push(confPath);
        const fb = block(conf, "ExplosionFragmentationEffect");
        if (fb) {
          fragBlock = fb;
          break;
        }
        confPath = parentOf(conf);
      }
      break;
    }
    const parent = parentOf(src);
    if (!parent) break;
    chain.push(parent);
    src = text(parent);
  }
  if (!fragBlock && !ownFrag) return { chain, fragmentation: null, charge };
  // власні налаштування ефекту в бойовій частині мають перевагу над успадкованими
  const distance = (ownFrag && number(ownFrag.body, "DamageDistance")) ?? inheritedNumber(fragBlock, "DamageDistance");
  const count = (ownFrag && number(ownFrag.body, "DamageFragmentCount")) ?? inheritedNumber(fragBlock, "DamageFragmentCount");
  return { chain, fragmentation: distance === null ? null : { distance, count }, charge };
}

// ---- снаряди (ключі збігаються з src/core/ballistic-data.json)
const SHELLS = {
  "M252:HE": "Prefabs/Weapons/Ammo/Ammo_Shell_81mm_HE_M821.et",
  "M252:Illumination": "Prefabs/Weapons/Ammo/Ammo_Shell_81mm_Illum_M853A1.et",
  "M252:Smoke": "Prefabs/Weapons/Ammo/Ammo_Shell_81mm_Smoke_M819.et",
  "2B14:HE": "Prefabs/Weapons/Ammo/Ammo_Shell_82mm_HE_O832DU.et",
  "2B14:Illumination": "Prefabs/Weapons/Ammo/Ammo_Shell_82mm_Illum_S832S.et",
  "2B14:Smoke": "Prefabs/Weapons/Ammo/Ammo_Shell_82mm_Smoke_D832DU.et"
};

const shells = {};
for (const [key, ammoPath] of Object.entries(SHELLS)) {
  const ammo = text(ammoPath);
  const explosion = block(ammo, "ExplosionEffect");
  const disabled = explosion && /\bEnabled\s+0\b/.test(explosion.body);
  const eff = explosion ? /EffectPrefab\s+"\{[0-9A-F]{16}\}([^"]+)"/.exec(explosion.body) : null;
  if (disabled || !eff) {
    shells[key] = { ammo: ammoPath, warhead: null, fragmentation: null, note: disabled ? "explosion disabled (flare submunition)" : "no explosion effect" };
    continue;
  }
  const w = warheadEffects(eff[1]);
  shells[key] = { ammo: ammoPath, warhead: eff[1], chargeWeightG: w.charge, fragmentation: w.fragmentation, chain: w.chain };
}

const result = {
  source: { pak: basename(pakPath), bytes: size, extractedAt: new Date().toISOString().slice(0, 10), game: "Arma Reforger Server (addons/data)" },
  note: "fragmentation.distance is the DamageDistance (metres) of the shell's ExplosionFragmentationEffect as defined in the game files; null means no fragmentation effect",
  shells
};
writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
closeSync(fd);
for (const [k, v] of Object.entries(shells)) console.log(k.padEnd(20), v.fragmentation ? `fragments up to ${v.fragmentation.distance} m (count ${v.fragmentation.count})` : "no fragmentation", v.note ?? "");
console.log("written", outPath);
