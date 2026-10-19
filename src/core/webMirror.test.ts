import { describe, expect, it } from "vitest";
import { modMapTilePath, webHeightsPath, webModMap, WEB_MOD_MAPS } from "./webMirror";
import { PRESETS } from "./terrains";

describe("webMirror", () => {
  it("шляхи відносні й без токенів", () => {
    expect(modMapTilePath("bystrany", 3, 4, 5)).toBe("maps/bystrany/3/4/5.webp");
    expect(webHeightsPath("everon")).toBe("heights/everon.bin.gz");
  });

  it("успадковані ключі (__proto__, constructor) не вважаються теренами", () => {
    for (const bad of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      expect(webModMap(bad)).toBeNull();
    }
    expect(webModMap("bystrany")).not.toBeNull();
  });

  it("карти модів є лише для теренів із каталогу, і тайлів з першоджерела для них нема", () => {
    for (const id of Object.keys(WEB_MOD_MAPS)) {
      const p = PRESETS.find((t) => t.id === id);
      expect(p, id).toBeTruthy();
      expect(p!.tiles, id).toBeFalsy();
    }
  });

});
