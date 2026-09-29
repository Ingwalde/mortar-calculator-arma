// Еталонні функції, дослівно вирізані з mortar_core/BallisticCalculator.js
// (GeNeFRAG/ArmaReforger, MIT License, © 2025 Gerhard Fröhlich):
// https://github.com/GeNeFRAG/ArmaReforger/blob/main/mortar_core/BallisticCalculator.js
//
// Використовується лише в тестах як незалежний еталон для звірки з src/core/ballistics.ts.
// Код не змінено (крім додавання export у кінці файлу).

// Ballistic correction constants
const HEIGHT_CORRECTION_FACTOR = 0.6;

/**
 * Linear interpolation between two values
 * @param {number} x - Input value
 * @param {number} x0 - Lower bound x
 * @param {number} x1 - Upper bound x
 * @param {number} y0 - Value at x0
 * @param {number} y1 - Value at x1
 * @returns {number} Interpolated value
 */
function lerp(x, x0, x1, y0, y1) {
    if (x1 === x0) return y0;
    return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
}

/**
 * Interpolate elevation from range table
 * @param {Array} rangeTable - Ballistic table entries
 * @param {number} distance - Target distance in meters
 * @returns {Object|null} {elevation: number, tof: number, dElev: number} or null if out of range
 */
function interpolateFromTable(rangeTable, distance) {
    let lower = null;
    let upper = null;

    for (let i = 0; i < rangeTable.length; i++) {
        const entry = rangeTable[i];
        if (entry.range === distance) {
            return {
                elevation: entry.elevation,
                tof: entry.tof,
                dElev: entry.dElev,
                tofPer100m: entry.tofPer100m || 0
            };
        }
        if (entry.range < distance) {
            lower = entry;
        } else {
            upper = entry;
            break;
        }
    }

    if (!lower || !upper) return null;

    const elevation = lerp(distance, lower.range, upper.range, lower.elevation, upper.elevation);
    const tof = (lower.tof == null || upper.tof == null) ? null : lerp(distance, lower.range, upper.range, lower.tof, upper.tof);
    const dElev = lerp(distance, lower.range, upper.range, lower.dElev, upper.dElev);
    const tofPer100m = lerp(distance, lower.range, upper.range, lower.tofPer100m || 0, upper.tofPer100m || 0);

    return {
        elevation: elevation,
        tof: tof,
        dElev: dElev,
        tofPer100m: parseFloat(tofPer100m.toFixed(2))
    };
}

/**
 * Apply height correction to elevation
 * @param {number} baseElevation - Base elevation in mils
 * @param {number} heightDifference - Height difference in meters (positive = target higher)
 * @param {number} dElev - Change in elevation per unit
 * @returns {number} Corrected elevation in mils
 */
function applyHeightCorrection(baseElevation, heightDifference, dElev) {
    if (heightDifference === 0) return baseElevation;

    let correction = (heightDifference / 100) * dElev;

    if (heightDifference < -100) {
        correction *= HEIGHT_CORRECTION_FACTOR;
    }

    // Original engine SUBTRACTS the correction (which adds for negative heightDiff)
    return baseElevation - correction;
}

/**
 * Apply height correction to time of flight
 * @param {number} baseTOF - Base time of flight in seconds
 * @param {number} heightDifference - Height difference in meters (positive = target higher)
 * @param {number} tofPer100m - TOF change per 100m height difference
 * @returns {number} Corrected time of flight in seconds
 */
function applyTOFCorrection(baseTOF, heightDifference, tofPer100m) {
    if (baseTOF == null) return null;
    if (heightDifference === 0) return baseTOF;

    const correction = (heightDifference / 100) * tofPer100m;

    return baseTOF + correction;
}

module.exports = {
  HEIGHT_CORRECTION_FACTOR,
  lerp,
  interpolateFromTable,
  applyHeightCorrection,
  applyTOFCorrection
};
