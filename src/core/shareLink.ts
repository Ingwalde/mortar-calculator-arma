/**
 * Обмін мітками посиланням і QR-кодом: документ обміну стискається й кладеться у фрагмент адреси
 * (`<сайт>#s=<payload>`), тому нічого не передається на сервер. Без DOM — тестується напряму.
 *
 * Payload: base64url(deflate-raw(JSON)), де JSON — компактний масивний запис міток.
 */
import { serializeExport, type ExchangeDoc, type XMarker, type XMarkerType } from "./markerExchange";

/** Адреса веб-версії, у яку веде посилання (PWA на GitHub Pages). */
export const SHARE_BASE = "https://ingwalde.github.io/mortar-calculator-arma/";
/** Довше посилання вже не вміщається в QR, який легко зчитується камерою телефона. */
export const MAX_QR_URL_LENGTH = 1100;

const MAX_PAYLOAD_CHARS = 400_000;
const MAX_JSON_BYTES = 2_000_000;
const MAX_MARKERS = 1000;

const TYPES: XMarkerType[] = ["mortar", "target", "point"];

/** [id, name, тип(0..2), x, z, h|null, зброя(0 M252 / 1 2B14), u, папка?] */
type PackedMarker = [string, string, number, number, number, number | null, number, number, string?];
interface Packed {
  v: 1;
  t: string;
  n?: string;
  f: string | null;
  m: PackedMarker[];
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function readAll(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return (await readAll(stream, MAX_JSON_BYTES)) ?? new Uint8Array();
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await readAll(stream, MAX_JSON_BYTES);
  } catch {
    return null;
  }
}

/** Документ обміну -> payload для посилання. */
export async function encodeShare(doc: ExchangeDoc): Promise<string> {
  const perMarkerFolder = doc.folder === null;
  const packed: Packed = {
    v: 1,
    t: doc.terrain,
    ...(doc.terrainName ? { n: doc.terrainName } : {}),
    f: doc.folder,
    m: doc.markers.map((m): PackedMarker => {
      const typeCode = Math.max(0, TYPES.indexOf(m.type)) + (m.destroyed ? TYPES.length : 0);
      const row: PackedMarker = [m.id, m.name, typeCode, m.x, m.z, m.h, m.w === "2B14" ? 1 : 0, m.u];
      if (perMarkerFolder) row.push(m.folder);
      return row;
    })
  };
  const json = new TextEncoder().encode(JSON.stringify(packed));
  return toBase64Url(await deflate(json));
}

/** payload -> документ обміну; null — пошкоджений або завеликий. */
export async function decodeShare(payload: string): Promise<ExchangeDoc | null> {
  if (!payload || payload.length > MAX_PAYLOAD_CHARS) return null;
  const raw = fromBase64Url(payload);
  if (!raw) return null;
  const json = await inflate(raw);
  if (!json) return null;
  let p: unknown;
  try {
    p = JSON.parse(new TextDecoder().decode(json));
  } catch {
    return null;
  }
  const o = p as Partial<Packed> | null;
  if (!o || o.v !== 1 || typeof o.t !== "string" || !Array.isArray(o.m) || o.m.length > MAX_MARKERS) return null;
  const folder = typeof o.f === "string" ? o.f : null;
  const markers: XMarker[] = [];
  for (const row of o.m) {
    if (!Array.isArray(row)) continue;
    const [id, name, type, x, z, h, w, u, f] = row as PackedMarker;
    markers.push({
      id: typeof id === "string" ? id : "",
      name: typeof name === "string" ? name : "",
      type: TYPES[Number(type) % TYPES.length] ?? "point",
      x: Number(x),
      z: Number(z),
      h: h === null || h === undefined ? null : Number(h),
      w: w === 1 ? "2B14" : "M252",
      folder: typeof f === "string" ? f : (folder ?? ""),
      u: Number(u) || 0,
      ...(Number(type) >= TYPES.length && Number(type) % TYPES.length !== 0 ? { destroyed: true } : {})
    });
  }
  return {
    app: "mortar-tablet",
    kind: "markers",
    v: 1,
    terrain: o.t,
    terrainName: typeof o.n === "string" ? o.n : undefined,
    folder,
    exportedAt: Date.now(),
    markers
  };
}

/** Адреса — наша веб-версія (хост і шлях SHARE_BASE); для посилань, відкритих Android-застосунком. */
export function isOwnShareUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    const own = new URL(SHARE_BASE);
    return u.protocol === own.protocol && u.hostname === own.hostname && u.pathname.startsWith(own.pathname.replace(/\/$/, ""));
  } catch {
    return false;
  }
}

export function buildShareUrl(payload: string, base: string = SHARE_BASE): string {
  return `${base}#s=${payload}`;
}

/** Знаходить payload у посиланні (або в тексті, де є посилання); null — не посилання обміну. */
export function extractSharePayload(text: string): string | null {
  const m = /[#&?]s=([A-Za-z0-9_-]{4,})/.exec(text);
  return m ? m[1] : null;
}

/** Посилання/payload -> текст обміну (як після «Експорту»), який розбирає parseExchange. */
export async function shareToExchangeText(input: string): Promise<string | null> {
  const payload = extractSharePayload(input);
  if (!payload) return null;
  const doc = await decodeShare(payload);
  return doc ? serializeExport(doc) : null;
}
