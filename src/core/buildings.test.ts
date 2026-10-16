import { describe, expect, it } from "vitest";
import { BuildingIndex, decodeBuildings, distanceToPolygon, pointInPolygon, polygonArea, polygonsTouch } from "./buildings";

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
    // 2 м від стіни першої будівлі, всередині другої нема: найближча — перша
    expect(idx.findAt(112, 100)!.cx).toBeCloseTo(100);
    expect(idx.findAt(138, 100)!.cx).toBeCloseTo(140);
    // 4 м від стіни — за допуском (3 м) це вже не «на будівлі»
    expect(idx.findAt(114, 100)).toBeNull();
    expect(idx.findAt(120, 200)).toBeNull();
    expect(idx.findAt(120, 100, 0.5)).toBeNull();
  });

  it("індекс знаходить будівлі на межі осередків сітки", () => {
    // будівля перетинає межу осередків 128 м
    const idx = new BuildingIndex(decodeBuildings(pack([square(128, 128, 8)])));
    expect(idx.findAt(122, 122)).not.toBeNull();
    expect(idx.findAt(134, 134)).not.toBeNull();
  });

  it("зчеплення: прибудова впритул або внахлест об'єднується з основною будівлею, окрема — ні", () => {
    const list = decodeBuildings(pack([square(100, 100, 10), square(112, 100, 3), square(105, 108, 4), square(150, 100, 10)]));
    expect(polygonsTouch(list[0], list[2], 0.6)).toBe(true); // внахлест
    expect(polygonsTouch(list[0], list[3], 0.6)).toBe(false); // 30 м між
    const idx = new BuildingIndex(list);
    const cl = idx.clusterOf(list[0]);
    expect(cl).toContain(list[2]);
    expect(cl).not.toContain(list[3]);
  });

  it("хрестоподібні контури (ребра перетинаються без вершин усередині) зчіплюються", () => {
    const a = decodeBuildings(pack([[[90, 98], [110, 98], [110, 102], [90, 102]]]))[0];
    const b = decodeBuildings(pack([[[98, 90], [102, 90], [102, 110], [98, 110]]]))[0];
    expect(polygonsTouch(a, b, 0.1)).toBe(true);
  });

  it("ряд будинків не зчіплюється в нескінченний ланцюг", () => {
    const row = Array.from({ length: 30 }, (_, i) => square(100 + i * 10, 100, 5)); // стикаються торцями
    const idx = new BuildingIndex(decodeBuildings(pack(row)));
    expect(idx.clusterOf(idx.buildings[0]).length).toBeLessThanOrEqual(10);
  });

  it("площа багатокутника", () => {
    expect(polygonArea(decodeBuildings(pack([square(0 + 50, 50, 5)]))[0].pts)).toBeCloseTo(100);
  });
});
