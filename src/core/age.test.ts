import { describe, expect, it } from "vitest";
import { ageOf } from "./age";

describe("ageOf", () => {
  const now = 10_000_000_000;
  it("щойно, хвилини, години, дні", () => {
    expect(ageOf(now - 30_000, now)).toEqual({ unit: "now" });
    expect(ageOf(now - 4 * 60_000, now)).toEqual({ unit: "min", n: 4 });
    expect(ageOf(now - 59 * 60_000, now)).toEqual({ unit: "min", n: 59 });
    expect(ageOf(now - 3 * 3_600_000, now)).toEqual({ unit: "h", n: 3 });
    expect(ageOf(now - 50 * 3_600_000, now)).toEqual({ unit: "d", n: 2 });
  });
  it("час із майбутнього не дає від'ємного віку", () => {
    expect(ageOf(now + 5000, now)).toEqual({ unit: "now" });
  });
});
