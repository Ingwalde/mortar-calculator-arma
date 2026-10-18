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

/** Чого стосується назва — від цього залежить колір підпису на карті. */
export type PlaceKind = "settlement" | "military" | "transport" | "industry" | "water" | "nature";

export const PLACE_KINDS: PlaceKind[] = ["settlement", "military", "transport", "industry", "water", "nature"];

const KIND_RULES: [PlaceKind, RegExp][] = [
  ["military", /\b(base|military|fob|op|checkpoint|battery|bunkers?|barracks|camp|outpost|fort|castle|garrison|artillery|command)\b/i],
  ["transport", /\b(airport|airfield|airstrip|runway|port|harbou?r|station|tunnel|pass|bridge|crossroads?|junction|railway|dock|highway)\b/i],
  ["industry", /\b(power plant|plant|factory|refinery|mine|quarry|sawmill|industrial|depot|oil|radio|fm|tower|antenna|warehouse|wasserversorgung|forstfahrzeug-wartungshof|blocks)\b/i],
  ["water", /\b(beach|bay|lake|pond|river|riverbed|water|spring|coast|island|sea)\b/i],
  ["nature", /\b(hill|ridge|forest|hollow|woods?|valley|cave|mountain|mount|peak|rock(slide)?|mound|stone|bush|fields?|spielfeld)\b|berg\b/i]
];

export function placeKind(name: string): PlaceKind {
  for (const [kind, re] of KIND_RULES) if (re.test(name)) return kind;
  return "settlement";
}

/** Найближчий іменований пункт у межах `maxM` метрів (для назви цілі за місцем); null, якщо поруч нічого нема. */
export function nearestPlace<T extends { name: string; x: number; z: number }>(places: readonly T[] | undefined, x: number, z: number, maxM = 500): T | null {
  let best: T | null = null;
  let bd = maxM;
  for (const p of places ?? []) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d <= bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}
