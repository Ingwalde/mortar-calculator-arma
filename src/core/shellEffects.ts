/**
 * Небезпечна зона довкола цілі для своїх: радіус розкиду плюс відстань, на яку діють осколки снаряда. Відстань осколків
 * береться з файлів гри (scripts/extract-shell-effects.mjs → shell-effects.json): DamageDistance ефекту
 * ExplosionFragmentationEffect. Для снаряда без осколків даних нема, і попередження для нього не показується.
 */
import effects from "./shell-effects.json";
import { gameRangeSpread, spreadRadii, type SpreadSettings } from "./spread";

export type ShellWeapon = "M252" | "2B14";

interface ShellEntry {
  fragmentation: { distance: number; count: number | null } | null;
}

/** Відстань ураження осколками (м) для гармати й снаряда; null — осколків нема або даних нема. */
export function fragmentationRange(weapon: ShellWeapon, shell: string): number | null {
  const e = (effects.shells as Record<string, ShellEntry | undefined>)[`${weapon}:${shell}`];
  const d = e?.fragmentation?.distance;
  return typeof d === "number" && Number.isFinite(d) && d > 0 ? d : null;
}

export interface DangerRadius {
  /** Загальний радіус небезпеки, м. */
  radius: number;
  /** Радіус розкиду, м. */
  dispersion: number;
  /** Відстань осколків, м. */
  fragments: number;
}

/**
 * Радіус небезпеки навколо цілі. Розкид: ручні відсотки, якщо їх увімкнено, інакше оцінка за даними гри для заряду.
 * null — для цього снаряда нема даних про осколки.
 */
export function dangerRadius(weapon: ShellWeapon, shell: string, charge: number, rangeM: number, spread: SpreadSettings): DangerRadius | null {
  const fragments = fragmentationRange(weapon, shell);
  if (fragments === null) return null;
  let dispersion = 0;
  if (spread.on && !spread.auto) {
    const r = spreadRadii(rangeM, spread[weapon]);
    if (r) dispersion = Math.max(r.a, r.b);
  } else {
    const g = gameRangeSpread(weapon, charge, rangeM);
    if (g) dispersion = Math.max(g.a, g.b);
  }
  return { radius: dispersion + fragments, dispersion, fragments };
}

export interface FriendlyMark {
  id: string;
  name: string;
  x: number;
  z: number;
  /** Час останньої правки, мс (для «оновлено N хв тому»). */
  u: number;
}

export interface FriendlyWarning {
  id: string;
  name: string;
  /** Відстань до цілі, м. */
  distance: number;
  /** Радіус небезпеки, м. */
  radius: number;
  /** Час останньої правки мітки, мс. */
  updatedAt: number;
}

/** Свої мітки в межах небезпечної зони навколо цілі, від найближчої. */
export function friendlyWarnings(target: { x: number; z: number }, friends: readonly FriendlyMark[], danger: DangerRadius | null): FriendlyWarning[] {
  if (!danger) return [];
  const out: FriendlyWarning[] = [];
  for (const f of friends) {
    const d = Math.hypot(f.x - target.x, f.z - target.z);
    if (d <= danger.radius) out.push({ id: f.id, name: f.name, distance: d, radius: danger.radius, updatedAt: f.u });
  }
  return out.sort((a, b) => a.distance - b.distance);
}
