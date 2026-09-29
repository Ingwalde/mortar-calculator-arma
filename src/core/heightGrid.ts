/**
 * Дані висот з GeNeFRAG/ArmaReforger (maps_core/README.md, MIT): 2D-масив рядків-чисел,
 * рядок = північ/південь (Z), стовпець = схід/захід (X), без інверсії — heights[100][100]
 * на Everon (1280x1280 на 12800x12800 м) відповідає 1000 м N, 1000 м E, тобто крок 10 м.
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
  const row = Math.floor((z / sizeZ) * grid.rows);
  const col = Math.floor((x / sizeX) * grid.cols);
  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return null;
  return grid.data[row * grid.cols + col];
}

/**
 * Точний 0 у height_data (GeNeFRAG/ArmaReforger) — сентинел "даних немає", а не підтверджений
 * рівень моря: перевірено на Everon — "0" трапляється в ~68% клітинок (у 25 разів частіше за
 * наступне популярне значення), включно з реально гірськими ділянками (звірено із супутниковим
 * знімком). Автозаповнення цих прогалин найближчим реальним сусідом розглядалося, але море й
 * прогалини на суші в цих даних утворюють ОДНУ суцільну зв'язну область (99.9996% усіх нульових
 * клітинок Everon — один компонент) — відрізнити їх без зовнішнього сигналу (напр. кольору
 * супутникового знімка) неможливо. Тому 0 означає "невідомо" всюди без винятків (див.
 * getAutoHeight у src/renderer/mapImport.ts) — чесніше й безпечніше, ніж вигадана цифра.
 */
