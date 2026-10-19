import { describe, expect, it } from "vitest";
import { allowedShells, boolSetting, clampVolume, defaultShellSettings, normalizeShellSettings, pickShell, toggleShell, type ValidShells } from "./settings";
import { TABLES } from "./ballistics";

const valid: ValidShells = {
  M252: Object.keys(TABLES.M252.shells),
  "2B14": Object.keys(TABLES["2B14"].shells)
};

describe("settings: снаряди", () => {
  it("типово доступні всі снаряди, типовий — HE", () => {
    const s = defaultShellSettings(valid);
    expect(s.M252.enabled).toEqual(valid.M252);
    expect(s.M252.def).toBe("HE");
    expect(s["2B14"].def).toBe("HE");
    expect(valid.M252).toContain("Smoke");
    expect(valid.M252).toContain("Illumination");
  });

  it("normalize: сміття й невідомі снаряди відкидаються, порожній набір не допускається", () => {
    expect(normalizeShellSettings(null, valid)).toEqual(defaultShellSettings(valid));
    const n = normalizeShellSettings({ M252: { enabled: ["Smoke", "Nuke", 5], def: "Nuke" }, "2B14": { enabled: [], def: "Smoke" } }, valid);
    expect(n.M252.enabled).toEqual(["Smoke"]);
    expect(n.M252.def).toBe("Smoke");
    // порожній набір для 2Б14 -> лишається HE
    expect(n["2B14"].enabled).toEqual(["HE"]);
    expect(n["2B14"].def).toBe("HE");
  });

  it("типовий снаряд завжди серед доступних", () => {
    const n = normalizeShellSettings({ M252: { enabled: ["Smoke", "Illumination"], def: "HE" } }, valid);
    expect(n.M252.enabled).toContain(n.M252.def);
    expect(n.M252.enabled).not.toContain("HE");
  });

  it("allowedShells зберігає порядок таблиць; pickShell: поточний якщо дозволений, інакше типовий", () => {
    let s = defaultShellSettings(valid);
    s = toggleShell(s, "M252", "Smoke", false, valid);
    expect(allowedShells(s, "M252", valid)).not.toContain("Smoke");
    expect(pickShell(s, "M252", valid, "Smoke")).toBe("HE");
    expect(pickShell(s, "M252", valid, "Illumination")).toBe("Illumination");
    expect(pickShell(s, "M252", valid)).toBe("HE");
  });

  it("останній ввімкнений снаряд вимкнути не можна; вимкнений типовий переключає типовий", () => {
    let s = defaultShellSettings(valid);
    for (const k of valid.M252.slice(1)) s = toggleShell(s, "M252", k, false, valid);
    expect(allowedShells(s, "M252", valid)).toEqual([valid.M252[0]]);
    const before = s;
    s = toggleShell(s, "M252", valid.M252[0], false, valid);
    expect(s).toBe(before); // нічого не змінилось
    // вимикаємо типовий HE при наявності інших
    let t = defaultShellSettings(valid);
    t = toggleShell(t, "M252", "HE", false, valid);
    expect(t.M252.def).not.toBe("HE");
    expect(t.M252.enabled).toContain(t.M252.def);
  });

  it("налаштування гармат незалежні", () => {
    let s = defaultShellSettings(valid);
    s = toggleShell(s, "2B14", "Smoke", false, valid);
    expect(allowedShells(s, "M252", valid)).toContain("Smoke");
    expect(allowedShells(s, "2B14", valid)).not.toContain("Smoke");
  });
});

describe("settings: гучність і прапорці", () => {
  it("гучність обмежується 0..1, сміття — повна", () => {
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(-3)).toBe(0);
    expect(clampVolume(9)).toBe(1);
    expect(clampVolume("abc")).toBe(1);
    expect(clampVolume(undefined)).toBe(1);
    expect(clampVolume(0.333)).toBe(0.33);
  });
  it("boolSetting повертає типове для не-булевого", () => {
    expect(boolSetting(false, true)).toBe(false);
    expect(boolSetting("yes", true)).toBe(true);
    expect(boolSetting(undefined, false)).toBe(false);
  });
});
