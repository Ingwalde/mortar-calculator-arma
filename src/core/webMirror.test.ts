import { describe, expect, it } from "vitest";
import { isMirroredTile, mirroredTilePath, webHeightsPath, WEB_MIRROR_MIN_LOD } from "./webMirror";
import { PRESETS } from "./terrains";

describe("webMirror", () => {
  it("дзеркалить лише грубі рівні та лише відомі терени", () => {
    expect(isMirroredTile("everon", 5)).toBe(true);
    expect(isMirroredTile("everon", 2)).toBe(true);
    expect(isMirroredTile("everon", 1)).toBe(false);
    expect(isMirroredTile("arland", 1)).toBe(true);
    expect(isMirroredTile("arland", 0)).toBe(false);
    expect(isMirroredTile("bystrany", 3)).toBe(false);
  });

  it("шляхи відносні й без токенів", () => {
    expect(mirroredTilePath("everon", 3, 4, 5)).toBe("tiles/everon/3/4/5.jpg");
    expect(webHeightsPath("everon")).toBe("heights/everon.bin.gz");
  });

  it("усі дзеркалені терени існують у каталозі й мають онлайн-тайли", () => {
    for (const id of Object.keys(WEB_MIRROR_MIN_LOD)) {
      const p = PRESETS.find((t) => t.id === id);
      expect(p?.tiles, id).toBeTruthy();
      expect(WEB_MIRROR_MIN_LOD[id]).toBeLessThanOrEqual(p!.tiles!.maxLod);
    }
  });
});
