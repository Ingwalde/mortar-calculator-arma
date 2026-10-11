/**
 * Дані висот з GeNeFRAG/ArmaReforger (maps_core/README.md, MIT): 2D-масив рядків-чисел.
 *
 * ОРІЄНТАЦІЯ (перевірено накладенням на тайли для Everon, Arland і Kolguyev — збіг контуру
 * узбережжя IoU 0.86–0.90 лише в одному з 8 варіантів поворотів/дзеркал): РЯДОК масиву = вісь X
 * (схід), СТОВПЕЦЬ = вісь Z, але в зворотному напрямку — від півночі до півдня. Тобто
 *   height(X, Z) = data[ X/sizeX * rows ][ (sizeZ - Z)/sizeZ * cols ].
 * README репозиторію ("heights[N/10][E/10]") цього не відображає — довіряти треба зіставленню з тайлами.
 * УВАГА: крок сітки не завжди 10 м — напр. Kunar має 2049x2049 на 4000x4000 м (~1.95 м/комірка,
 * судячи з усього, "вершини" 2048+1, а не рівні 10-метрові комірки, як в Everon). Тому
 * sampleHeight() рахує крок сітки з rows/cols і реального розміру терену, а не зі сталої 10.
 * Тут — компактний бінарний формат для диска/IPC замість тримання JSON-рядків у пам'яті:
 * заголовок (rows, cols) + Int16Array (rows*cols).
 */
export interface HeightGrid {
  rows: number;
  cols: number;
  data: Int16Array;
}

/** Розбирає сирий JSON (масив масивів рядків-чисел) із height_data у HeightGrid. */
export function parseHeightJson(raw: unknown[][]): HeightGrid {
  const rows = raw.length;
  const cols = rows > 0 ? raw[0].length : 0;
  const data = new Int16Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    const row = raw[r];
    for (let c = 0; c < cols; c++) {
      data[r * cols + c] = Math.round(Number(row[c]));
    }
  }
  return { rows, cols, data };
}

const HEADER_BYTES = 8;

export function encodeHeightGrid(grid: HeightGrid): Uint8Array {
  const buf = new ArrayBuffer(HEADER_BYTES + grid.data.byteLength);
  const view = new DataView(buf);
  view.setInt32(0, grid.rows, true);
  view.setInt32(4, grid.cols, true);
  new Int16Array(buf, HEADER_BYTES).set(grid.data);
  return new Uint8Array(buf);
}

export function decodeHeightGrid(bytes: Uint8Array): HeightGrid {
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const rows = header.getInt32(0, true);
  const cols = header.getInt32(4, true);
  // копія в свіжий (вирівняний по 0) буфер — byteOffset вхідного Uint8Array може бути непарним
  const dataBytes = bytes.slice(HEADER_BYTES, HEADER_BYTES + rows * cols * 2);
  return { rows, cols, data: new Int16Array(dataBytes.buffer) };
}

/**
 * Висота під міткою: найближча комірка сітки, або null поза межами. Крок сітки визначається
 * з реального розміру терену (sizeX/sizeZ, метри) і rows/cols самих даних — не жорстко 10 м,
 * бо різні терени мають різну роздільність height_data (див. коментар вище файлу).
 */
export function sampleHeight(grid: HeightGrid, x: number, z: number, sizeX: number, sizeZ: number): number | null {
  if (x < 0 || z < 0 || x > sizeX || z > sizeZ) return null;
  const row = Math.min(grid.rows - 1, Math.floor((x / sizeX) * grid.rows));
  const col = Math.min(grid.cols - 1, Math.floor((1 - z / sizeZ) * grid.cols));
  return grid.data[row * grid.cols + col];
}

/**
 * Нуль у height_data — море (і береговий урізі); ~68% клітинок Everon/Kolguyev — це вода. Раніше
 * здавалося, що нулі трапляються й на суші, але то був наслідок хибної орієнтації сітки (див.
 * коментар на початку файлу): з правильним зіставленням усі нулі лежать у морі. Для мітки на
 * воді "висота невідома" чесніша за нуль (див. getAutoHeight у src/renderer/mapImport.ts).
 */
