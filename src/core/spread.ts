/**
 * Розкид снарядів навколо цілі: еліпс, велика вісь якого лежить уздовж лінії вогню (помилка за дальністю
 * зазвичай більша за боковий розкид). У таблицях балістики (GeNeFRAG) розкиду нема, тож значення задає
 * користувач у відсотках дальності — окремо для кожної гармати.
 */
export interface SpreadAxes {
  /** Радіус уздовж лінії вогню, % дальності. */
  len: number;
  /** Радіус упоперек лінії вогню, % дальності. */
  wid: number;
}

export interface SpreadSettings {
  on: boolean;
  /** true — радіус за дальністю береться з даних гри (за зарядом); false — ручні відсотки. */
  auto: boolean;
  M252: SpreadAxes;
  "2B14": SpreadAxes;
}

/** Верхня межа значення, % дальності: усе, що більше, — явна помилка вводу. */
export const MAX_SPREAD_PCT = 30;

export function defaultSpread(): SpreadSettings {
  return { on: false, auto: true, M252: { len: 0, wid: 0 }, "2B14": { len: 0, wid: 0 } };
}

function pct(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_SPREAD_PCT, Math.round(n * 100) / 100);
}

/** Приводить довільний (збережений або введений) об'єкт до коректних налаштувань розкиду. */
export function normalizeSpread(raw: unknown): SpreadSettings {
  const out = defaultSpread();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  out.on = r.on === true;
  out.auto = r.auto !== false;
  for (const w of ["M252", "2B14"] as const) {
    const a = r[w];
    if (a && typeof a === "object") {
      out[w] = { len: pct((a as Record<string, unknown>).len), wid: pct((a as Record<string, unknown>).wid) };
    }
  }
  return out;
}

/**
 * Оцінка розкиду за файлами гри (Arma Reforger Server, префаби снарядів і мінометів):
 *  - обидва снаряди успадковують від Ammo_MortarShell_Base `InitSpeedVariation 3` (м/с);
 *  - початкова швидкість M821 = 66 м/с, O-832 = 76 м/с, заряди множать її на коефіцієнти нижче;
 *  - дальність ~ v^n, n береться з балістичних таблиць між сусідніми зарядами (для найбільшого заряду — екстраполяція).
 * Припущення: ±3 м/с діють на кінцеву швидкість (інакше розкид був би ±8,6% / ±7,5% на всіх зарядах).
 * Бокового розкиду (DispersionDiameter) у префабах мінометів нема, тому показується лише розкид за дальністю.
 * Формулу рушія в документації знайти не вдалося: значення варто звіряти в грі.
 */
export const GAME_SHELL_SPEED: Record<"M252" | "2B14", { v0: number; coefs: number[]; n: number[] }> = {
  M252: { v0: 66, coefs: [1, 1.531, 2.085, 2.541, 2.977], n: [1.88, 1.79, 1.66, 1.56, 1.5] },
  "2B14": { v0: 76, coefs: [1, 1.321, 1.736, 2.087, 2.455], n: [1.78, 1.66, 1.52, 1.42, 1.35] }
};
export const GAME_SPEED_VARIATION_MS = 3;
/** Для показу: бокова вісь умовна (бокового розкиду в даних гри нема), частка від осі за дальністю. */
export const AUTO_LATERAL_RATIO = 0.12;

/** Радіус розкиду за дальністю (м) за даними гри для гармати, заряду (0..4) і дальності; null — немає даних. */
export function gameRangeSpread(weapon: "M252" | "2B14", charge: number, rangeM: number): { a: number; b: number; pct: number } | null {
  const cfg = GAME_SHELL_SPEED[weapon];
  const lvl = Math.round(charge);
  if (!cfg || !Number.isFinite(rangeM) || rangeM <= 0 || lvl < 0 || lvl >= cfg.coefs.length) return null;
  const v = cfg.v0 * cfg.coefs[lvl];
  const pct = ((cfg.n[lvl] * GAME_SPEED_VARIATION_MS) / v) * 100;
  const a = (rangeM * pct) / 100;
  return { a, b: Math.max(1, a * AUTO_LATERAL_RATIO), pct };
}

/** Радіуси еліпса в метрах для заданої дальності; null — розкид не задано (обидва значення нульові). */
export function spreadRadii(rangeM: number, axes: SpreadAxes): { a: number; b: number } | null {
  if (!Number.isFinite(rangeM) || rangeM <= 0) return null;
  const a = (rangeM * axes.len) / 100;
  const b = (rangeM * axes.wid) / 100;
  if (a <= 0 && b <= 0) return null;
  // еліпс без однієї осі вироджується в відрізок: беремо другу, щоб лишився видимий круг
  return { a: a > 0 ? a : b, b: b > 0 ? b : a };
}

/** Точки контуру еліпса у світових координатах (центр — ціль, велика вісь — уздовж напрямку вогню ux,uz). */
export function spreadOutline(
  cx: number,
  cz: number,
  ux: number,
  uz: number,
  a: number,
  b: number,
  steps = 40
): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  // перпендикуляр до напрямку вогню
  const vx = -uz;
  const vz = ux;
  for (let i = 0; i < steps; i++) {
    const th = (i / steps) * Math.PI * 2;
    const ca = Math.cos(th) * a;
    const sb = Math.sin(th) * b;
    pts.push({ x: cx + ux * ca + vx * sb, z: cz + uz * ca + vz * sb });
  }
  return pts;
}
