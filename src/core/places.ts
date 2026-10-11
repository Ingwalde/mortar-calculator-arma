/**
 * Важливість пункту на карті: 1 — головні (бази, аеродроми, великі міста), 2 — звичайні населені
 * пункти, 3 — другорядні (ферми, пагорби, печери, пляжі, КПП). Перший вибір робить terrains-data.json
 * (4-й елемент пункту, обчислений scripts/rank-places.mjs із щільності забудови мода);
 * для пунктів без нього — евристика за назвою.
 */
export type PlaceTier = 1 | 2 | 3;

const MAJOR = /\b(airport|airfield|air ?base|base|military|power plant|hospital|port|refinery|factory|castle|city|town|administration|capital)\b/i;
const MINOR = /\b(farm|cave|hill|ridge|beach|pond|lake|forest|hollow|wood|woods|quarry|sawmill|bunker|bunkers|battery|tunnel|checkpoint|locker|rest|riverbed|fields|bush|yard|wreck|beacon|pass|valley|bay|find|mine|spring|rock|stone|signal|pig|ranch|hof|berg|wasserversorgung|fm)\b/i;

export function placeTier(name: string): PlaceTier {
  if (MAJOR.test(name)) return 1;
  if (MINOR.test(name)) return 3;
  return 2;
}

/** Множник розміру шрифту й ваги за важливістю. */
export const TIER_SCALE: Record<PlaceTier, number> = { 1: 1.25, 2: 1, 3: 0.85 };
export const TIER_WEIGHT: Record<PlaceTier, number> = { 1: 700, 2: 500, 3: 500 };

export const PLACES_SCALE_MIN = 0.6;
export const PLACES_SCALE_MAX = 2;

export function clampPlacesScale(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(PLACES_SCALE_MAX, Math.max(PLACES_SCALE_MIN, n));
}

export function normalizePlacesLevel(v: unknown): PlaceTier {
  return v === 1 || v === 2 ? v : 3;
}
