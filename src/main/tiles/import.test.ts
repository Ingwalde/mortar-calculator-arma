import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTilePyramid } from "./import";

sharp.cache(false);
let dir = "";
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "mortar-import-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }).catch(() => undefined);
});

describe("buildTilePyramid", () => {
  it("нарізає зображення на піраміду WebP-тайлів 256x256", async () => {
    const src = join(dir, "src.png");
    await sharp({ create: { width: 1100, height: 900, channels: 3, background: { r: 40, g: 120, b: 60 } } })
      .composite([{ input: Buffer.from('<svg width="400" height="300"><rect width="400" height="300" fill="#c33"/></svg>'), left: 200, top: 150 }])
      .png()
      .toFile(src);
    const out = join(dir, "pyr");
    const res = await buildTilePyramid(src, 1100, 900, out);
    expect(res.croppedWidth).toBe(1100);
    expect(res.croppedHeight).toBe(900);
    expect(res.plan.maxLevel).toBeGreaterThanOrEqual(2);

    const top = join(out, String(res.plan.maxLevel));
    const rows = await readdir(top);
    expect(rows.length).toBeGreaterThan(0);
    const files = await readdir(join(top, rows[0]));
    expect(files.every((f) => f.endsWith(".webp"))).toBe(true);
    const meta = await sharp(join(top, rows[0], files[0])).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBeLessThanOrEqual(256);
    expect(meta.height).toBeLessThanOrEqual(256);
  });

  it("обрізає квадратно доповнене зображення до пропорцій терену", async () => {
    const src = join(dir, "padded.png");
    // терен 2000x1000 м, зображення квадратне з білим доповненням знизу
    await sharp({ create: { width: 800, height: 800, channels: 3, background: { r: 255, g: 255, b: 255 } } })
      .composite([{ input: { create: { width: 800, height: 400, channels: 3, background: { r: 10, g: 80, b: 200 } } }, left: 0, top: 0 }])
      .png()
      .toFile(src);
    const res = await buildTilePyramid(src, 2000, 1000, join(dir, "pyr2"));
    expect(res.croppedWidth).toBe(800);
    expect(res.croppedHeight).toBe(400);
  });
});
