/**
 * Контури будівель з .topo світу (секція BULD, див. scripts/extract-buildings.mjs): пошук будівлі під міткою,
 * щоб позначити її зруйнованою на карті. Без DOM — тестується напряму.
 *
 * Формат бінарних даних: "BLD1", u32 кількість; на будівлю: u8 n, n x (u16 x, u16 z), координати в чвертях метра.
 */
export interface Building {
  /** Вершини [x0, z0, x1, z1, ...] у метрах (X схід, Z північ). */
  pts: Float32Array;
  cx: number;
  cz: number;
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

const CELL = 128;

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Розбирає бінарні дані; пошкоджені або порожні дають порожній список. */
export function decodeBuildings(bytes: Uint8Array): Building[] {
  if (bytes.length < 8 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== "BLD1") return [];
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = dv.getUint32(4, true);
  const out: Building[] = [];
  let o = 8;
  for (let i = 0; i < count && o < bytes.length; i++) {
    const n = bytes[o++];
    if (n < 3 || o + n * 4 > bytes.length) break;
    const pts = new Float32Array(n * 2);
    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    let cx = 0;
    let cz = 0;
    for (let k = 0; k < n; k++) {
      const x = dv.getUint16(o, true) / 4;
      const z = dv.getUint16(o + 2, true) / 4;
      o += 4;
      pts[k * 2] = x;
      pts[k * 2 + 1] = z;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
      cx += x;
      cz += z;
    }
    out.push({ pts, cx: cx / n, cz: cz / n, minX, minZ, maxX, maxZ });
  }
  return out;
}

export function decodeBuildingsBase64(b64: string): Building[] {
  try {
    return decodeBuildings(fromBase64(b64));
  } catch {
    return [];
  }
}

/** Точка всередині багатокутника (метод променя). */
export function pointInPolygon(x: number, z: number, pts: Float32Array): boolean {
  let inside = false;
  const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2];
    const zi = pts[i * 2 + 1];
    const xj = pts[j * 2];
    const zj = pts[j * 2 + 1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Відстань від точки до найближчого ребра багатокутника, м. */
export function distanceToPolygon(x: number, z: number, pts: Float32Array): number {
  let best = Infinity;
  const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ax = pts[j * 2];
    const az = pts[j * 2 + 1];
    const bx = pts[i * 2];
    const bz = pts[i * 2 + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
    best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
  }
  return best;
}

export class BuildingIndex {
  private grid = new Map<string, Building[]>();

  constructor(readonly buildings: readonly Building[]) {
    for (const b of buildings) {
      const x0 = Math.floor(b.minX / CELL);
      const x1 = Math.floor(b.maxX / CELL);
      const z0 = Math.floor(b.minZ / CELL);
      const z1 = Math.floor(b.maxZ / CELL);
      for (let gx = x0; gx <= x1; gx++) {
        for (let gz = z0; gz <= z1; gz++) {
          const key = `${gx},${gz}`;
          const cell = this.grid.get(key);
          if (cell) cell.push(b);
          else this.grid.set(key, [b]);
        }
      }
    }
  }

  /**
   * Будівля під точкою; якщо точка поруч (не далі `tolerance` м від контуру) — найближча.
   * Мітку часто ставлять біля стіни, а не точно всередині.
   */
  findAt(x: number, z: number, tolerance = 8): Building | null {
    const reach = Math.ceil(tolerance / CELL);
    const gx = Math.floor(x / CELL);
    const gz = Math.floor(z / CELL);
    let best: Building | null = null;
    let bestD = Infinity;
    const seen = new Set<Building>();
    for (let ix = gx - reach; ix <= gx + reach; ix++) {
      for (let iz = gz - reach; iz <= gz + reach; iz++) {
        for (const b of this.grid.get(`${ix},${iz}`) ?? []) {
          if (seen.has(b)) continue;
          seen.add(b);
          if (x < b.minX - tolerance || x > b.maxX + tolerance || z < b.minZ - tolerance || z > b.maxZ + tolerance) continue;
          if (pointInPolygon(x, z, b.pts)) return b;
          const d = distanceToPolygon(x, z, b.pts);
          if (d <= tolerance && d < bestD) {
            bestD = d;
            best = b;
          }
        }
      }
    }
    return best;
  }
}
