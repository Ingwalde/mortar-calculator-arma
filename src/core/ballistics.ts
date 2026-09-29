/**
 * Балістика — формули з mortar_core/BallisticCalculator.js (GeNeFRAG/ArmaReforger, MIT),
 * дані з mortar_core/ballistic-data.json (той самий репозиторій, лише M252 і 2Б14).
 * Перенесено з прототипу (функції interp()/solve()), формули звірені з оригіналом:
 *  - лінійна інтерполяція по дальності;
 *  - corr = (dh/100) * dElev; якщо dh < -100, corr *= 0.6 (HEIGHT_CORRECTION_FACTOR);
 *  - кут = табличний - corr; час польоту = tof + (dh/100) * tofPer100m.
 */
import rawData from "./ballistic-data.json";

export type WeaponId = "M252" | "2B14";
export type ShellType = "HE" | "Illumination" | "Smoke";

export interface TableRow {
  range: number;
  elevation: number;
  tof: number;
  dElev: number;
  tofPer100m: number;
}

export interface Charge {
  level: number;
  minRange: number;
  maxRange: number;
  table: TableRow[];
}

export interface Shell {
  name: string;
  charges: Charge[];
}

export interface Weapon {
  name: string;
  milsPerCircle: number;
  shells: Record<string, Shell>;
}

export const TABLES = rawData as unknown as Record<WeaponId, Weapon>;

const HEIGHT_CORRECTION_FACTOR = 0.6;

export interface Interpolated {
  elevation: number;
  tof: number | null;
  dElev: number;
  tofPer100m: number;
}

/** Лінійна інтерполяція по дальності між сусідніми рядками таблиці заряду. */
export function interpolate(table: TableRow[], distance: number): Interpolated | null {
  let lower: TableRow | null = null;
  let upper: TableRow | null = null;
  for (const row of table) {
    if (row.range === distance) {
      return { elevation: row.elevation, tof: row.tof, dElev: row.dElev, tofPer100m: row.tofPer100m };
    }
    if (row.range < distance) lower = row;
    else {
      upper = row;
      break;
    }
  }
  if (!lower || !upper) return null;
  const f = (distance - lower.range) / (upper.range - lower.range);
  const lerp = (a: number, b: number) => a + (b - a) * f;
  return {
    elevation: lerp(lower.elevation, upper.elevation),
    tof: lower.tof == null || upper.tof == null ? null : lerp(lower.tof, upper.tof),
    dElev: lerp(lower.dElev, upper.dElev),
    // округлення до 2 знаків через toFixed — так само, як у BallisticCalculator.js
    // (interpolateFromTable), щоб не розходитись на межових значеннях через float-похибку
    tofPer100m: Number(lerp(lower.tofPer100m || 0, upper.tofPer100m || 0).toFixed(2))
  };
}

export interface Solution {
  /** Номер заряду. */
  charge: number;
  /** Кут підвищення в мілях, з поправкою на висоту, округлений. */
  elevation: number;
  /** Кут підвищення без поправки на висоту (табличний, округлений). */
  baseElevation: number;
  /** Час польоту в секундах, з поправкою на висоту (null, якщо в таблиці немає ТПВ). */
  timeOfFlight: number | null;
}

/**
 * Розв'язки для всіх зарядів, що дістають задану дальність, відсортовані як у таблиці
 * (від найменшого заряду до найбільшого) — перший придатний є рекомендованим.
 */
export function solve(
  weapon: WeaponId,
  shellType: string,
  distance: number,
  heightDiff: number | null
): Solution[] {
  const shell = TABLES[weapon]?.shells[shellType];
  if (!shell) return [];
  const out: Solution[] = [];
  for (const charge of shell.charges) {
    if (distance < charge.minRange || distance > charge.maxRange) continue;
    const r = interpolate(charge.table, distance);
    if (!r) continue;
    let corr = 0;
    let tof = r.tof;
    if (heightDiff !== null && heightDiff !== 0) {
      corr = (heightDiff / 100) * r.dElev;
      if (heightDiff < -100) corr *= HEIGHT_CORRECTION_FACTOR;
      if (tof != null) tof += (heightDiff / 100) * r.tofPer100m;
    }
    out.push({
      charge: charge.level,
      elevation: Math.round(r.elevation - corr),
      baseElevation: Math.round(r.elevation),
      timeOfFlight: tof
    });
  }
  return out;
}

export function shellRange(weapon: WeaponId, shellType: string): { min: number; max: number } {
  const shell = TABLES[weapon].shells[shellType];
  return {
    min: Math.min(...shell.charges.map((c) => c.minRange)),
    max: Math.max(...shell.charges.map((c) => c.maxRange))
  };
}

/** Азимут ціль-міномет у мілях системи міномета (0..milsPerCircle) і в градусах (0..360). */
export function bearing(dx: number, dz: number, milsPerCircle: number): { deg: number; mils: number } {
  let deg = (Math.atan2(dx, dz) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  const mils = Math.round((deg / 360) * milsPerCircle) % milsPerCircle;
  return { deg, mils };
}
