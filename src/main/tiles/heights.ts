import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { encodeHeightGrid, parseHeightJson } from "../../core/heightGrid";

export function heightsPath(terrainId: string): string {
  return join(app.getPath("userData"), "heights", `${terrainId}.bin`);
}

/** Завантажує height_data (JSON) і зберігає компактним бінарним файлом для швидкого читання. */
export async function convertHeightData(terrainId: string, url: string): Promise<{ rows: number; cols: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не вдалося завантажити дані висот: ${res.status}`);
  const raw = (await res.json()) as unknown[][];
  const grid = parseHeightJson(raw);

  const path = heightsPath(terrainId);
  await mkdir(join(app.getPath("userData"), "heights"), { recursive: true });
  await writeFile(path, Buffer.from(encodeHeightGrid(grid)));

  return { rows: grid.rows, cols: grid.cols };
}

export async function readHeights(terrainId: string): Promise<Uint8Array | null> {
  try {
    return await readFile(heightsPath(terrainId));
  } catch {
    return null;
  }
}
