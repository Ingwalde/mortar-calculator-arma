import { describe, expect, it } from "vitest";
import {
  fmtM,
  gridRef,
  type MapGeometry,
  pad,
  parseGrid,
  ptsOK,
  pxFromWorld,
  worldFromPx
} from "./geometry";

function sizeGeom(mapSize: number, mapSizeZ = mapSize): MapGeometry {
  return {
    calib: { mode: "size", size: mapSize, sizeZ: mapSizeZ, a: null, b: null },
    imgW: mapSize,
    imgH: mapSizeZ,
    mapSize,
    mapSizeZ
  };
}

describe("pad / gridRef", () => {
  it("pads with leading zeros and keeps sign in front", () => {
    expect(pad(83, 4)).toBe("0083");
    expect(pad(-5, 3)).toBe("-005");
  });

  it("formats a grid reference as two 4-digit groups", () => {
    expect(gridRef(4830, 11720)).toBe("0483 1172");
    expect(gridRef(0, 0)).toBe("0000 0000");
  });
});

describe("parseGrid", () => {
  it("parses 4-digit grid to cell center with 10 m resolution", () => {
    const g = parseGrid("0483 1172");
    expect(g).not.toBeNull();
    expect(g!.res).toBe(10);
    expect(g!.x).toBe(4835);
    expect(g!.z).toBe(11725);
  });

  it("accepts 2 to 5 digit pairs with matching length", () => {
    expect(parseGrid("48 11")?.res).toBe(1000);
    expect(parseGrid("04830 11720")?.res).toBe(1);
  });

  it("rejects mismatched digit counts or garbage", () => {
    expect(parseGrid("483 1172")).toBeNull();
    expect(parseGrid("not a grid")).toBeNull();
  });
});

describe("world <-> pixel, size-based calibration", () => {
  it("round-trips through world and back for a square blank map", () => {
    const g = sizeGeom(12800);
    const world = worldFromPx(g, 6400, 3200);
    const back = pxFromWorld(g, world.x, world.z);
    expect(back.px).toBeCloseTo(6400, 6);
    expect(back.py).toBeCloseTo(3200, 6);
  });

  it("origin (0,0) world sits at bottom-left of the image (Z grows upward/north)", () => {
    const g = sizeGeom(12800);
    const p = pxFromWorld(g, 0, 0);
    expect(p.px).toBeCloseTo(0);
    expect(p.py).toBeCloseTo(12800);
  });

  it("handles non-square maps (e.g. Arland-like 4095x4095) without distortion", () => {
    const g = sizeGeom(4095);
    const w = worldFromPx(g, 4095, 0);
    expect(w.x).toBeCloseTo(4095, 6);
    expect(w.z).toBeCloseTo(4095, 6);
  });
});

describe("region() for square-padded images (auto_crop_padding convention)", () => {
  it("crops a landscape map (width > height) from the top-left of a square image", () => {
    // e.g. Udachne: map 10240x5120, but the padded source image is square 10240x10240
    const g: MapGeometry = {
      calib: { mode: "size", size: 10240, sizeZ: 5120, a: null, b: null },
      imgW: 10240,
      imgH: 10240,
      mapSize: 10240,
      mapSizeZ: 5120
    };
    // world (0,0) -> bottom-left of the real (cropped) region, which is the top-left
    // corner of the *padding* strip in the full square image: py should be less than imgH.
    const originPx = pxFromWorld(g, 0, 0);
    expect(originPx.py).toBeCloseTo(5120, 6);
    // full-width point at max Z should sit at the very top of the image (py=0).
    const topPx = pxFromWorld(g, 0, 5120);
    expect(topPx.py).toBeCloseTo(0, 6);
  });
});

describe("two-point calibration", () => {
  it("is invalid until both points are far apart on both axes", () => {
    const g = sizeGeom(12800);
    g.calib.mode = "points";
    expect(ptsOK(g)).toBe(false);
    g.calib.a = { px: 100, py: 100, x: 1000, z: 1000 };
    g.calib.b = { px: 100, py: 900, x: 1000, z: 5000 };
    expect(ptsOK(g)).toBe(false); // same X, and px delta on one axis only
    g.calib.b = { px: 900, py: 900, x: 5000, z: 5000 };
    expect(ptsOK(g)).toBe(true);
  });

  it("interpolates world coordinates linearly between the two fixed points", () => {
    const g = sizeGeom(12800);
    g.calib.mode = "points";
    g.calib.a = { px: 0, py: 800, x: 1000, z: 1000 };
    g.calib.b = { px: 800, py: 0, x: 5000, z: 5000 };
    const mid = worldFromPx(g, 400, 400);
    expect(mid.x).toBeCloseTo(3000, 6);
    expect(mid.z).toBeCloseTo(3000, 6);
  });
});

describe("fmtM", () => {
  it("rounds and groups thousands with a plain space", () => {
    expect(fmtM(12345.6)).toBe("12 346");
    expect(fmtM(-42)).toBe("-42");
  });
});
