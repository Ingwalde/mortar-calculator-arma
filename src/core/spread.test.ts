import { describe, expect, it } from "vitest";
import { MAX_SPREAD_PCT, defaultSpread, normalizeSpread, spreadOutline, spreadRadii } from "./spread";

describe("spread", () => {
  it("радіуси — відсоток дальності; без значень розкиду нема", () => {
    expect(spreadRadii(1000, { len: 3, wid: 1.5 })).toEqual({ a: 30, b: 15 });
    expect(spreadRadii(1000, { len: 0, wid: 0 })).toBeNull();
    expect(spreadRadii(0, { len: 3, wid: 1 })).toBeNull();
    expect(spreadRadii(NaN, { len: 3, wid: 1 })).toBeNull();
  });

  it("одна задана вісь дає круг, а не відрізок", () => {
    expect(spreadRadii(500, { len: 4, wid: 0 })).toEqual({ a: 20, b: 20 });
    expect(spreadRadii(500, { len: 0, wid: 2 })).toEqual({ a: 10, b: 10 });
  });

  it("налаштування очищаються: сміття, від'ємні й надто великі значення", () => {
    expect(normalizeSpread(null)).toEqual(defaultSpread());
    const n = normalizeSpread({ on: true, M252: { len: "5", wid: -2 }, "2B14": { len: 999, wid: "abc" } });
    expect(n.on).toBe(true);
    expect(n.M252).toEqual({ len: 5, wid: 0 });
    expect(n["2B14"]).toEqual({ len: MAX_SPREAD_PCT, wid: 0 });
    expect(normalizeSpread({ on: "yes" }).on).toBe(false);
  });

  it("контур еліпса: велика вісь уздовж лінії вогню", () => {
    // вогонь на схід (ux=1,uz=0): вісь a — по X, b — по Z
    const pts = spreadOutline(100, 200, 1, 0, 30, 10, 4);
    expect(pts).toHaveLength(4);
    expect(pts[0].x).toBeCloseTo(130);
    expect(pts[0].z).toBeCloseTo(200);
    expect(pts[1].x).toBeCloseTo(100);
    expect(pts[1].z).toBeCloseTo(210);
    // вогонь на північ (ux=0,uz=1): вісь a — по Z
    const n = spreadOutline(0, 0, 0, 1, 30, 10, 4);
    expect(n[0].x).toBeCloseTo(0);
    expect(n[0].z).toBeCloseTo(30);
  });
});
