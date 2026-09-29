import { describe, expect, it } from "vitest";
import { EDGE_OFFSET, SPAN0, tileIndexForWorld, tileSpan, tileUrl, tileWorldBounds } from "./onlineTiles";

describe("tileSpan", () => {
  it("doubles with each LOD, LOD0 ~100m", () => {
    expect(tileSpan(0)).toBeCloseTo(SPAN0, 6);
    expect(tileSpan(1)).toBeCloseTo(SPAN0 * 2, 6);
    expect(tileSpan(5)).toBeCloseTo(SPAN0 * 32, 6);
  });
});

describe("tileIndexForWorld / tileWorldBounds", () => {
  it("places world origin inside tile (0,0) at LOD0 given the 50m edge offset", () => {
    const idx = tileIndexForWorld(0, 0, 0);
    expect(idx).toEqual({ x: 0, y: 0 });
    const bounds = tileWorldBounds(0, 0, 0);
    expect(bounds.x0).toBeCloseTo(-EDGE_OFFSET, 6);
    expect(bounds.x1).toBeCloseTo(tileSpan(0) - EDGE_OFFSET, 6);
  });

  it("a point is always within the bounds of the tile that contains it", () => {
    for (const lod of [0, 1, 2, 3, 4, 5]) {
      for (const [x, z] of [
        [4893, 11801],
        [0, 0],
        [12799, 12799],
        [-49, -49]
      ]) {
        const idx = tileIndexForWorld(x, z, lod);
        const b = tileWorldBounds(idx.x, idx.y, lod);
        expect(x).toBeGreaterThanOrEqual(b.x0);
        expect(x).toBeLessThan(b.x1 + 1e-9);
        expect(z).toBeGreaterThanOrEqual(b.z0);
        expect(z).toBeLessThan(b.z1 + 1e-9);
      }
    }
  });
});

describe("tileUrl", () => {
  it("builds the reforger.recoil.org map-tiles path", () => {
    expect(tileUrl("https://reforger.recoil.org/map-tiles/everon/", 5, 1, 3)).toBe(
      "https://reforger.recoil.org/map-tiles/everon/5/1/3/tile.jpg"
    );
  });
});
