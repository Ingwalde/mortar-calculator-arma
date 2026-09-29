declare module "*/BallisticCalculator.reference.cjs" {
  export interface RefTableRow {
    range: number;
    elevation: number;
    tof: number | null;
    dElev: number;
    tofPer100m?: number;
  }
  export interface RefInterpolated {
    elevation: number;
    tof: number | null;
    dElev: number;
    tofPer100m: number;
  }
  export const HEIGHT_CORRECTION_FACTOR: number;
  export function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number;
  export function interpolateFromTable(rangeTable: RefTableRow[], distance: number): RefInterpolated | null;
  export function applyHeightCorrection(baseElevation: number, heightDifference: number, dElev: number): number;
  export function applyTOFCorrection(baseTOF: number | null, heightDifference: number, tofPer100m: number): number | null;
}
