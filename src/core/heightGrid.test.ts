import { describe, expect, it } from "vitest";
import { decodeHeightGrid, encodeHeightGrid, parseHeightJson, sampleHeight } from "./heightGrid";

describe("parseHeightJson / sampleHeight", () => {
  it("indexes as data[row = X/step][col = (sizeZ - Z)/step]: rows run east, columns run north to south", () => {
    const raw: string[][] = [
      ["0", "1", "2"],
      ["10", "11", "12"],
      ["20", "21", "22"]
    ];
    const grid = parseHeightJson(raw);
    // 3x3 сітка на терені 30x30 м -> крок 10 м
    // X=25 -> row 2; Z=15 -> від півночі (30-15)/10 = 1.5 -> col 1  =>  raw[2][1] = 21
    expect(sampleHeight(grid, 25, 15, 30, 30)).toBe(21);
    // X=5 -> row 0; Z=5 -> (30-5)/10 = 2.5 -> col 2  =>  raw[0][2] = 2
    expect(sampleHeight(grid, 5, 5, 30, 30)).toBe(2);
    // північно-західний кут (X=0, Z=30) -> raw[0][0]
    expect(sampleHeight(grid, 0, 30, 30, 30)).toBe(0);
    // південно-східний (X=30, Z=0) -> raw[2][2]
    expect(sampleHeight(grid, 30, 0, 30, 30)).toBe(22);
  });

  it("scales the grid step to the terrain's real size (Kunar-like: 2049 samples over 4000 m)", () => {
    // не всі терени мають рівно 10-метрову сітку (Kunar: 2049x2049 на 4000x4000 м) —
    // крок рахується з rows/cols і sizeX/sizeZ, а не зі сталої величини.
    const rows = 5;
    const size = 4000; // крок ~800 м, комірка i покриває [i*800, (i+1)*800)
    const raw = Array.from({ length: rows }, (_, r) => Array.from({ length: rows }, (_, c) => String(r * 10 + c)));
    const grid = parseHeightJson(raw);
    expect(sampleHeight(grid, 1600, 2400, size, size)).toBe(22); // row=2 (X), col=floor((4000-2400)/800)=2
    expect(sampleHeight(grid, 3999, 1, size, size)).toBe(44); // південно-східний край: row=4, col=4
    expect(sampleHeight(grid, 100, 3900, size, size)).toBe(0); // північно-західний край: row=0, col=0
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
