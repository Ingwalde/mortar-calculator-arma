import { describe, expect, it } from "vitest";
import { MAX_SPREAD_PCT, defaultSpread, gameRangeSpread, normalizeSpread, spreadOutline, spreadRadii } from "./spread";

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

  it("оцінка за даними гри: менший розкид на більших зарядах, нічого без даних", () => {
    const c0 = gameRangeSpread("M252", 0, 300)!;
    const c4 = gameRangeSpread("M252", 4, 300)!;
    expect(c0.pct).toBeGreaterThan(c4.pct * 2);
    // M252, заряд 2, 900 м: n=1.66, v=66*2.085=137.6 -> 1.66*3/137.6 = 3.6% -> ~32.6 м
    const m = gameRangeSpread("M252", 2, 900)!;
    expect(m.pct).toBeCloseTo(3.62, 1);
    expect(m.a).toBeCloseTo(32.6, 0);
    expect(m.b).toBeCloseTo(m.a * 0.12, 5);
    expect(gameRangeSpread("2B14", 2, 800)!.a).toBeGreaterThan(20);
    expect(gameRangeSpread("M252", 9, 500)).toBeNull();
    expect(gameRangeSpread("M252", 2, 0)).toBeNull();
  });

  it("налаштування за замовчуванням: авто-режим увімкнено, ручний лишається доступним", () => {
    expect(defaultSpread().auto).toBe(true);
    expect(normalizeSpread({ on: true, auto: false }).auto).toBe(false);
    expect(normalizeSpread({ on: true }).auto).toBe(true);
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
