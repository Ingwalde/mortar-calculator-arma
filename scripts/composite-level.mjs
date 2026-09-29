import sharp from "sharp";

const [, , terrainId, level, cols, rows] = process.argv;
const base = `${process.env.APPDATA}/mortar-tablet/maps/${terrainId}/${level}`;
const C = Number(cols);
const R = Number(rows);
const composites = [];
for (let col = 0; col < C; col++) {
  for (let row = 0; row < R; row++) {
    composites.push({ input: `${base}/${col}/${row}.jpg`, left: col * 256, top: row * 256 });
  }
}
await sharp({ create: { width: C * 256, height: R * 256, channels: 3, background: "#f0f" } })
  .composite(composites)
  .png()
  .toFile(`D:/tmp/${terrainId}-level${level}.png`);
console.log("done");
