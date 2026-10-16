import { describe, expect, it } from "vitest";
import { BuildingIndex, decodeBuildings, distanceToPolygon, pointInPolygon } from "./buildings";

/** Збирає бінарні дані в тому ж форматі, що пише scripts/extract-buildings.mjs. */
function pack(polys: number[][][]): Uint8Array {
  let size = 8;
  for (const p of polys) size += 1 + p.length * 4;
  const buf = new Uint8Array(size);
  const dv = new DataView(buf.buffer);
  buf.set([0x42, 0x4c, 0x44, 0x31], 0);
  dv.setUint32(4, polys.length, true);
  let o = 8;
  for (const p of polys) {
    buf[o++] = p.length;
    for (const [x, z] of p) {
      dv.setUint16(o, Math.round(x * 4), true);
      dv.setUint16(o + 2, Math.round(z * 4), true);
      o += 4;
    }
  }
  return buf;
}

const square = (cx: number, cz: number, h: number): number[][] => [
  [cx - h, cz - h],
  [cx + h, cz - h],
  [cx + h, cz + h],
  [cx - h, cz + h]
];

describe("buildings", () => {
  it("розбирає формат і рахує центр та межі", () => {
    const list = decodeBuildings(pack([square(100, 200, 5), square(300, 400, 10)]));
    expect(list).toHaveLength(2);
    expect(list[0].cx).toBeCloseTo(100);
    expect(list[0].cz).toBeCloseTo(200);
    expect(list[1].minX).toBeCloseTo(290);
    expect(list[1].maxZ).toBeCloseTo(410);
  });

  it("порожні та пошкоджені дані дають порожній список", () => {
    expect(decodeBuildings(new Uint8Array(0))).toEqual([]);
    expect(decodeBuildings(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toEqual([]);
    const bad = pack([square(10, 10, 2)]).slice(0, 14);
    expect(decodeBuildings(bad)).toEqual([]);
  });

  it("точка в багатокутнику й відстань до контуру", () => {
    const b = decodeBuildings(pack([square(100, 100, 10)]))[0];
    expect(pointInPolygon(100, 100, b.pts)).toBe(true);
    expect(pointInPolygon(125, 100, b.pts)).toBe(false);
    expect(distanceToPolygon(115, 100, b.pts)).toBeCloseTo(5);
    expect(distanceToPolygon(100, 100, b.pts)).toBeCloseTo(10);
  });

  it("findAt: всередині — точно, поруч — найближча в межах допуску, далеко — null", () => {
    const idx = new BuildingIndex(decodeBuildings(pack([square(100, 100, 10), square(140, 100, 10)])));
    expect(idx.findAt(100, 100)!.cx).toBeCloseTo(100);
    // 4 м від стіни першої будівлі, але всередині другої НЕ є: найближча — перша
    expect(idx.findAt(114, 100)!.cx).toBeCloseTo(100);
    expect(idx.findAt(136, 100)!.cx).toBeCloseTo(140);
    expect(idx.findAt(120, 200)).toBeNull();
    expect(idx.findAt(120, 100, 0.5)).toBeNull();
  });

  it("індекс знаходить будівлі на межі осередків сітки", () => {
    // будівля перетинає межу осередків 128 м
    const idx = new BuildingIndex(decodeBuildings(pack([square(128, 128, 8)])));
    expect(idx.findAt(122, 122)).not.toBeNull();
    expect(idx.findAt(134, 134)).not.toBeNull();
  });
});
