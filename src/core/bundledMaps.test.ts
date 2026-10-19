import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BUNDLED_MAPS, bundledMap } from "./bundledMaps";
import { planPyramid } from "./tilePyramid";

describe("bundledMaps", () => {
  it("лише власні ключі: __proto__ тощо не вважаються картами", () => {
    expect(bundledMap("__proto__")).toBeNull();
    expect(bundledMap("constructor")).toBeNull();
    expect(bundledMap("novyinovka")).toEqual({ width: 8192, height: 8192 });
    expect(bundledMap("everon")).toBeNull();
  });

  it("для кожної вбудованої карти є всі тайли піраміди в resources/maps", () => {
    for (const [id, dim] of Object.entries(BUNDLED_MAPS)) {
      const plan = planPyramid(dim.width, dim.height);
      for (const lv of plan.levels) {
        for (let row = 0; row < lv.rows; row++) {
          for (let col = 0; col < lv.cols; col++) {
            expect(existsSync(join("resources", "maps", id, String(lv.z), String(row), col + ".webp")), id + " " + lv.z + "/" + row + "/" + col).toBe(true);
          }
        }
      }
    }
  });
});
