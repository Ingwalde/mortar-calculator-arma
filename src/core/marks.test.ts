import { describe, expect, it } from "vitest";
import { CAPTION_MAX, KINDS, fromLegacyType, isTargetable, readCaption, readClass, typeOf } from "./marks";

describe("typeOf", () => {
  it("свій міномет — звідки стріляємо", () => {
    expect(typeOf("friend", "mortar")).toBe("mortar");
  });
  it("будь-яка чужа мітка — ціль", () => {
    for (const k of KINDS) expect(typeOf("hostile", k)).toBe("target");
  });
  it("інші свої мітки та старі точки — довідкові", () => {
    expect(typeOf("friend", "infantry")).toBe("point");
    expect(typeOf("friend", "retreat")).toBe("point");
    expect(typeOf(undefined, "legacy")).toBe("point");
    expect(typeOf(undefined, undefined)).toBe("point");
  });
});

describe("міграція старих міток", () => {
  it("mortar → свій міномет, target → чужа піхота, point → стара точка", () => {
    expect(readClass({ type: "mortar" })).toEqual({ aff: "friend", kind: "mortar", type: "mortar" });
    expect(readClass({ type: "target" })).toEqual({ aff: "hostile", kind: "infantry", type: "target" });
    expect(readClass({ type: "point" })).toEqual({ kind: "legacy", type: "point" });
    expect(readClass({})).toEqual({ kind: "legacy", type: "point" });
    expect(fromLegacyType("target")).toEqual({ aff: "hostile", kind: "infantry" });
  });
  it("нові мітки беруть приналежність і вид, а type виводиться з них", () => {
    expect(readClass({ aff: "hostile", kind: "helicopter", type: "point" })).toEqual({ aff: "hostile", kind: "helicopter", type: "target" });
    expect(readClass({ aff: "friend", kind: "armour", type: "target" })).toEqual({ aff: "friend", kind: "armour", type: "point" });
    expect(readClass({ aff: "friend", kind: "mortar" })).toEqual({ aff: "friend", kind: "mortar", type: "mortar" });
  });
  it("некоректні або неповні значення відкидаються", () => {
    expect(readClass({ aff: "neutral", kind: "infantry", type: "target" })).toEqual({ aff: "hostile", kind: "infantry", type: "target" });
    expect(readClass({ aff: "friend", kind: "tank", type: "mortar" })).toEqual({ aff: "friend", kind: "mortar", type: "mortar" });
    expect(readClass({ kind: "infantry", type: "point" })).toEqual({ kind: "legacy", type: "point" });
    expect(readClass({ aff: "friend", kind: "legacy", type: "mortar" })).toEqual({ kind: "legacy", type: "point" });
  });
});

describe("ціль розрахунку", () => {
  it("чужі мітки й стара точка — так; свої мітки — ні", () => {
    expect(isTargetable({ type: "target", kind: "armour" })).toBe(true);
    expect(isTargetable({ type: "point", kind: "legacy" })).toBe(true);
    expect(isTargetable({ type: "point", kind: "infantry" })).toBe(false);
    expect(isTargetable({ type: "mortar", kind: "mortar" })).toBe(false);
  });
});

describe("підпис", () => {
  it("обрізає, чистить керівні символи, порожнє — undefined", () => {
    expect(readCaption("  Кулемет\nна даху  ")).toBe("Кулемет на даху");
    expect(readCaption("x".repeat(CAPTION_MAX + 50))).toHaveLength(CAPTION_MAX);
    expect(readCaption("   ")).toBeUndefined();
    expect(readCaption(5)).toBeUndefined();
  });
});
