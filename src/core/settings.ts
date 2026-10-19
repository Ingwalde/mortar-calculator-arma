/**
 * Налаштування, що потребують власної логіки: доступні й типові снаряди для кожного міномета, гучність.
 * Без DOM — тестується напряму. Кільця (заряди) тут свідомо немає: заряд підбирається автоматично.
 */
export type SettingsWeapon = "M252" | "2B14";
export const SETTINGS_WEAPONS: readonly SettingsWeapon[] = ["M252", "2B14"];

/** Допустимі снаряди кожної гармати (ключі таблиць балістики), передаються ззовні. */
export type ValidShells = Record<SettingsWeapon, readonly string[]>;

export interface ShellChoice {
  /** Снаряди, доступні у списку «Снаряд» (завжди не порожньо). */
  enabled: string[];
  /** Типовий снаряд — один із доступних. */
  def: string;
}
export type ShellSettings = Record<SettingsWeapon, ShellChoice>;

const PREFERRED_DEFAULT = "HE";

function firstValid(valid: readonly string[]): string {
  return valid.includes(PREFERRED_DEFAULT) ? PREFERRED_DEFAULT : (valid[0] ?? PREFERRED_DEFAULT);
}

export function defaultShellSettings(valid: ValidShells): ShellSettings {
  const out = {} as ShellSettings;
  for (const w of SETTINGS_WEAPONS) {
    out[w] = { enabled: [...valid[w]], def: firstValid(valid[w]) };
  }
  return out;
}

/** Приводить збережене/введене до коректного вигляду: лише відомі снаряди, без порожнього набору, типовий серед доступних. */
export function normalizeShellSettings(raw: unknown, valid: ValidShells): ShellSettings {
  const out = defaultShellSettings(valid);
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const w of SETTINGS_WEAPONS) {
    const c = r[w];
    if (!c || typeof c !== "object") continue;
    const cc = c as Record<string, unknown>;
    const enabled = Array.isArray(cc.enabled)
      ? valid[w].filter((s) => (cc.enabled as unknown[]).includes(s))
      : [...valid[w]];
    // не можна лишитись без жодного снаряда
    const finalEnabled = enabled.length ? enabled : [firstValid(valid[w])];
    const def = typeof cc.def === "string" && finalEnabled.includes(cc.def) ? cc.def : finalEnabled.includes(firstValid(valid[w])) ? firstValid(valid[w]) : finalEnabled[0];
    out[w] = { enabled: finalEnabled, def };
  }
  return out;
}

/** Снаряди, які показуємо у списку для гармати (у порядку таблиць балістики). */
export function allowedShells(settings: ShellSettings, weapon: SettingsWeapon, valid: ValidShells): string[] {
  return valid[weapon].filter((s) => settings[weapon].enabled.includes(s));
}

/** Який снаряд обрати: поточний, якщо він дозволений, інакше типовий. */
export function pickShell(settings: ShellSettings, weapon: SettingsWeapon, valid: ValidShells, current?: string): string {
  const list = allowedShells(settings, weapon, valid);
  if (current && list.includes(current)) return current;
  return list.includes(settings[weapon].def) ? settings[weapon].def : (list[0] ?? PREFERRED_DEFAULT);
}

/** Вмикає/вимикає снаряд; останній ввімкнений вимкнути не можна. Повертає нове значення (вихідне не змінюється). */
export function toggleShell(settings: ShellSettings, weapon: SettingsWeapon, shell: string, on: boolean, valid: ValidShells): ShellSettings {
  const cur = settings[weapon].enabled;
  let enabled = on ? [...new Set([...cur, shell])] : cur.filter((s) => s !== shell);
  enabled = valid[weapon].filter((s) => enabled.includes(s));
  if (!enabled.length) return settings;
  const def = enabled.includes(settings[weapon].def) ? settings[weapon].def : enabled.includes(firstValid(valid[weapon])) ? firstValid(valid[weapon]) : enabled[0];
  return { ...settings, [weapon]: { enabled, def } };
}

/** Гучність звуку 0..1; сміття — повна гучність. */
export function clampVolume(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, Math.round(n * 100) / 100));
}

/** Булеве налаштування з типовим значенням для відсутнього/некоректного. */
export function boolSetting(v: unknown, def: boolean): boolean {
  return typeof v === "boolean" ? v : def;
}
