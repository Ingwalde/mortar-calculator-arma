/**
 * Карти, що постачаються разом із ПК-застосунком (resources/maps/<id>/{z}/{рядок}/{колонка}.webp, повна піраміда),
 * тож їх не треба імпортувати вручну. Розмір — розмір повної піраміди (рівні 0..maxLevel).
 * Власний імпорт користувача має пріоритет: вбудована карта підставляється, лише коли власної нема.
 */
export const BUNDLED_MAPS: Readonly<Record<string, { width: number; height: number }>> = {
  novyinovka: { width: 8192, height: 8192 }
};

export function bundledMap(terrainId: string): { width: number; height: number } | null {
  return Object.hasOwn(BUNDLED_MAPS, terrainId) ? BUNDLED_MAPS[terrainId] : null;
}
