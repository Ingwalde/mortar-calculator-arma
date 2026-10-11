import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { encodeHeightGrid, parseHeightJson } from "../../core/heightGrid";
// Висоти, яких нема в каталозі GeNeFRAG, але які зібрано з файлів модів і поставляються разом із застосунком
// (scripts/extract-badorb-heights.mjs). Імпорт ?asset копіює файл у out/main і дає шлях до нього.
import badorbBundled from "../../../resources/heights/badorb.bin?asset";
import bystranyBundled from "../../../resources/heights/bystrany.bin?asset";
import repulseBundled from "../../../resources/heights/operationrepulse.bin?asset";
import ironholdBundled from "../../../resources/heights/ironholdcastle.bin?asset";
import kirovogradBundled from "../../../resources/heights/kirovograd.bin?asset";
import mogadishuBundled from "../../../resources/heights/mogadishu.bin?asset";
import novyinovkaBundled from "../../../resources/heights/novyinovka.bin?asset";

const BUNDLED: Record<string, string> = {
  badorb: badorbBundled,
  bystrany: bystranyBundled,
  operationrepulse: repulseBundled,
  ironholdcastle: ironholdBundled,
  kirovograd: kirovogradBundled,
  mogadishu: mogadishuBundled,
  novyinovka: novyinovkaBundled
};

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
    const bundled = BUNDLED[terrainId];
    if (!bundled) return null;
    try {
      return await readFile(bundled);
    } catch {
      return null;
    }
  }
}
