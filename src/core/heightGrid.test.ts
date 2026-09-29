import { describe, expect, it } from "vitest";
import { decodeHeightGrid, encodeHeightGrid, parseHeightJson, sampleHeight } from "./heightGrid";

describe("parseHeightJson / sampleHeight", () => {
  it("indexes as heights[row=Z/step][col=X/step] for a clean 10m grid (Everon-like)", () => {
    const raw: string[][] = [
      ["0", "1", "2"],
      ["10", "11", "12"],
      ["20", "21", "22"]
    ];
    const grid = parseHeightJson(raw);
    // 3x3 сітка на терені 30x30 м -> крок 10 м, як в Everon (1280x1280 на 12800x12800 м)
    // heights[1][2] -> row=1 (Z=10..20), col=2 (X=20..30)
    expect(sampleHeight(grid, 25, 15, 30, 30)).toBe(12);
    expect(sampleHeight(grid, 5, 5, 30, 30)).toBe(0);
  });

  it("scales the grid step to the terrain's real size (Kunar-like: 2049 samples over 4000 m)", () => {
    // не всі терени мають рівно 10-метрову сітку (Kunar: 2049x2049 на 4000x4000 м) —
    // крок рахується з rows/cols і sizeX/sizeZ, а не зі сталої величини.
    const rows = 5;
    const size = 4000; // крок ~800 м, комірка i покриває [i*800, (i+1)*800)
    const raw = Array.from({ length: rows }, (_, r) => Array.from({ length: rows }, (_, c) => String(r * 10 + c)));
    const grid = parseHeightJson(raw);
    expect(sampleHeight(grid, 1600, 1600, size, size)).toBe(22); // row=2,col=2
    expect(sampleHeight(grid, 3999, 3999, size, size)).toBe(44); // row=4,col=4 (край)
  });

  it("returns null outside the grid", () => {
    const grid = parseHeightJson([["5"]]);
    expect(sampleHeight(grid, -5, 0, 10, 10)).toBeNull();
    expect(sampleHeight(grid, 0, 100, 10, 10)).toBeNull();
  });
});

describe("encode/decode round-trip", () => {
  it("preserves rows, cols and values through the binary format", () => {
    const grid = parseHeightJson([
      ["-5", "0", "368"],
      ["16", "24", "32"]
    ]);
    const decoded = decodeHeightGrid(encodeHeightGrid(grid));
    expect(decoded.rows).toBe(grid.rows);
    expect(decoded.cols).toBe(grid.cols);
    expect(Array.from(decoded.data)).toEqual(Array.from(grid.data));
  });
});
