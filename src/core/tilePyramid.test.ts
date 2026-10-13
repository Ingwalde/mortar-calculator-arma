import { describe, expect, it } from "vitest";
import { finestLevel, planPyramid, pyramidTilePath } from "./tilePyramid";

describe("planPyramid", () => {
  it("matches the real sharp .tile({layout:'google'}) output for a 32768x32768 image", () => {
    // Перевірено безпосередньо: scripts/test-tile-import.mjs на maps/everon_sat_z7_full.png
    // дав рівні z=0..7 з колонками 1,2,4,8,16,32,64,128 і сумарно 21845 тайлів.
    const plan = planPyramid(32768, 32768);
    expect(plan.maxLevel).toBe(7);
    expect(plan.levels.map((l) => l.cols)).toEqual([1, 2, 4, 8, 16, 32, 64, 128]);
    expect(plan.levels.map((l) => l.rows)).toEqual([1, 2, 4, 8, 16, 32, 64, 128]);
    expect(plan.totalTiles).toBe(21845);
    expect(finestLevel(plan)).toEqual({ z: 7, width: 32768, height: 32768, cols: 128, rows: 128 });
  });

  it("handles non-power-of-two and non-square images with ceil()", () => {
    const plan = planPyramid(5120, 10240);
    // maxDim=10240 -> maxLevel = ceil(log2(10240/256)) = ceil(log2(40)) = 6
    expect(plan.maxLevel).toBe(6);
    const top = finestLevel(plan);
    expect(top.width).toBe(5120);
    expect(top.height).toBe(10240);
    expect(top.cols).toBe(20);
    expect(top.rows).toBe(40);
  });

  it("never produces zero levels, even for a tiny image", () => {
    const plan = planPyramid(100, 100);
    expect(plan.maxLevel).toBe(0);
    expect(plan.levels).toHaveLength(1);
    expect(plan.totalTiles).toBe(1);
  });
});

describe("pyramidTilePath", () => {
  it("formats as z/x/y.webp", () => {
    expect(pyramidTilePath(7, 12, 3)).toBe("7/12/3.webp");
  });
});
