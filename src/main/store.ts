import { app } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mergeRoots, type MergeOptions } from "../core/merge";

const FILE_NAME = "board.json";

function storePath(): string {
  return join(app.getPath("userData"), FILE_NAME);
}

export async function loadStore(): Promise<unknown> {
  try {
    const raw = await readFile(storePath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Записи йдуть по черзі: читання-злиття-запис не повинні перемішуватись між клієнтами. */
let writeQueue: Promise<unknown> = Promise.resolve();

/**
 * Зберігає стан, зливаючи його з тим, що вже на диску (мітки за id, видалення — надгробками).
 * Повертає true, якщо після злиття в стані з'явилось щось, чого клієнт не мав, — тоді йому треба
 * перечитати стан.
 */
export function saveStore(data: unknown, opts: MergeOptions = {}): Promise<boolean> {
  const run = async (): Promise<boolean> => {
    const dir = app.getPath("userData");
    await mkdir(dir, { recursive: true });
    const { state, changed } = mergeRoots(await loadStore(), data, Date.now(), opts);
    const path = storePath();
    const tmp = `${path}.tmp`;
    await writeFile(tmp, JSON.stringify(state), "utf8");
    await rename(tmp, path);
    return changed;
  };
  const next = writeQueue.then(run, run);
  writeQueue = next.catch(() => undefined);
  return next;
}
