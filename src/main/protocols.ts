import { app, net, protocol } from "electron";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findPreset } from "../core/terrains";
import { tileUrl } from "../core/onlineTiles";

/** Викликати ДО app.whenReady() — реєструє схеми як привілейовані (fetch/CORS з рендерера). */
export function registerPrivilegedSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: "tile", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
    { scheme: "localtile", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
  ]);
}

function tileCacheDir(terrainId: string): string {
  return join(app.getPath("userData"), "tiles", terrainId);
}

export function pyramidDir(terrainId: string): string {
  return join(app.getPath("userData"), "maps", terrainId);
}

/** Онлайн-тайл reforger.recoil.org з дисковим кешем; null — нема такого тайла чи мережа недоступна. */
export async function getOnlineTile(terrainId: string, lod: number, x: number, y: number): Promise<Buffer | null> {
  const preset = findPreset(terrainId);
  if (!preset?.tiles || !Number.isInteger(lod) || !Number.isInteger(x) || !Number.isInteger(y)) return null;

  const cachePath = join(tileCacheDir(terrainId), String(lod), String(x), `${y}.jpg`);
  if (existsSync(cachePath)) return readFile(cachePath);

  try {
    const remote = await net.fetch(tileUrl(preset.tiles.base, lod, x, y));
    if (!remote.ok) return null;
    const buf = Buffer.from(await remote.arrayBuffer());
    await mkdir(join(tileCacheDir(terrainId), String(lod), String(x)), { recursive: true });
    await writeFile(cachePath, buf);
    return buf;
  } catch {
    return null;
  }
}

export type EnsureTileResult = "ok" | "missing" | "failed";

/**
 * Гарантує, що онлайн-тайл лежить у дисковому кеші (без читання файлу).
 * "missing" — сервер каже, що такого тайла нема (404: за межами карти, море), це не помилка;
 * "failed" — мережева чи серверна помилка (одна повторна спроба).
 */
export async function ensureOnlineTile(terrainId: string, lod: number, x: number, y: number): Promise<EnsureTileResult> {
  const preset = findPreset(terrainId);
  if (!preset?.tiles) return "failed";
  const cachePath = join(tileCacheDir(terrainId), String(lod), String(x), `${y}.jpg`);
  if (existsSync(cachePath)) return "ok";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const remote = await net.fetch(tileUrl(preset.tiles.base, lod, x, y));
      if (remote.status === 404) return "missing";
      if (!remote.ok) continue;
      const buf = Buffer.from(await remote.arrayBuffer());
      await mkdir(join(tileCacheDir(terrainId), String(lod), String(x)), { recursive: true });
      await writeFile(cachePath, buf);
      return "ok";
    } catch {
      // мережа — пробуємо ще раз
    }
  }
  return "failed";
}

/** Тайл імпортованої піраміди (sharp .tile google layout: {z}/{row}/{col}.jpg). */
export async function getPyramidTile(terrainId: string, z: string, row: string, col: string): Promise<Buffer | null> {
  // terrainId/z/row/col приходять з URL (в т.ч. з LAN) — лише прості сегменти, без виходу з каталогу піраміди.
  for (const seg of [terrainId, z, row, col]) if (!/^[A-Za-z0-9_-]+$/.test(seg)) return null;
  const filePath = join(pyramidDir(terrainId), z, row, `${col}.jpg`);
  if (!existsSync(filePath)) return null;
  return readFile(filePath);
}

const avgCache = new Map<string, number | null>();

/** Середній розмір тайла піраміди за вибіркою файлів (для оцінки обсягу офлайн-збереження). */
export async function pyramidAvgBytes(terrainId: string): Promise<number | null> {
  if (!/^[A-Za-z0-9_-]+$/.test(terrainId)) return null;
  if (avgCache.has(terrainId)) return avgCache.get(terrainId)!;
  const dir = pyramidDir(terrainId);
  let sum = 0;
  let n = 0;
  try {
    // беремо найдетальніший рівень (найбільше тайлів), кілька рядків, кілька файлів у кожному
    const levels = (await readdir(dir)).filter((l) => /^\d+$/.test(l)).sort((a, b) => Number(b) - Number(a));
    if (levels.length) {
      const lvl = join(dir, levels[0]);
      const rows = (await readdir(lvl)).slice(0, 6);
      for (const row of rows) {
        const files = (await readdir(join(lvl, row))).slice(0, 8);
        for (const f of files) {
          sum += (await stat(join(lvl, row, f))).size;
          n++;
        }
      }
    }
  } catch {
    // нема піраміди
  }
  const avg = n > 0 ? Math.round(sum / n) : null;
  avgCache.set(terrainId, avg);
  return avg;
}

const notFound = () => new Response("Not found", { status: 404 });
const jpeg = (buf: Buffer) => new Response(buf, { headers: { "content-type": "image/jpeg" } });

/** Викликати ПІСЛЯ app.whenReady() — реєструє самі обробники. */
export function registerProtocolHandlers(): void {
  // tile://{terrainId}/{lod}/{x}/{y} — онлайн-тайли.
  protocol.handle("tile", async (request) => {
    const url = new URL(request.url);
    const [, lodStr, xStr, yStr] = url.pathname.split("/");
    const buf = await getOnlineTile(url.hostname, Number(lodStr), Number(xStr), Number(yStr));
    return buf ? jpeg(buf) : notFound();
  });

  // localtile://{terrainId}/{z}/{row}/{col} — імпортована піраміда.
  protocol.handle("localtile", async (request) => {
    const url = new URL(request.url);
    const [, z, row, col] = url.pathname.split("/");
    if (!z || !row || !col) return notFound();
    const buf = await getPyramidTile(url.hostname, z, row, col);
    return buf ? jpeg(buf) : notFound();
  });
}
