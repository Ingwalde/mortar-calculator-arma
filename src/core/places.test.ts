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

describe("placeKind", () => {
  it("визначає категорію за назвою", async () => {
    const { placeKind } = await import("./places");
    expect(placeKind("Coastal Base Chotain")).toBe("military");
    expect(placeKind("Airport")).toBe("transport");
    expect(placeKind("Power Plant")).toBe("industry");
    expect(placeKind("Long Beach")).toBe("water");
    expect(placeKind("Stone Ridge 1")).toBe("nature");
    expect(placeKind("Montignac")).toBe("settlement");
  });
});

describe("nearestPlace", () => {
  const places = [
    { name: "Montignac", x: 4776, z: 7087 },
    { name: "Provins", x: 5488, z: 6083 }
  ];
  it("знаходить найближчий пункт у межах відстані", async () => {
    const { nearestPlace } = await import("./places");
    expect(nearestPlace(places, 4700, 7050)?.name).toBe("Montignac");
    expect(nearestPlace(places, 5400, 6100)?.name).toBe("Provins");
  });
  it("далеко або без списку — null", async () => {
    const { nearestPlace } = await import("./places");
    expect(nearestPlace(places, 0, 0)).toBeNull();
    expect(nearestPlace(places, 4776, 7500, 300)).toBeNull();
    expect(nearestPlace(undefined, 1, 1)).toBeNull();
  });
});
