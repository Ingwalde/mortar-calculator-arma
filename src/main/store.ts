import { app } from "electron";
import { EventEmitter } from "node:events";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const FILE_NAME = "board.json";

/** Хто записав стан: вікно застосунку чи id клієнта з LAN (телефон). */
export const LOCAL_SOURCE = "local";

/** Подія "saved" (sourceId) після кожного запису — з неї LAN-сервер розсилає оновлення. */
export const storeEvents = new EventEmitter();

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

export async function saveStore(data: unknown, source: string = LOCAL_SOURCE): Promise<void> {
  const dir = app.getPath("userData");
  await mkdir(dir, { recursive: true });
  const path = storePath();
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(data), "utf8");
  await rename(tmp, path);
  storeEvents.emit("saved", source);
}
