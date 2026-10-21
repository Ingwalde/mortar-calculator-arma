/** Скільки минуло від часу `then` до `now`, для підписів «оновлено 4 хв тому». */
export type Age = { unit: "now" } | { unit: "min" | "h" | "d"; n: number };

export function ageOf(then: number, now: number = Date.now()): Age {
  const ms = Math.max(0, now - then);
  const min = Math.floor(ms / 60000);
  if (min < 1) return { unit: "now" };
  if (min < 60) return { unit: "min", n: min };
  const h = Math.floor(min / 60);
  if (h < 48) return { unit: "h", n: h };
  return { unit: "d", n: Math.floor(h / 24) };
}
