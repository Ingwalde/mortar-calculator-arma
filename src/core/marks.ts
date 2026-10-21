/**
 * Модель мітки 1.1.0: приналежність (свій / чужий) і вид (піхота, броня, міномет, гелікоптер, відступ).
 * Старе поле `type` (mortar | target | point) лишається: на ньому тримається розрахунок (звідки стріляємо, у що стріляємо),
 * тож воно виводиться з приналежності й виду, а старі мітки отримують їх із `type` (міграція при завантаженні).
 */
export type Affiliation = "friend" | "hostile";
/** `legacy` — стара довільна «точка» без приналежності: лишається на карті, нових таких не створюємо. */
export type MarkKind = "infantry" | "armour" | "mortar" | "helicopter" | "retreat" | "legacy";
export type LegacyType = "mortar" | "target" | "point";

export const AFFILIATIONS: readonly Affiliation[] = ["friend", "hostile"];
/** Види, які можна створити (без `legacy`). */
export const KINDS: readonly Exclude<MarkKind, "legacy">[] = ["infantry", "armour", "mortar", "helicopter", "retreat"];
export const CAPTION_MAX = 120;

export function isAffiliation(v: unknown): v is Affiliation {
  return v === "friend" || v === "hostile";
}

export function isKind(v: unknown): v is MarkKind {
  return v === "legacy" || (typeof v === "string" && (KINDS as readonly string[]).includes(v));
}

/** Тип для розрахунку: свій міномет — звідки стріляємо; будь-яка чужа мітка — ціль; решта — довідкові точки. */
export function typeOf(aff: Affiliation | undefined, kind: MarkKind | undefined): LegacyType {
  if (!aff || kind === "legacy") return "point";
  if (aff === "hostile") return "target";
  return kind === "mortar" ? "mortar" : "point";
}

/** Приналежність і вид для старої мітки за її `type`. */
export function fromLegacyType(type: LegacyType): { aff?: Affiliation; kind: MarkKind } {
  if (type === "mortar") return { aff: "friend", kind: "mortar" };
  if (type === "target") return { aff: "hostile", kind: "infantry" };
  return { kind: "legacy" };
}

export interface MarkClass {
  aff?: Affiliation;
  kind: MarkKind;
  type: LegacyType;
}

/**
 * Читає приналежність і вид із сирого об'єкта (збереженого, імпортованого, з посилання). Некоректні або суперечливі значення
 * відкидаються: тоді береться вивід зі старого `type`. Повертає й узгоджений `type`.
 */
export function readClass(raw: { aff?: unknown; kind?: unknown; type?: unknown }): MarkClass {
  const legacy: LegacyType = raw.type === "mortar" || raw.type === "target" ? raw.type : "point";
  if (isKind(raw.kind)) {
    if (raw.kind === "legacy") return { kind: "legacy", type: "point" };
    if (isAffiliation(raw.aff)) return { aff: raw.aff, kind: raw.kind, type: typeOf(raw.aff, raw.kind) };
  }
  const d = fromLegacyType(legacy);
  return { ...d, type: legacy };
}

export function readCaption(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  // керівні символи прибираємо, пробіли по краях обрізаємо
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, CAPTION_MAX);
  return s.length ? s : undefined;
}

export function isMortarMark(m: { type: LegacyType }): boolean {
  return m.type === "mortar";
}

/** Ціллю розрахунку може бути чужа мітка або стара довільна точка; свої мітки (крім міномета) — ні. */
export function isTargetable(m: { type: LegacyType; kind?: MarkKind }): boolean {
  return m.type === "target" || (m.type === "point" && m.kind === "legacy");
}
