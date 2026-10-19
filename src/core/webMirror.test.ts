import { describe, expect, it } from "vitest";
import { siteTilePath, detailTilePath, isDetailTile, isMirroredTile, mirroredTilePath, webDetailMinLod, webHeightsPath, webMirrorMinLod, webModMap, WEB_DETAIL_MIN_LOD, WEB_MIRROR_MIN_LOD } from "./webMirror";
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

  it("успадковані ключі (__proto__, constructor) не вважаються теренами", () => {
    for (const bad of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      expect(webModMap(bad)).toBeNull();
      expect(webMirrorMinLod(bad)).toBeUndefined();
      expect(isMirroredTile(bad, 5)).toBe(false);
    }
    expect(webModMap("bystrany")).not.toBeNull();
    expect(webMirrorMinLod("everon")).toBe(2);
  });

  it("деталізовані рівні: тільки глибші за дзеркальні й лише з відомих теренів", () => {
    expect(isDetailTile("everon", 1)).toBe(true);
    expect(isDetailTile("everon", 2)).toBe(false); // це вже дзеркало
    expect(isDetailTile("everon", 0)).toBe(false); // на сайті не лежить
    expect(isDetailTile("arland", 0)).toBe(true);
    expect(isDetailTile("arland", 1)).toBe(false);
    expect(isDetailTile("bystrany", 0)).toBe(false);
    expect(isDetailTile("__proto__", 0)).toBe(false);
    expect(webDetailMinLod("constructor")).toBeUndefined();
    expect(detailTilePath("everon", 1, 3, 4)).toBe("tiles-hd/everon/1/3/4.jpg");
  });

  it("деталізовані рівні безперервно продовжують дзеркальні (без дірок між ними)", () => {
    for (const [id, d] of Object.entries(WEB_DETAIL_MIN_LOD)) {
      expect(d).toBeLessThan(WEB_MIRROR_MIN_LOD[id]);
    }
  });

  it("siteTilePath: PWA бере дзеркальні й деталізовані зі свого сайту, APK — лише дзеркальні, решта онлайн", () => {
    // Everon: дзеркало LOD >= 2, деталізовані LOD 1, LOD 0 — лише онлайн
    expect(siteTilePath("everon", 3, 1, 2, false)).toBe("tiles/everon/3/1/2.jpg");
    expect(siteTilePath("everon", 2, 1, 2, false)).toBe("tiles/everon/2/1/2.jpg");
    expect(siteTilePath("everon", 1, 5, 6, false)).toBe("tiles-hd/everon/1/5/6.jpg");
    expect(siteTilePath("everon", 0, 5, 6, false)).toBeNull();
    expect(siteTilePath("everon", 1, 5, 6, true)).toBeNull(); // APK: tiles-hd нема в пакеті
    expect(siteTilePath("everon", 2, 5, 6, true)).toBe("tiles/everon/2/5/6.jpg");
    // Arland: дзеркало LOD >= 1, деталізований LOD 0
    expect(siteTilePath("arland", 0, 2, 3, false)).toBe("tiles-hd/arland/0/2/3.jpg");
    expect(siteTilePath("arland", 0, 2, 3, true)).toBeNull();
    expect(siteTilePath("bystrany", 1, 0, 0, false)).toBeNull();
    expect(siteTilePath("__proto__", 1, 0, 0, false)).toBeNull();
  });
});
