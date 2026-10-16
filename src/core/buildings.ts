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

function segmentsIntersect(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): boolean {
  const d1 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx);
  const d2 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
  const d3 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  const d4 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Контури перетинаються, один лежить в іншому або їхні межі ближчі за `gap` м (прибудова впритул до стіни). */
export function polygonsTouch(a: Building, b: Building, gap = 0.6): boolean {
  if (a.minX > b.maxX + gap || b.minX > a.maxX + gap || a.minZ > b.maxZ + gap || b.minZ > a.maxZ + gap) return false;
  const na = a.pts.length / 2;
  const nb = b.pts.length / 2;
  for (let i = 0, j = na - 1; i < na; j = i++) {
    for (let k = 0, l = nb - 1; k < nb; l = k++) {
      if (segmentsIntersect(a.pts[j * 2], a.pts[j * 2 + 1], a.pts[i * 2], a.pts[i * 2 + 1], b.pts[l * 2], b.pts[l * 2 + 1], b.pts[k * 2], b.pts[k * 2 + 1])) return true;
    }
  }
  for (let i = 0; i < na; i++) {
    const x = a.pts[i * 2];
    const z = a.pts[i * 2 + 1];
    if (pointInPolygon(x, z, b.pts) || distanceToPolygon(x, z, b.pts) <= gap) return true;
  }
  for (let i = 0; i < nb; i++) {
    const x = b.pts[i * 2];
    const z = b.pts[i * 2 + 1];
    if (pointInPolygon(x, z, a.pts) || distanceToPolygon(x, z, a.pts) <= gap) return true;
  }
  return false;
}

/** Площа багатокутника, м². */
export function polygonArea(pts: Float32Array): number {
  let s = 0;
  const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) s += pts[j * 2] * pts[i * 2 + 1] - pts[i * 2] * pts[j * 2 + 1];
  return Math.abs(s) / 2;
}

/** Найбільше контурів в одній «будівлі»-комплексі: захист від зчеплення цілого ряду будинків. */
const MAX_CLUSTER = 10;

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

  private clusters = new WeakMap<Building, Building[]>();

  /** Будівля разом з усіма контурами, що торкаються її ланцюжком (основний блок і прибудови). */
  clusterOf(start: Building, gap = 0.6): Building[] {
    const cached = this.clusters.get(start);
    if (cached) return cached;
    const out: Building[] = [start];
    const seen = new Set<Building>([start]);
    for (let q = 0; q < out.length && out.length < MAX_CLUSTER; q++) {
      const cur = out[q];
      const gx0 = Math.floor(cur.minX / CELL) - 1;
      const gx1 = Math.floor(cur.maxX / CELL) + 1;
      const gz0 = Math.floor(cur.minZ / CELL) - 1;
      const gz1 = Math.floor(cur.maxZ / CELL) + 1;
      for (let ix = gx0; ix <= gx1; ix++) {
        for (let iz = gz0; iz <= gz1; iz++) {
          for (const cand of this.grid.get(`${ix},${iz}`) ?? []) {
            if (seen.has(cand) || out.length >= MAX_CLUSTER) continue;
            if (polygonsTouch(cur, cand, gap)) {
              seen.add(cand);
              out.push(cand);
            }
          }
        }
      }
    }
    for (const b of out) this.clusters.set(b, out);
    return out;
  }

  /**
   * Будівля під точкою; якщо точка поруч (не далі `tolerance` м від контуру) — найближча.
   * Мітку часто ставлять біля стіни, а не точно всередині.
   */
  findAt(x: number, z: number, tolerance = 3): Building | null {
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
