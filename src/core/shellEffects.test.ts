import { describe, expect, it } from "vitest";
import { dangerRadius, fragmentationRange, friendlyWarnings } from "./shellEffects";
import { defaultSpread, gameRangeSpread } from "./spread";

describe("відстань осколків з файлів гри", () => {
  it("HE обох гармат — 25 м; освітлювальні без осколків", () => {
    expect(fragmentationRange("M252", "HE")).toBe(25);
    expect(fragmentationRange("2B14", "HE")).toBe(25);
    expect(fragmentationRange("M252", "Illumination")).toBeNull();
    expect(fragmentationRange("2B14", "Illumination")).toBeNull();
  });
  it("невідомий снаряд — немає даних", () => {
    expect(fragmentationRange("M252", "Nuke")).toBeNull();
  });
});

describe("радіус небезпеки", () => {
  it("дорівнює розкиду за даними гри плюс осколки (автоматичний режим)", () => {
    const g = gameRangeSpread("M252", 2, 1000)!;
    const d = dangerRadius("M252", "HE", 2, 1000, defaultSpread())!;
    expect(d.fragments).toBe(25);
    expect(d.dispersion).toBeCloseTo(Math.max(g.a, g.b), 6);
    expect(d.radius).toBeCloseTo(d.dispersion + 25, 6);
  });
  it("ручні відсотки беруть гору, коли розкид увімкнено вручну", () => {
    const spread = { ...defaultSpread(), on: true, auto: false, M252: { len: 5, wid: 2 } };
    const d = dangerRadius("M252", "HE", 2, 1000, spread)!;
    expect(d.dispersion).toBeCloseTo(50, 6);
    expect(d.radius).toBeCloseTo(75, 6);
  });
  it("без даних про осколки — null", () => {
    expect(dangerRadius("M252", "Illumination", 2, 1000, defaultSpread())).toBeNull();
  });
});

describe("попередження про своїх", () => {
  const danger = { radius: 100, dispersion: 75, fragments: 25 };
  const target = { x: 1000, z: 1000 };
  it("бере лише мітки в зоні, від найближчої", () => {
    const friends = [
      { id: "a", name: "Alpha-2", x: 1110, z: 1000, u: 1 },
      { id: "b", name: "Bravo", x: 1060, z: 1000, u: 2 },
      { id: "c", name: "Far", x: 1300, z: 1000, u: 3 }
    ];
    const w = friendlyWarnings(target, friends, danger);
    expect(w.map((x) => x.id)).toEqual(["b"]);
    expect(w[0].distance).toBeCloseTo(60, 6);
    expect(friendlyWarnings(target, friends, { ...danger, radius: 120 }).map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("рівно на межі — входить; без даних — порожньо", () => {
    expect(friendlyWarnings(target, [{ id: "e", name: "Edge", x: 1100, z: 1000, u: 0 }], danger)).toHaveLength(1);
    expect(friendlyWarnings(target, [{ id: "e", name: "Edge", x: 1010, z: 1000, u: 0 }], null)).toEqual([]);
  });
});
