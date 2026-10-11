/**
 * Злиття стану планшета, коли його пише кілька клієнтів (ПК і телефон).
 *
 * Раніше перемагав останній запис усього файлу — мітка, поставлена на іншому пристрої між
 * двома збереженнями, зникала. Тепер мітки й записи журналу зливаються за id:
 *  - з двох копій однієї мітки лишається новіша (`u`, час останньої правки);
 *  - видалення фіксується надгробками (`deleted[id] = час`), щоб застарілий клієнт не
 *    "воскресив" видалене: надгробок знищує елемент, якщо не старіший за його останню правку;
 *  - решта полів (калібрування, карта, вибір…) лишаються за клієнтом, що зберігає.
 */

type Obj = Record<string, unknown>;

/** Скільки зберігаємо надгробки; старші вважаємо засвоєними всіма клієнтами. */
export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Найбільше записів журналу на терен (те саме, що FIRE_LOG_LIMIT у renderer). */
export const FIRE_LOG_CAP = 200;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asObj(v: unknown): Obj {
  return isObj(v) ? v : {};
}
function asArr(v: unknown): Obj[] {
  return Array.isArray(v) ? v.filter(isObj) : [];
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function idOf(v: Obj): string | null {
  return typeof v.id === "string" && v.id ? v.id : null;
}

function mergeTombs(a: unknown, b: unknown, now: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const src of [asObj(a), asObj(b)]) {
    for (const [id, ts] of Object.entries(src)) {
      const t = num(ts);
      if (t <= 0 || now - t > TOMBSTONE_TTL_MS) continue;
      if (!(id in out) || t > out[id]) out[id] = t;
    }
  }
  return out;
}

interface ListMerge {
  list: Obj[];
  changed: boolean;
}

/** Зливає два списки елементів з `id`; порядок: спершу елементи клієнта, далі нові з бази. */
function mergeList(base: Obj[], incoming: Obj[], tomb: Record<string, number>, stamp: (o: Obj) => number): ListMerge {
  const result: Obj[] = [];
  const position = new Map<string, number>();
  let changed = false;

  const dead = (o: Obj, id: string) => tomb[id] !== undefined && tomb[id] >= stamp(o);

  for (const it of incoming) {
    const id = idOf(it);
    if (id === null) {
      result.push(it);
      continue;
    }
    if (dead(it, id)) {
      changed = true; // клієнт тримав те, що вже видалили деінде
      continue;
    }
    position.set(id, result.length);
    result.push(it);
  }
  for (const b of base) {
    const id = idOf(b);
    if (id === null) continue;
    const at = position.get(id);
    if (at !== undefined) {
      if (stamp(b) > stamp(result[at])) {
        result[at] = b;
        changed = true;
      }
    } else if (!dead(b, id)) {
      position.set(id, result.length);
      result.push(b);
      changed = true;
    }
  }
  return { list: result, changed };
}

export interface MergeResult {
  state: unknown;
  /** true — у результаті є щось, чого не було у вхідному стані клієнта (клієнту треба перечитати). */
  changed: boolean;
}

/**
 * @param base стан, що зараз лежить на диску
 * @param incoming стан, який зберігає клієнт
 */
export function mergeRoots(base: unknown, incoming: unknown, now: number = Date.now()): MergeResult {
  if (!isObj(incoming)) return { state: isObj(base) ? base : incoming, changed: isObj(base) };
  if (!isObj(base)) return { state: incoming, changed: false };

  const out: Obj = { ...incoming };
  let changed = false;

  const deletedTerrains = mergeTombs(base.deletedTerrains, incoming.deletedTerrains, now);
  out.deletedTerrains = deletedTerrains;

  // Власні терени: об'єднання за id, видалені (надгробок) вилучаємо.
  const custom: Obj[] = [];
  const seenCustom = new Set<string>();
  for (const c of asArr(incoming.customTerrains)) {
    const id = idOf(c);
    if (id && deletedTerrains[id] !== undefined) {
      changed = true;
      continue;
    }
    if (id) seenCustom.add(id);
    custom.push(c);
  }
  for (const c of asArr(base.customTerrains)) {
    const id = idOf(c);
    if (!id || seenCustom.has(id) || deletedTerrains[id] !== undefined) continue;
    seenCustom.add(id);
    custom.push(c);
    changed = true;
  }
  out.customTerrains = custom;

  const dataBase = asObj(base.data);
  const dataInc = asObj(incoming.data);
  const data: Obj = {};
  for (const [terrainId, ti] of Object.entries(dataInc)) {
    if (deletedTerrains[terrainId] !== undefined) continue;
    const tb = dataBase[terrainId];
    if (!isObj(ti) || !isObj(tb)) {
      data[terrainId] = ti;
      continue;
    }
    const tomb = mergeTombs(tb.deleted, ti.deleted, now);
    const markers = mergeList(asArr(tb.markers), asArr(ti.markers), tomb, (o) => num(o.u));
    const log = mergeList(asArr(tb.fireLog), asArr(ti.fireLog), tomb, (o) => num(o.at));
    let fireLog = log.list;
    if (fireLog.length > FIRE_LOG_CAP) {
      fireLog = [...fireLog].sort((a, b) => num(a.at) - num(b.at)).slice(-FIRE_LOG_CAP);
    }
    if (markers.changed || log.changed) changed = true;
    // Клієнт із порожнім (ще не завантаженим / подвоєним HMR-модулем) станом не повинен стирати карту й
    // висоти: легітимне «без карти» — це {kind:"none"}, а не null.
    const keep: Obj = {};
    if (ti.map == null && isObj(tb.map)) keep.map = tb.map;
    if (ti.heights == null && isObj(tb.heights)) keep.heights = tb.heights;
    if (Object.keys(keep).length) changed = true;
    data[terrainId] = { ...ti, ...keep, markers: markers.list, fireLog, deleted: tomb };
  }
  // Терени, яких клієнт не знає (створені деінде) — беремо з бази як є.
  for (const [terrainId, tb] of Object.entries(dataBase)) {
    if (terrainId in data || terrainId in dataInc || deletedTerrains[terrainId] !== undefined) continue;
    data[terrainId] = tb;
    changed = true;
  }
  out.data = data;

  return { state: out, changed };
}
