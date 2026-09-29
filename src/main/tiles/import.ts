/**
 * Нарізка великого зображення карти (до ~1 ГБ) на піраміду тайлів через sharp (libvips) —
 * регіональна обробка, без завантаження всього файлу в пам'ять рендерера чи навіть main.
 * Дизайн підтверджено експериментом (scripts/test-tile-import.mjs) на реальному 663 МБ
 * 32768x32768 PNG: ~46 с, коректна структура {z}/{x}/{y}.jpg.
 *
 * Кадрування (auto-crop padding для неквадратних теренів із квадратно доповненим
 * зображенням) використовує ту саму region() з core/geometry.ts, що й рендерер —
 * тобто після імпорту збережена піраміда вже 1:1 відповідає world-координатам
 * і рендереру більше не потрібно "вирізати" регіон під час показу.
 */
import { mkdir, rm, readdir } from "node:fs/promises";
import sharp from "sharp";
import { region, type MapGeometry } from "../../core/geometry";
import { planPyramid, type PyramidPlan } from "../../core/tilePyramid";

export interface ImportProgress {
  done: number;
  total: number;
}

export interface ImportResult {
  plan: PyramidPlan;
  croppedWidth: number;
  croppedHeight: number;
}

export class ImportCancelledError extends Error {
  constructor() {
    super("Імпорт карти скасовано");
    this.name = "ImportCancelledError";
  }
}

async function countFilesRecursive(dir: string): Promise<number> {
  let count = 0;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    if (e.isDirectory()) count += await countFilesRecursive(`${dir}/${e.name}`);
    else count++;
  }
  return count;
}

export async function buildTilePyramid(
  sourcePath: string,
  mapSizeX: number,
  mapSizeZ: number,
  outDir: string,
  onProgress?: (p: ImportProgress) => void,
  signal?: AbortSignal
): Promise<ImportResult> {
  if (signal?.aborted) throw new ImportCancelledError();

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const meta = await sharp(sourcePath, { limitInputPixels: false }).metadata();
  if (!meta.width || !meta.height) throw new Error("Не вдалося визначити розмір зображення карти");

  const geometry: MapGeometry = {
    calib: { mode: "size", size: mapSizeX, sizeZ: mapSizeZ, a: null, b: null },
    imgW: meta.width,
    imgH: meta.height,
    mapSize: mapSizeX,
    mapSizeZ: mapSizeZ
  };
  const r = region(geometry);
  const croppedWidth = Math.round(r.w);
  const croppedHeight = Math.round(r.h);

  let pipeline = sharp(sourcePath, { limitInputPixels: false, sequentialRead: true });
  if (croppedWidth !== meta.width || croppedHeight !== meta.height) {
    pipeline = pipeline.extract({ left: 0, top: 0, width: croppedWidth, height: croppedHeight });
  }

  const plan = planPyramid(croppedWidth, croppedHeight);

  let cancelled = false;
  const onAbort = () => {
    cancelled = true;
    pipeline.destroy();
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  let pollTimer: ReturnType<typeof setInterval> | undefined;
  if (onProgress) {
    onProgress({ done: 0, total: plan.totalTiles });
    pollTimer = setInterval(() => {
      void countFilesRecursive(outDir).then((done) => onProgress({ done, total: plan.totalTiles }));
    }, 400);
  }

  try {
    await pipeline.tile({ size: 256, layout: "google" }).toFile(outDir);
  } catch (err) {
    if (cancelled) throw new ImportCancelledError();
    throw err;
  } finally {
    if (pollTimer) clearInterval(pollTimer);
    signal?.removeEventListener("abort", onAbort);
  }

  if (cancelled) throw new ImportCancelledError();
  onProgress?.({ done: plan.totalTiles, total: plan.totalTiles });

  return { plan, croppedWidth, croppedHeight };
}
