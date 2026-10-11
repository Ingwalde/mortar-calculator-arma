import { describe, expect, it } from "vitest";
import { clampPlacesScale, normalizePlacesLevel, placeTier } from "./places";

describe("placeTier", () => {
  it("військові об'єкти й аеродроми — головні", () => {
    expect(placeTier("Airport")).toBe(1);
    expect(placeTier("Coastal Base Chotain")).toBe(1);
    expect(placeTier("Military Hospital")).toBe(1);
  });
  it("ферми, пагорби, пляжі — другорядні", () => {
    expect(placeTier("Farm")).toBe(3);
    expect(placeTier("Wide Beach")).toBe(3);
    expect(placeTier("Stone Ridge 1")).toBe(3);
  });
  it("решта — звичайні", () => {
    expect(placeTier("Montignac")).toBe(2);
  });
});

describe("налаштування назв", () => {
  it("обмежує масштаб і нормалізує рівень", () => {
    expect(clampPlacesScale(5)).toBe(2);
    expect(clampPlacesScale(0.1)).toBe(0.6);
    expect(clampPlacesScale("abc")).toBe(1);
    expect(normalizePlacesLevel(1)).toBe(1);
    expect(normalizePlacesLevel(7)).toBe(3);
  });
});
