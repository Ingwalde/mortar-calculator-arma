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
  M252: SpreadAxes;
  "2B14": SpreadAxes;
}

/** Верхня межа значення, % дальності: усе, що більше, — явна помилка вводу. */
export const MAX_SPREAD_PCT = 30;

export function defaultSpread(): SpreadSettings {
  return { on: false, M252: { len: 0, wid: 0 }, "2B14": { len: 0, wid: 0 } };
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
  for (const w of ["M252", "2B14"] as const) {
    const a = r[w];
    if (a && typeof a === "object") {
      out[w] = { len: pct((a as Record<string, unknown>).len), wid: pct((a as Record<string, unknown>).wid) };
    }
  }
  return out;
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
