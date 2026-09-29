import { readFileSync } from "node:fs";
import { parseHeightJson, sampleHeight } from "../src/core/heightGrid.js";

const raw = JSON.parse(readFileSync("D:/tmp/everon_height.json", "utf8"));
const grid = parseHeightJson(raw);
console.log("grid rows/cols:", grid.rows, grid.cols);

const points = [
  { name: "max-height cell (row806,col1002)", x: 1002 * 10 + 5, z: 806 * 10 + 5 },
  { name: "Camurac (hills)", x: 6594, z: 3117 },
  { name: "Regina", x: 7188, z: 2312 },
  { name: "Durras", x: 8826, z: 2746 },
  { name: "Andres Beacon", x: 6844, z: 8191 },
  { name: "Quarry", x: 8787, z: 3913 },
  { name: "Hillside", x: 6918, z: 4450 },
  { name: "map center", x: 6400, z: 6400 },
  { name: "St Pierre (coast)", x: 9689, z: 1558 },
  { name: "origin corner", x: 5, z: 5 },
  { name: "far corner", x: 12795, z: 12795 }
];
for (const p of points) {
  const h = sampleHeight(grid, p.x, p.z, 12800, 12800);
  console.log(p.name.padEnd(30), `x=${p.x} z=${p.z} ->`, h);
}
