import { describe, expect, it } from "vitest";
import { KINDS } from "./marks";
import { symbolKey, symbolSvg } from "./symbols";

describe("умовні знаки", () => {
  it("кожна пара приналежність-вид дає окремий коректний SVG", () => {
    const seen = new Set<string>();
    for (const aff of ["friend", "hostile"] as const) {
      for (const kind of KINDS) {
        const svg = symbolSvg(aff, kind);
        expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">')).toBe(true);
        expect(svg.endsWith("</svg>")).toBe(true);
        seen.add(svg);
      }
    }
    expect(seen.size).toBe(2 * KINDS.length);
  });

  it("свій має блакитний прямокутник, чужий червоний ромб, відступ без рамки", () => {
    expect(symbolSvg("friend", "infantry")).toContain("<rect");
    expect(symbolSvg("friend", "infantry")).toContain("#80E0FF");
    expect(symbolSvg("hostile", "infantry")).toContain("#FF8080");
    expect(symbolSvg("hostile", "infantry")).not.toContain("<rect");
    for (const aff of ["friend", "hostile"] as const) {
      const r = symbolSvg(aff, "retreat");
      expect(r).not.toContain("#80E0FF");
      expect(r).not.toContain("#FF8080");
    }
    expect(symbolSvg("friend", "retreat")).toContain("#2f6fb4");
    expect(symbolSvg("hostile", "retreat")).toContain("#d63b3b");
  });

  it("стара точка — крапка без рамки; ключі кешу різні", () => {
    expect(symbolSvg(undefined, "legacy")).toContain("<circle");
    expect(symbolSvg(undefined, "legacy")).not.toContain("#80E0FF");
    expect(symbolKey("friend", "mortar")).not.toBe(symbolKey("hostile", "mortar"));
    expect(symbolKey(undefined, "legacy")).toBe("-:legacy");
  });
});
