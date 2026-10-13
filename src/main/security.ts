/**
 * Перевірки довіри для IPC і навігації. Рендерер вважається потенційно скомпрометованим (наприклад,
 * через шкідливий вміст, який потрапив у назву мітки чи імпортований файл): усе, що він просить у main,
 * перевіряється тут, а не береться на віру.
 */
import { findPreset } from "../core/terrains";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isSafeId(v: unknown): v is string {
  return typeof v === "string" && ID_RE.test(v);
}

/** Розмір терену в метрах — розумні межі, інакше це явно помилка або зловмисний ввід. */
export function isSafeTerrainSize(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 100 && v <= 200000;
}

/** Лише http(s) відкриваємо у браузері системи; file:, smb:, ms-*: тощо — ні. */
export function isAllowedExternalUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** URL знімка карти, який дозволено качати для терену: лише той, що вказано в каталозі (terrains-data). */
export function expectedImageUrl(terrainId: string): string | null {
  return findPreset(terrainId)?.mapImage ?? null;
}

/** URL даних висот, дозволений для терену. */
export function expectedHeightsUrl(terrainId: string): string | null {
  return findPreset(terrainId)?.heightData ?? null;
}

// Шлях до зображення карти приймаємо лише той, що користувач щойно вибрав у системному діалозі:
// рендерер не може змусити main читати довільний файл.
const approvedPaths = new Map<string, number>();
const APPROVAL_TTL_MS = 10 * 60 * 1000;

export function approveImagePath(path: string, now: number = Date.now()): void {
  for (const [p, t] of approvedPaths) if (now - t > APPROVAL_TTL_MS) approvedPaths.delete(p);
  approvedPaths.set(path, now);
}

export function isApprovedImagePath(path: unknown, now: number = Date.now()): boolean {
  if (typeof path !== "string") return false;
  const t = approvedPaths.get(path);
  return t !== undefined && now - t <= APPROVAL_TTL_MS;
}

export function consumeApprovedImagePath(path: unknown): void {
  if (typeof path === "string") approvedPaths.delete(path);
}

/** Верхня межа розміру одного завантаження (знімки з каталогу — до ~2,5 ГБ). */
export const MAX_DOWNLOAD_BYTES = 4 * 1024 * 1024 * 1024;
