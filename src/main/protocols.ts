import { app, net, protocol } from "electron";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

const notFound = () => new Response("Not found", { status: 404 });

/** Викликати ПІСЛЯ app.whenReady() — реєструє самі обробники. */
export function registerProtocolHandlers(): void {
  // tile://{terrainId}/{lod}/{x}/{y} — онлайн-тайли reforger.recoil.org з дисковим кешем.
  protocol.handle("tile", async (request) => {
    const url = new URL(request.url);
    const terrainId = url.hostname;
    const [, lodStr, xStr, yStr] = url.pathname.split("/");
    const lod = Number(lodStr);
    const x = Number(xStr);
    const y = Number(yStr);
    const preset = findPreset(terrainId);
    if (!preset?.tiles || !Number.isFinite(lod) || !Number.isFinite(x) || !Number.isFinite(y)) return notFound();

    const cachePath = join(tileCacheDir(terrainId), String(lod), String(x), `${y}.jpg`);
    if (existsSync(cachePath)) {
      const buf = await readFile(cachePath);
      return new Response(buf, { headers: { "content-type": "image/jpeg" } });
    }

    try {
      const remote = await net.fetch(tileUrl(preset.tiles.base, lod, x, y));
      if (!remote.ok) return notFound();
      const buf = Buffer.from(await remote.arrayBuffer());
      await mkdir(join(tileCacheDir(terrainId), String(lod), String(x)), { recursive: true });
      await writeFile(cachePath, buf);
      return new Response(buf, { headers: { "content-type": "image/jpeg" } });
    } catch {
      return notFound();
    }
  });

  // localtile://{terrainId}/{z}/{x}/{y} — імпортована піраміда (sharp .tile google layout).
  protocol.handle("localtile", async (request) => {
    const url = new URL(request.url);
    const terrainId = url.hostname;
    const [, z, x, y] = url.pathname.split("/");
    if (!z || !x || !y) return notFound();
    const filePath = join(pyramidDir(terrainId), z, x, `${y}.jpg`);
    if (!existsSync(filePath)) return notFound();
    const buf = await readFile(filePath);
    return new Response(buf, { headers: { "content-type": "image/jpeg" } });
  });
}
