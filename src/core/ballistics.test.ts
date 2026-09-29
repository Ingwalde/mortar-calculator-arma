import { describe, expect, it } from "vitest";
import { bearing, interpolate, shellRange, solve, TABLES, type ShellType, type WeaponId } from "./ballistics";
// Незалежний еталон, дослівно вирізаний з оригінального BallisticCalculator.js (MIT) — див. файл.
import * as refModule from "../../test/vendor/BallisticCalculator.reference.cjs";

const ref = (refModule as unknown as { default?: typeof refModule }).default ?? refModule;

describe("контрольний приклад з ТЗ", () => {
  it("2Б14, ОФ, заряд 2, 856 м, dh=-20 -> 1186 мілів", () => {
    const [sol] = solve("2B14", "HE", 856, -20).filter((s) => s.charge === 2);
    expect(sol).toBeDefined();
    // інтерполяція 1181.8, dElev 22.56 -> corr=-4.512 -> 1181.8-(-4.512)=1186.31
    expect(sol.elevation).toBe(1186);
  });
});

describe("solve() узгоджений з еталонним BallisticCalculator.js", () => {
  const weapons: WeaponId[] = ["M252", "2B14"];

  for (const weapon of weapons) {
    const shellTypes = Object.keys(TABLES[weapon].shells) as ShellType[];
    for (const shellType of shellTypes) {
      it(`${weapon} / ${shellType}: збігається з еталоном на випадкових дальностях і перевищеннях`, () => {
        const shell = TABLES[weapon].shells[shellType];
        let rng = 1234567 + weapon.length * 97 + shellType.length;
        const next = () => {
          rng = (rng * 1103515245 + 12345) & 0x7fffffff;
          return rng / 0x7fffffff;
        };
        for (const charge of shell.charges) {
          for (let i = 0; i < 30; i++) {
            const distance = Math.round(charge.minRange + next() * (charge.maxRange - charge.minRange));
            const heightDiff = Math.round((next() - 0.5) * 600); // [-300, 300]

            const ours = solve(weapon, shellType, distance, heightDiff).find((s) => s.charge === charge.level);
            const base = ref.interpolateFromTable(charge.table, distance);
            expect(ours, `no solution for ${weapon}/${shellType}/charge ${charge.level} @ ${distance}m`).toBeDefined();
            if (!ours || !base) continue;

            const expectedElevation = Math.round(
              ref.applyHeightCorrection(base.elevation, heightDiff, base.dElev)
            );
            expect(ours.elevation).toBe(expectedElevation);

            if (base.tof == null) {
              expect(ours.timeOfFlight).toBeNull();
            } else {
              const expectedTof = ref.applyTOFCorrection(base.tof, heightDiff, base.tofPer100m || 0)!;
              expect(ours.timeOfFlight).not.toBeNull();
              expect(ours.timeOfFlight!).toBeCloseTo(expectedTof, 6);
            }
          }
        }
      });
    }
  }
});

describe("interpolate()", () => {
  it("returns exact row values when distance matches a table entry", () => {
    const table = TABLES["2B14"].shells.HE.charges.find((c) => c.level === 2)!.table;
    const r = interpolate(table, 800);
    expect(r).toEqual({ elevation: 1207, tof: 23.7, dElev: 22, tofPer100m: 0.2 });
  });

  it("returns null outside the table's range", () => {
    const table = TABLES["2B14"].shells.HE.charges.find((c) => c.level === 2)!.table;
    expect(interpolate(table, 50)).toBeNull();
    expect(interpolate(table, 5000)).toBeNull();
  });
});

describe("shellRange()", () => {
  it("spans the min/max of all charges combined", () => {
    const r = shellRange("2B14", "HE");
    expect(r.min).toBe(50);
    expect(r.max).toBe(2300);
  });
});

describe("bearing()", () => {
  it("converts a north-pointing vector to 0 mils / 0 degrees", () => {
    const b = bearing(0, 100, 6400);
    expect(b.deg).toBeCloseTo(0);
    expect(b.mils).toBe(0);
  });

  it("converts an east-pointing vector to a quarter circle", () => {
    const b = bearing(100, 0, 6400);
    expect(b.deg).toBeCloseTo(90);
    expect(b.mils).toBe(1600);
  });

  it("wraps negative angles into [0, 360)", () => {
    const b = bearing(-100, 0, 6000);
    expect(b.deg).toBeCloseTo(270);
    expect(b.mils).toBe(4500);
  });
});
